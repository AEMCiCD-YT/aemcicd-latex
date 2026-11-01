// Evaluación comparativa de modelos (sección 5 del diseño). Ejecuta cada caso de casos.json con
// cada modelo y genera informe.html con las respuestas lado a lado, el costo y el tiempo.
// Usa las mismas instrucciones (prompt) y precios que el módulo del servidor.
//
//   ANTHROPIC_API_KEY=… OPENAI_API_KEY=… node evaluar.mjs [modelos separados por coma]
// o, con las claves del Key Vault: bash evaluar.sh
import { readFile, writeFile } from 'node:fs/promises'
import { streamText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { prepararCaso } from './preparar-caso.mjs'
import {
  PRECIOS_POR_DEFECTO,
  costoReal,
} from '../../services/web/modules/aemcicd-ai/app/src/precios.mjs'
import {
  RUTAS_POR_DEFECTO,
  opcionesDeEsfuerzo,
} from '../../services/web/modules/aemcicd-ai/app/src/config.mjs'

const MODELOS = {
  'gpt-6-luna': 'openai',
  'claude-haiku-5-5': 'anthropic',
  'gpt-6.1-terra': 'openai',
  'claude-sonnet-5-5': 'anthropic',
  'gpt-6.1-sol': 'openai',
}
const anthropic = createAnthropic({ baseURL: 'https://api.anthropic.com/v1' })
const openai = createOpenAI({ baseURL: 'https://api.openai.com/v1' })
const cliente = { anthropic, openai }

// Mismo esfuerzo de razonamiento que en el servidor (el primer nivel en que aparece el modelo);
// los modelos que no están en las rutas se prueban con esfuerzo bajo.
// Se puede forzar uno para todos: ESFUERZO=medium bash evaluar.sh
const esfuerzoDe = {}
for (const nivel of Object.values(RUTAS_POR_DEFECTO)) {
  for (const r of nivel) esfuerzoDe[r.modelo] ??= r.esfuerzo
}
const esfuerzo = m => process.env.ESFUERZO || esfuerzoDe[m] || 'low'

function opciones(modelo) {
  const o = opcionesDeEsfuerzo({
    proveedor: MODELOS[modelo],
    esfuerzo: esfuerzo(modelo),
  })
  // Igual que el servidor: OpenAI no guarda las respuestas.
  if (MODELOS[modelo] === 'openai') o.openai = { ...o.openai, store: false }
  return o
}
const claves = {
  anthropic: process.env.ANTHROPIC_API_KEY,
  openai: process.env.OPENAI_API_KEY,
}

const pedidos = process.argv[2]?.split(',') ?? Object.keys(MODELOS)
const modelos = pedidos.filter(m => {
  if (!MODELOS[m]) throw new Error(`modelo desconocido: ${m}`)
  if (!claves[MODELOS[m]]) {
    console.warn(`(se omite ${m}: falta la clave de ${MODELOS[m]})`)
    return false
  }
  return true
})
if (modelos.length === 0) {
  console.error('No hay modelos que evaluar: faltan las claves.')
  process.exit(1)
}

const casos = JSON.parse(
  await readFile(new URL('./casos.json', import.meta.url), 'utf8')
)
const resultados = []
let total = 0

async function ejecutar(caso, modelo) {
  const { def, sistema, mensajes } = await prepararCaso(caso)
  const t0 = Date.now()
  try {
    const r = streamText({
      model: cliente[MODELOS[modelo]](modelo),
      system: sistema,
      messages: mensajes,
      maxOutputTokens: def.maxSalida,
      maxRetries: 2,
      onError: () => {},
      providerOptions: opciones(modelo),
    })
    let texto = ''
    let primero
    for await (const parte of r.fullStream) {
      if (parte.type === 'text-delta') {
        primero ??= Date.now() - t0
        texto += parte.text
      } else if (parte.type === 'error') throw parte.error
    }
    const uso = await r.totalUsage
    const costo = costoReal(modelo, uso, PRECIOS_POR_DEFECTO) / 1e6
    return {
      texto,
      costo,
      primero,
      total: Date.now() - t0,
      entrada: uso.inputTokens,
      salida: uso.outputTokens,
      razonamiento: uso.outputTokenDetails?.reasoningTokens ?? 0,
      fin: await r.finishReason,
    }
  } catch (err) {
    return { error: String(err?.message || err), total: Date.now() - t0 }
  }
}

for (const caso of casos) {
  const fila = { caso, respuestas: {} }
  // Los modelos de un caso en paralelo; los casos uno tras otro.
  await Promise.all(
    modelos.map(async m => {
      fila.respuestas[m] = await ejecutar(caso, m)
      total += fila.respuestas[m].costo ?? 0
    })
  )
  resultados.push(fila)
  const estado = modelos
    .map(m => (fila.respuestas[m].error ? `${m}: ERROR` : `${m}: ok`))
    .join(' · ')
  console.log(`${caso.id}: ${estado}`)
}

const esc = s =>
  String(s ?? '').replace(
    /[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]
  )

const resumen = modelos.map(m => {
  const rs = resultados.map(f => f.respuestas[m]).filter(r => !r.error)
  const suma = k => rs.reduce((s, r) => s + (r[k] ?? 0), 0)
  return {
    m,
    ok: rs.length,
    costo: suma('costo'),
    primero: rs.length ? Math.round(suma('primero') / rs.length) : 0,
    totalMs: rs.length ? Math.round(suma('total') / rs.length) : 0,
  }
})

const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Evaluación de modelos</title>
<style>
body{font:14px/1.45 system-ui,sans-serif;margin:24px;color:#1b1b1b;background:#fff}
h1{font-size:22px}table{border-collapse:collapse;width:100%;margin:12px 0 28px}
th,td{border:1px solid #ddd;padding:8px;vertical-align:top;text-align:left}
th{background:#f6f6f6}pre{white-space:pre-wrap;margin:0;font:12.5px/1.4 ui-monospace,monospace}
.caso{background:#fff0ee}.err{color:#a32c26}.meta{color:#666;font-size:12px;margin-top:6px}
select{margin-top:6px}
</style></head><body>
<h1>Evaluación de modelos · ${new Date().toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}</h1>
<p>${casos.length} casos con las funciones indicadas y las mismas instrucciones que el servidor. Costo total: <b>$${total.toFixed(4)}</b>.
Califica cada respuesta (¿compila?, ¿es correcta?, ¿buen español?) para decidir la asignación de la sección 5 del diseño.</p>
<table><tr><th>Modelo</th><th>Esfuerzo</th><th>Respuestas</th><th>Costo total</th><th>Costo por consulta</th><th>Primer texto (ms)</th><th>Respuesta completa (ms)</th></tr>
${resumen.map(r => `<tr><td>${esc(r.m)}</td><td>${esc(esfuerzo(r.m))}</td><td>${r.ok}/${casos.length}</td><td>$${r.costo.toFixed(4)}</td><td>$${(r.ok ? r.costo / r.ok : 0).toFixed(5)}</td><td>${r.primero}</td><td>${r.totalMs}</td></tr>`).join('\n')}
</table>
<table><tr><th style="width:18%">Caso</th>${modelos.map(m => `<th>${esc(m)}</th>`).join('')}</tr>
${resultados
  .map(
    f =>
      `<tr><td class="caso"><b>${esc(f.caso.id)}</b><br><i>${esc(f.caso.funcion || f.caso.tipo)}</i><pre>${esc(f.caso.pregunta || JSON.stringify(f.caso.entrada))}</pre></td>${modelos
        .map(m => {
          const r = f.respuestas[m]
          if (r.error) return `<td class="err">Error: ${esc(r.error)}</td>`
          return `<td><pre>${esc(r.texto)}</pre><div class="meta">$${r.costo.toFixed(5)} · ${r.entrada}→${r.salida} tokens (${r.razonamiento} de razonamiento) · ${r.total} ms${r.fin === 'length' ? ' · <b>CORTADA por el límite</b>' : ''}</div>
<select aria-label="Calificación"><option>—</option><option>Correcta y compila</option><option>Correcta con detalles</option><option>Incorrecta</option></select></td>`
        })
        .join('')}</tr>`
  )
  .join('\n')}
</table></body></html>`

await writeFile('informe.html', html)
console.log(
  `\nCosto total: $${total.toFixed(4)}. Informe: ${process.cwd()}/informe.html`
)
