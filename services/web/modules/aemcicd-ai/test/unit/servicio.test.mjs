import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { streamText } from 'ai'
import { ObjectId } from 'mongodb'
import { colecciones, crearIndices } from '../../app/src/almacen.mjs'
import { leerConfig } from '../../app/src/config.mjs'
import { aMicro } from '../../app/src/precios.mjs'
import * as saldos from '../../app/src/saldos.mjs'
import { crearServicio, ErrorIA } from '../../app/src/servicio.mjs'
import { ENTRADAS, CONTEXTO } from './casos-fase1.mjs'
import { ENTRADAS_FASE2 } from './casos-fase2.mjs'
import { ENTRADAS_FASE3, CONTEXTO_FASE3 } from './casos-fase3.mjs'
import {
  conectar,
  desconectar,
  modeloQueResponde,
  modeloQueFalla,
  uso,
} from './ayuda.mjs'

let db
let c
const ahora = new Date('2026-11-20T15:00:00Z')
// Rutas fijas para estas pruebas (las de producción se prueban en nucleo.test.mjs).
const env = {
  AEMCICD_AI_ENABLED: 'true',
  ANTHROPIC_API_KEY: 'a',
  OPENAI_API_KEY: 'o',
  AEMCICD_AI_ROUTES: JSON.stringify({
    rapido: [
      { proveedor: 'openai', modelo: 'gpt-6-luna', esfuerzo: 'low' },
      { proveedor: 'anthropic', modelo: 'claude-haiku-5-5', esfuerzo: 'low' },
    ],
    proyecto: [
      { proveedor: 'openai', modelo: 'gpt-6-luna', esfuerzo: 'medium' },
    ],
    escritura: [
      { proveedor: 'openai', modelo: 'gpt-6-luna', esfuerzo: 'medium' },
    ],
  }),
}

before(async () => {
  db = await conectar()
  c = colecciones(db)
  await crearIndices(c)
})
after(() => desconectar(db))
beforeEach(async () => {
  await Promise.all(Object.values(c).map(col => col.deleteMany({})))
})

function servicio({
  modelos = {},
  config = leerConfig(env),
  avisos = [],
} = {}) {
  return crearServicio({
    config,
    c,
    streamText,
    ahora: () => ahora,
    crearModelo: ({ modelo }) => {
      const m = modelos[modelo]
      if (!m) throw new Error(`modelo no simulado: ${modelo}`)
      return typeof m === 'function' ? m() : m
    },
    alAgotarPresupuesto: (proveedor, id) => avisos.push([proveedor, id]),
  })
}

async function consultar(s, userId, extra = {}) {
  let texto = ''
  const r = await s.consultar({
    userId,
    funcion: 'pregunta',
    entrada: { pregunta: '¿Cómo pongo una tabla con booktabs?' },
    alEscribir: t => {
      texto += t
    },
    ...extra,
  })
  return { ...r, texto }
}

test('sin activar no consulta; tras activar responde, cobra el costo real y guarda el evento sin contenido', async () => {
  const userId = new ObjectId()
  const s = servicio({
    modelos: {
      'gpt-6-luna': modeloQueResponde(['Usa ', '\\toprule'], uso(2000, 400)),
    },
  })
  await assert.rejects(
    consultar(s, userId),
    e => e instanceof ErrorIA && e.codigo === 'no_activada'
  )
  await s.activar(userId, '2026-11')

  const r = await consultar(s, userId)
  assert.equal(r.texto, 'Usa \\toprule')
  assert.equal(r.modelo, 'gpt-6-luna')
  // 2000 * 0.1 + 400 * 0.5 = 400 / 1e6 USD = 400 micro
  assert.equal(r.costoMicro, 400)
  assert.equal(r.saldo.gastadoMicro, 400)
  assert.equal(r.saldo.disponibleMicro, aMicro(1) - 400)

  const evento = await c.eventos.findOne({ _id: r.eventoId })
  assert.equal(evento.estado, 'ok')
  assert.equal(evento.proveedor, 'openai')
  assert.equal(evento.tokensSalida, 400)
  assert.equal(
    JSON.stringify(evento).includes('booktabs'),
    false,
    'no se guarda la pregunta'
  )

  const presupuesto = await c.presupuestos.findOne({ _id: 'openai:2026-11' })
  assert.equal(presupuesto.gastadoMicro, 400)
  assert.deepEqual(presupuesto.reservas, [])
})

test('si el proveedor principal falla, responde la alternativa y no se cobra el intento fallido', async () => {
  const userId = new ObjectId()
  const s = servicio({
    modelos: {
      'gpt-6-luna': modeloQueFalla(),
      'claude-haiku-5-5': modeloQueResponde(['hola'], uso(1000, 100)),
    },
  })
  await s.activar(userId, '2026-11')
  const r = await consultar(s, userId)
  assert.equal(r.modelo, 'claude-haiku-5-5')
  assert.equal(r.saldo.gastadoMicro, r.costoMicro)
  const estados = (await c.eventos.find({}).sort({ _id: 1 }).toArray()).map(
    e => [e.modelo, e.estado]
  )
  assert.deepEqual(estados, [
    ['gpt-6-luna', 'error'],
    ['claude-haiku-5-5', 'ok'],
  ])
  const openai = await c.presupuestos.findOne({ _id: 'openai:2026-11' })
  assert.equal(openai.gastadoMicro, 0)
  assert.deepEqual(openai.reservas, [])
})

test('con ambos proveedores caídos, error no_disponible y saldo intacto', async () => {
  const userId = new ObjectId()
  const s = servicio({
    modelos: {
      'gpt-6-luna': modeloQueFalla(),
      'claude-haiku-5-5': modeloQueFalla(),
    },
  })
  await s.activar(userId, '2026-11')
  await assert.rejects(consultar(s, userId), e => e.codigo === 'no_disponible')
  assert.equal((await s.saldo(userId)).gastadoMicro, 0)
})

test('presupuesto de OpenAI agotado: pasa a Claude y avisa', async () => {
  const userId = new ObjectId()
  const avisos = []
  const config = leerConfig({ ...env, AEMCICD_AI_BUDGET_OPENAI_USD: '0' })
  const s = servicio({
    config,
    avisos,
    modelos: { 'claude-haiku-5-5': modeloQueResponde(['ok']) },
  })
  await s.activar(userId, '2026-11')
  const r = await consultar(s, userId)
  assert.equal(r.proveedor, 'anthropic')
  assert.deepEqual(avisos, [['openai', 'openai:2026-11']])
})

test('crédito agotado: sin_saldo, sin llamar a ningún modelo', async () => {
  const userId = new ObjectId()
  const s = servicio({ modelos: {} })
  await s.activar(userId, '2026-11')
  await c.creditos.insertOne({
    _id: `${userId}:2026-11`,
    gastadoMicro: aMicro(1),
    reservas: [],
  })
  await assert.rejects(consultar(s, userId), e => e.codigo === 'sin_saldo')
  assert.equal(await c.eventos.countDocuments(), 0)
})

test('con poco saldo, la respuesta se limita a lo que cabe', async () => {
  const userId = new ObjectId()
  let maxPedido
  const modelo = modeloQueResponde(['x'], uso(500, 50))
  const original = modelo.doStream
  modelo.doStream = async opciones => {
    maxPedido = opciones.maxOutputTokens
    return original.call(modelo, opciones)
  }
  const s = servicio({ modelos: { 'gpt-6-luna': modelo } })
  await s.activar(userId, '2026-11')
  // Quedan $0.0006: alcanza para la entrada estimada y unos cientos de tokens de salida.
  await c.creditos.insertOne({
    _id: `${userId}:2026-11`,
    gastadoMicro: aMicro(1) - 600,
    reservas: [],
  })
  await consultar(s, userId)
  assert.ok(
    maxPedido >= 200 && maxPedido < 1500,
    `maxOutputTokens=${maxPedido}`
  )
})

test('reservas concurrentes no pasan del tope', async () => {
  const resultados = await Promise.all(
    Array.from({ length: 20 }, () =>
      saldos.reservar(c.creditos, 'u:2026-11', 100, 1000)
    )
  )
  assert.equal(resultados.filter(Boolean).length, 10)
  const { reservadoMicro } = await saldos.leer(c.creditos, 'u:2026-11')
  assert.equal(reservadoMicro, 1000)
})

test('las reservas abandonadas caducan', async () => {
  const antes = new Date(Date.now() - saldos.RESERVA_MAX_MS - 1000)
  assert.ok(
    await saldos.reservar(c.creditos, 'v:2026-11', 1000, 1000, {
      ahora: antes,
    })
  )
  assert.equal(
    await saldos.reservar(c.creditos, 'v:2026-11', 1000, 1000, {
      ahora: antes,
    }),
    null
  )
  assert.ok(await saldos.reservar(c.creditos, 'v:2026-11', 1000, 1000))
})

test('«probar con otro modelo» usa la alternativa y queda marcado', async () => {
  const userId = new ObjectId()
  const s = servicio({
    modelos: { 'claude-haiku-5-5': modeloQueResponde(['b']) },
  })
  await s.activar(userId, '2026-11')
  const r = await consultar(s, userId, { preferir: 'alternativa' })
  assert.equal(r.modelo, 'claude-haiku-5-5')
  assert.equal((await c.eventos.findOne({ _id: r.eventoId })).alternativa, true)
})

test('👍/👎 solo sobre eventos propios', async () => {
  const userId = new ObjectId()
  const s = servicio({ modelos: { 'gpt-6-luna': modeloQueResponde(['a']) } })
  await s.activar(userId, '2026-11')
  const r = await consultar(s, userId)
  assert.equal(await s.valorar(userId, r.eventoId, 1), true)
  assert.equal(await s.valorar(new ObjectId(), r.eventoId, -1), false)
  assert.equal((await c.eventos.findOne({ _id: r.eventoId })).valoracion, 1)
  await assert.rejects(s.valorar(userId, r.eventoId, 5))
})

test('registro de uso del proyecto: se añade una vez por evento y se puede vaciar', async () => {
  const userId = new ObjectId()
  const projectId = new ObjectId()
  const s = servicio({ modelos: { 'gpt-6-luna': modeloQueResponde(['a']) } })
  await s.activar(userId, '2026-11')
  const r = await consultar(s, userId, { projectId })
  // Un evento sin proyecto (como el soporte) no se registra en ningún proyecto.
  const sinProyecto = await consultar(s, userId)
  assert.equal(
    await s.registrar(projectId, userId, sinProyecto.eventoId, 'x'),
    false
  )
  assert.equal(
    await s.registrar(projectId, userId, r.eventoId, 'en main.tex'),
    true
  )
  assert.equal(
    await s.registrar(projectId, userId, r.eventoId, 'en main.tex'),
    true
  )
  assert.equal(await s.registrar(projectId, new ObjectId(), r.eventoId), false)
  const registro = await s.verRegistro(projectId)
  assert.equal(registro.length, 1)
  assert.equal(registro[0].resumen, 'respondió una pregunta: en main.tex')
  await s.vaciarRegistro(projectId)
  assert.equal((await s.verRegistro(projectId)).length, 0)
})

test('IA deshabilitada: estado lo indica y consultar falla', async () => {
  const s = servicio({ config: leerConfig({}) })
  const userId = new ObjectId()
  assert.deepEqual(await s.estado(userId), {
    habilitada: false,
    activada: false,
    saldo: null,
  })
  await assert.rejects(consultar(s, userId), e => e.codigo === 'deshabilitada')
})

test('resumen mensual: solo totales, sin identificadores', async () => {
  const { resumenMensual } = await import('../../app/src/resumen.mjs')
  const a = new ObjectId()
  const b = new ObjectId()
  const s = servicio({
    modelos: {
      'gpt-6-luna': () => modeloQueResponde(['x'], uso(1000, 100)),
      'claude-haiku-5-5': () => modeloQueResponde(['y'], uso(1000, 100)),
    },
  })
  for (const u of [a, b]) await s.activar(u, '2026-11')
  const r1 = await consultar(s, a)
  await consultar(s, b)
  await consultar(s, b, { preferir: 'alternativa' })
  await s.valorar(a, r1.eventoId, 1)
  const r = await resumenMensual(c, leerConfig(env), ahora)
  assert.equal(r.mes, '2026-11')
  assert.equal(r.estudiantesConIaActivada, 2)
  assert.equal(r.estudiantesQueUsaron, 2)
  assert.equal(r.consultas, 3)
  assert.equal(r.presupuestos.openai.ciclo, '2026-11')
  const luna = r.porFuncionYModelo.find(f => f.modelo === 'gpt-6-luna')
  assert.equal(luna.consultas, 2)
  assert.equal(luna.utiles, 1)
  const texto = JSON.stringify(r)
  assert.equal(texto.includes(String(a)) || texto.includes(String(b)), false)
})

for (const [funcion, entrada] of Object.entries({
  ...ENTRADAS,
  ...ENTRADAS_FASE2,
  ...ENTRADAS_FASE3,
})) {
  test(`${funcion}: cobra el uso real y no guarda documentos, instrucciones, preguntas, imágenes ni respuestas`, async () => {
    const userId = new ObjectId(),
      projectId = new ObjectId()
    let pedido
    const modelo = modeloQueResponde(['RESPUESTA_NO_PERSISTIR'], uso(2000, 400))
    const original = modelo.doStream
    modelo.doStream = async opciones => {
      pedido = opciones
      return original.call(modelo, opciones)
    }
    const s = servicio({ modelos: { 'gpt-6-luna': modelo } })
    await s.activar(userId, '2026-11')
    const p = { funcion, entrada, contextoProyecto: CONTEXTO_FASE3 }
    const estimacion = s.estimar(p)
    const r = await consultar(s, userId, {
      ...p,
      projectId,
      maximoAceptadoMicro: estimacion.maximoMicro,
    })
    assert.equal(r.costoMicro, 400)
    assert.equal(r.saldo.gastadoMicro, 400)
    assert.equal(
      (await c.presupuestos.findOne({ _id: 'openai:2026-11' })).gastadoMicro,
      400
    )
    assert.ok(pedido)
    const evento = await c.eventos.findOne({ _id: r.eventoId })
    assert.equal(evento.funcion, funcion)
    assert.deepEqual(
      Object.keys(evento).sort(),
      [
        '_id',
        'fecha',
        'valoracion',
        'userId',
        'projectId',
        'funcion',
        'nivel',
        'proveedor',
        'modelo',
        'alternativa',
        'tokensEntrada',
        'tokensCache',
        'tokensSalida',
        'costoMicro',
        'estado',
      ].sort()
    )
    const guardado = JSON.stringify(
      await Promise.all(Object.values(c).map(col => col.find({}).toArray()))
    )
    for (const secreto of [
      'RESPUESTA_NO_PERSISTIR',
      'PDF_NO_PERSISTIR',
      'HISTORIAL_NO_PERSISTIR',
      'TITULO_NO_PERSISTIR',
      CONTEXTO.instrucciones,
      CONTEXTO.destino.seleccion,
      entrada.pregunta,
      entrada.imagen?.base64,
      entrada.mensaje,
    ].filter(Boolean))
      assert.equal(
        guardado.includes(secreto),
        false,
        'no debe persistir contenido'
      )
    assert.equal(await s.eventoPropio(userId, projectId, r.eventoId), true)
    assert.equal(
      await s.eventoPropio(userId, projectId, r.eventoId, funcion),
      true
    )
    assert.equal(
      await s.eventoPropio(userId, projectId, r.eventoId, 'funcion_ajena'),
      false
    )
    assert.equal(
      await s.eventoPropio(userId, new ObjectId(), r.eventoId),
      false
    )
    assert.equal(
      await s.registrar(new ObjectId(), userId, r.eventoId, 'main.tex'),
      false
    )
  })
}

test('chat: no llama al modelo hasta aceptar la cota; un proyecto más caro requiere otra estimación', async () => {
  const userId = new ObjectId()
  const s = servicio()
  await s.activar(userId, '2026-11')
  const p = {
    funcion: 'chat_proyecto',
    entrada: ENTRADAS.chat_proyecto,
    contextoProyecto: CONTEXTO,
  }
  const e = s.estimar(p)
  assert.ok(e.tokensEntrada > 0 && e.maximoMicro > 0)
  for (const maximoAceptadoMicro of [undefined, e.maximoMicro - 1, -1, 'mucho'])
    await assert.rejects(
      consultar(s, userId, { ...p, maximoAceptadoMicro }),
      e => e.codigo === 'estimacion'
    )
  assert.equal(await c.eventos.countDocuments(), 0)
  assert.equal((await s.saldo(userId)).gastadoMicro, 0)
})

test('una consulta simultánea del mismo estudiante se rechaza sin cobrar y libera el bloqueo al terminar', async () => {
  const userId = new ObjectId()
  const s = servicio({
    modelos: { 'gpt-6-luna': () => modeloQueResponde(['Respuesta']) },
  })
  await s.activar(userId, '2026-11')
  let continuar
  let entro
  const entrada = new Promise(resolve => {
    entro = resolve
  })
  const pausa = new Promise(resolve => {
    continuar = resolve
  })
  const primera = consultar(s, userId, {
    alEscribir: async () => {
      entro()
      await pausa
    },
  })
  await entrada
  await assert.rejects(consultar(s, userId), e => e.codigo === 'ocupada')
  continuar()
  await primera
  await consultar(s, userId)
  assert.equal(await c.eventos.countDocuments(), 2)
  assert.equal(
    (await c.usuarios.findOne({ _id: userId })).consultaId,
    undefined
  )
})
