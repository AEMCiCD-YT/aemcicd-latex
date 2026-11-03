// Evaluación aislada con datos sintéticos: nunca usa Mongo ni crédito de estudiantes.
import { readFile, appendFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'
import { streamText, Output, jsonSchema } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { prepararCaso } from './preparar-caso.mjs'
import {
  leerConfig,
  opcionesDeEsfuerzo,
} from '../../services/web/modules/aemcicd-ai/app/src/config.mjs'
import {
  costoReal,
  costoMaximo,
  estimarTokens,
} from '../../services/web/modules/aemcicd-ai/app/src/precios.mjs'
import {
  ESQUEMA_CAMBIOS,
  validarRespuesta,
} from '../../services/web/modules/aemcicd-ai/app/src/cambios.mjs'
import {
  validarComentarios,
  validarGrafica,
} from '../../services/web/modules/aemcicd-ai/app/src/fase2.mjs'
import {
  validarBibliografia,
  validarDocumento,
  verificarClavesCitas,
} from '../../services/web/modules/aemcicd-ai/app/src/fase3.mjs'

const salida = resolve(process.env.EVAL_SALIDA || 'resultados/rutas')
await mkdir(salida, { recursive: true, mode: 0o700 })
const archivo = join(salida, 'respuestas.jsonl')
const config = leerConfig()
// Mismos destinos fijos que proveedores.mjs. Las dependencias se resuelven en el
// paquete aislado del evaluador, sin instalar el monorepo ni enlazar node_modules.
const clientes = {
  anthropic: createAnthropic({
    apiKey: config.claves.anthropic,
    baseURL: 'https://api.anthropic.com/v1',
  }),
  openai: createOpenAI({
    apiKey: config.claves.openai,
    baseURL: 'https://api.openai.com/v1',
  }),
}
const crearModelo = ruta => clientes[ruta.proveedor](ruta.modelo)
const casos = JSON.parse(
  await readFile(new URL('./casos.json', import.meta.url), 'utf8')
)
const filtro = process.env.EVAL_CASOS?.split(',')
const posiciones = (
  process.env.EVAL_POSICIONES || 'principal,alternativa'
).split(',')
const concurrencia = Number(process.env.EVAL_CONCURRENCIA || 4)
const presupuesto = Number(process.env.EVAL_PRESUPUESTO_USD || 8)
if (
  !Number.isInteger(concurrencia) ||
  concurrencia < 1 ||
  concurrencia > 8 ||
  !Number.isFinite(presupuesto) ||
  presupuesto <= 0
)
  throw new Error('Concurrencia o presupuesto de evaluación no válidos.')
const anteriores = new Map()
try {
  for (const linea of (await readFile(archivo, 'utf8'))
    .split('\n')
    .filter(Boolean)) {
    const r = JSON.parse(linea)
    anteriores.set(r.clave, r)
  }
} catch (err) {
  if (err.code !== 'ENOENT') throw err
}
const trabajos = []
for (const caso of casos) {
  if (filtro && !filtro.includes(caso.id)) continue
  const preparada = await prepararCaso(caso)
  for (const [indice, ruta] of config.rutas[preparada.def.nivel].entries()) {
    const posicion = indice === 0 ? 'principal' : 'alternativa'
    if (!posiciones.includes(posicion)) continue
    if (!config.claves[ruta.proveedor])
      throw new Error(`Falta la clave de ${ruta.proveedor}.`)
    const huella = createHash('sha256')
      .update(
        JSON.stringify({
          caso,
          ruta,
          sistema: preparada.sistema,
          mensajes: preparada.mensajes,
          esquema: preparada.def.esquema,
          maxSalida: preparada.def.maxSalida,
        })
      )
      .digest('hex')
    const clave = `${caso.id}:${posicion}:${huella}`
    const previo = anteriores.get(clave)
    if (previo && (!previo.error || process.env.EVAL_REINTENTAR !== 'true'))
      continue
    const tokens = estimarTokens(
      preparada.sistema + JSON.stringify(preparada.mensajes)
    )
    trabajos.push({
      caso,
      preparada,
      ruta,
      posicion,
      clave,
      maximoUSD:
        costoMaximo(
          ruta.modelo,
          tokens,
          preparada.def.maxSalida,
          config.precios
        ) / 1e6,
    })
  }
}
await writeFile(
  join(salida, 'configuracion.json'),
  JSON.stringify(
    {
      fecha: new Date().toISOString(),
      rutas: config.rutas,
      precios: config.precios,
      casos: casos.length,
      concurrencia,
      presupuestoUSD: presupuesto,
      descripcion:
        'Datos sintéticos; salida local de evaluación, sin registros del producto.',
    },
    null,
    2
  )
)
let cobrado = [...anteriores.values()].reduce(
  (s, r) => s + (r.costoUSD ?? r.maximoUSD ?? 0),
  0
)
let reservado = 0,
  siguiente = 0,
  terminadas = 0
let guardado = Promise.resolve()

async function validar(texto, caso, p) {
  const { def, contexto, sesion } = p
  if (def.propuesta) {
    const r = await validarRespuesta(texto, contexto, sesion, caso.funcion)
    if (caso.funcion === 'citas_faltantes') verificarClavesCitas(r, contexto)
    return { ok: true, cambios: r.cambios.length, respuesta: r }
  }
  if (!def.esquema) return undefined
  if (def.respuesta === 'comentarios') {
    const r = await validarComentarios(texto, contexto, sesion)
    return { ok: true, cambios: r.comentarios.length, respuesta: r }
  }
  if (def.respuesta === 'bibliografia') {
    const r = await validarBibliografia(texto, contexto, sesion)
    return { ok: true, cambios: r.cambios.length, respuesta: r }
  }
  if (def.respuesta === 'documento') {
    const r = validarDocumento(texto, caso.funcion, '000000000000000000000001')
    return { ok: true, cambios: 1, respuesta: r }
  }
  const r = validarGrafica(
    texto,
    contexto.datosGrafica || caso.entrada?.seleccion,
    '000000000000000000000001'
  )
  return { ok: true, cambios: 1, respuesta: r }
}

async function ejecutar(t) {
  const { caso, preparada: p, ruta, posicion, clave, maximoUSD } = t
  const inicio = Date.now()
  const r = {
    clave,
    casoId: caso.id,
    funcion: caso.funcion || 'pregunta',
    posicion,
    nivel: p.def.nivel,
    ...ruta,
    maximoUSD,
    fecha: new Date().toISOString(),
  }
  let respuesta
  try {
    respuesta = streamText({
      model: crearModelo(ruta),
      system: p.sistema,
      messages: p.mensajes,
      maxOutputTokens: p.def.maxSalida,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(180000),
      onError: () => {},
      ...((p.def.propuesta || p.def.esquema) && {
        output: Output.object({
          schema: jsonSchema(p.def.esquema || ESQUEMA_CAMBIOS),
          name: p.def.esquema
            ? 'respuesta_de_revision'
            : 'propuesta_de_cambios',
        }),
      }),
      providerOptions: {
        ...opcionesDeEsfuerzo(ruta),
        openai: { ...opcionesDeEsfuerzo(ruta).openai, store: false },
        anthropic: {
          ...opcionesDeEsfuerzo(ruta).anthropic,
          ...((p.def.propuesta || p.def.esquema) && {
            structuredOutputMode: 'outputFormat',
          }),
        },
      },
    })
    r.texto = ''
    for await (const parte of respuesta.fullStream) {
      if (parte.type === 'text-delta') {
        r.primeroMs ??= Date.now() - inicio
        r.texto += parte.text
      } else if (parte.type === 'error') throw parte.error
    }
    r.uso = await respuesta.totalUsage
    r.costoUSD = costoReal(ruta.modelo, r.uso, config.precios) / 1e6
    r.fin = await respuesta.finishReason
    try {
      r.validacion = await validar(r.texto, caso, p)
    } catch (err) {
      r.validacion = { ok: false, motivo: err.message }
    }
  } catch (err) {
    // No se vuelcan errores del SDK: podrían incluir cabeceras o la petición completa.
    r.error = {
      tipo: err.name || 'Error',
      http: err.statusCode,
      tiempoAgotado: Date.now() - inicio >= 179000,
    }
    try {
      const uso = await respuesta?.totalUsage
      if (uso?.inputTokens != null) {
        r.uso = uso
        r.costoUSD = costoReal(ruta.modelo, uso, config.precios) / 1e6
      }
    } catch {
      /* El importe desconocido conserva su reserva máxima en el presupuesto. */
    }
  }
  r.totalMs = Date.now() - inicio
  return r
}

async function trabajador() {
  while (siguiente < trabajos.length) {
    const t = trabajos[siguiente++]
    if (cobrado + reservado + t.maximoUSD > presupuesto)
      throw new Error(
        'Se alcanzó la cota del presupuesto de evaluación; reanuda con los resultados conservados.'
      )
    reservado += t.maximoUSD
    const r = await ejecutar(t)
    reservado -= t.maximoUSD
    cobrado += r.costoUSD ?? t.maximoUSD
    guardado = guardado.then(() =>
      appendFile(archivo, JSON.stringify(r) + '\n', { mode: 0o600 })
    )
    await guardado
    terminadas++
    console.log(
      `${terminadas}/${trabajos.length} ${r.casoId} ${r.posicion} ${r.modelo}/${r.esfuerzo}: ${r.error ? 'ERROR' : r.validacion?.ok === false ? 'FORMATO RECHAZADO' : 'recibida'}; $${cobrado.toFixed(4)}`
    )
  }
}
console.log(
  `Pendientes: ${trabajos.length}. Respuestas previas: ${anteriores.size}. Máximo reservado: $${trabajos.reduce((s, t) => s + t.maximoUSD, 0).toFixed(4)}.`
)
if (process.env.EVAL_SOLO_PREPARAR === 'true') process.exit(0)
await Promise.all(Array.from({ length: concurrencia }, trabajador))
console.log(
  `Evaluación terminada. Resultados: ${archivo}. Costo conocido/reserva de errores: $${cobrado.toFixed(6)}.`
)
