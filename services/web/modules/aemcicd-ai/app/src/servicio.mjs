import { ciclo } from './ciclos.mjs'
import { opcionesDeEsfuerzo } from './config.mjs'
import { candidatos } from './enrutador.mjs'
import { funcion as definicion } from './funciones.mjs'
import {
  costoMaximo,
  costoReal,
  estimarTokens,
  salidaQueCabe,
} from './precios.mjs'
import * as saldos from './saldos.mjs'
import { randomUUID } from 'node:crypto'
import { Output, jsonSchema } from 'ai'
import { ESQUEMA_CAMBIOS } from './cambios.mjs'

// Salida estructurada para las funciones con propuesta: el API obliga al modelo a devolver JSON
// con el esquema exacto. En la evaluación, Claude Sonnet 5.5 a veces respondía en Markdown pese a
// la instrucción. En Claude se fuerza el modo nativo (outputFormat): el SDK no reconoce los
// modelos 5.5 y usaría su alternativa jsonTool, una herramienta forzada que esos modelos
// rechazan con un 400.
const SALIDA_CAMBIOS = Output.object({
  schema: jsonSchema(ESQUEMA_CAMBIOS),
  name: 'propuesta_de_cambios',
})

// Une las opciones por proveedor sin que una pise a otra (p. ej. store y reasoningEffort).
function combinarOpciones(...lista) {
  const total = {}
  for (const opciones of lista) {
    for (const [proveedor, valores] of Object.entries(opciones || {})) {
      total[proveedor] = { ...total[proveedor], ...valores }
    }
  }
  return total
}

export class ErrorIA extends Error {
  constructor(codigo, mensaje) {
    super(mensaje)
    this.codigo = codigo
  }
}

const MENSAJES = {
  deshabilitada: 'La IA no está disponible en este momento.',
  no_activada: 'Activa la IA para usarla.',
  sin_saldo: 'Ya usaste tu crédito de IA de este mes. Se renueva el día 1.',
  sin_presupuesto:
    'La IA del programa alcanzó su presupuesto de este ciclo. Vuelve a intentarlo en unos días.',
  no_disponible:
    'Los servicios de IA no responden. Inténtalo de nuevo en unos minutos.',
}

function error(codigo) {
  return new ErrorIA(codigo, MENSAJES[codigo])
}

// Lógica del módulo, sin Express: la usan el controlador, los scripts y las pruebas.
// dependencias: { config, c (colecciones), crearModelo, streamText, ahora?, alAgotarPresupuesto? }
export function crearServicio({
  config,
  c,
  crearModelo,
  streamText,
  ahora = () => new Date(),
  alAgotarPresupuesto,
}) {
  const idCredito = (userId, fecha) => `${userId}:${ciclo(fecha, 1).id}`
  const idPresupuesto = (proveedor, fecha) =>
    `${proveedor}:${ciclo(fecha, config.presupuestos[proveedor].diaInicio).id}`

  async function activada(userId) {
    return Boolean(
      await c.usuarios.findOne({ _id: userId }, { projection: { _id: 1 } })
    )
  }

  async function activar(userId, aviso) {
    await c.usuarios.updateOne(
      { _id: userId },
      { $setOnInsert: { activadoEn: ahora(), aviso } },
      { upsert: true }
    )
  }

  async function saldo(userId) {
    const fecha = ahora()
    const { gastadoMicro, reservadoMicro } = await saldos.leer(
      c.creditos,
      idCredito(userId, fecha),
      { ahora: fecha }
    )
    const { fin } = ciclo(fecha, 1)
    return {
      creditoMicro: config.creditoMensualMicro,
      gastadoMicro,
      disponibleMicro: Math.max(
        0,
        config.creditoMensualMicro - gastadoMicro - reservadoMicro
      ),
      renuevaEl: fin,
    }
  }

  async function estado(userId) {
    return {
      habilitada: config.habilitada,
      activada: config.habilitada ? await activada(userId) : false,
      saldo: config.habilitada ? await saldo(userId) : null,
    }
  }

  async function registrarEvento(evento) {
    const { insertedId } = await c.eventos.insertOne({
      fecha: ahora(),
      valoracion: null,
      ...evento,
    })
    return insertedId
  }

  function prepararConsulta(funcion, entrada, contextoProyecto = {}) {
    const def = definicion(funcion)
    const preparada = def.preparar(entrada, contextoProyecto)
    // Los bytes de la imagen no son texto tokenizable. Se reserva una cota visual separada.
    const sinImagen = preparada.mensajes.map(m => ({
      ...m,
      content: Array.isArray(m.content)
        ? m.content.filter(p => p.type !== 'image' && p.type !== 'file')
        : m.content,
    }))
    const tokensEntrada =
      estimarTokens(preparada.sistema) +
      estimarTokens(JSON.stringify(sinImagen)) +
      (preparada.tokensVisuales || 0)
    // Algunas funciones ajustan la salida a la entrada (p. ej., una foto de varias páginas).
    const maxSalida = preparada.maxSalida || def.maxSalida
    // …y otras eligen el nivel de modelo según el contexto (p. ej., el agente con todo el proyecto).
    const nivel = preparada.nivel || def.nivel
    return { def, ...preparada, tokensEntrada, maxSalida, nivel }
  }

  function estimar({ funcion, entrada, contextoProyecto, preferir }) {
    const { def, tokensEntrada, maxSalida, nivel } = prepararConsulta(
      funcion,
      entrada,
      contextoProyecto
    )
    const modelos = candidatos(nivel, config, { preferir }).map(c => ({
      proveedor: c.proveedor,
      modelo: c.modelo,
      maximoMicro: costoMaximo(
        c.modelo,
        tokensEntrada,
        maxSalida,
        config.precios
      ),
    }))
    return {
      tokensEntrada,
      modelos,
      maximoMicro: Math.max(0, ...modelos.map(m => m.maximoMicro)),
    }
  }

  async function eventoPropio(userId, projectId, eventoId, funcion) {
    return Boolean(
      await c.eventos.findOne(
        {
          _id: eventoId,
          userId,
          projectId,
          estado: 'ok',
          ...(funcion && { funcion }),
        },
        { projection: { _id: 1 } }
      )
    )
  }

  // Ejecuta una función de IA. `alEscribir(texto)` recibe la respuesta en trozos.
  async function ejecutarConsulta({
    userId,
    funcion,
    entrada,
    preferir,
    alEscribir,
    senal,
    projectId,
    contextoProyecto,
    maximoAceptadoMicro,
  }) {
    if (!config.habilitada) throw error('deshabilitada')
    if (!(await activada(userId))) throw error('no_activada')
    const {
      def,
      sistema,
      mensajes,
      opciones = {},
      tokensEntrada,
      maxSalida: salidaPermitida,
      requiereConfirmacion,
      nivel,
    } = prepararConsulta(funcion, entrada, contextoProyecto)
    // Las consultas grandes (proyecto completo, PDF, varias páginas) exigen haber visto el costo.
    if (
      funcion === 'chat_proyecto' ||
      def.usaProyecto ||
      def.usaContexto ||
      requiereConfirmacion
    ) {
      const estimacion = estimar({
        funcion,
        entrada,
        contextoProyecto,
        preferir,
      })
      if (
        !Number.isSafeInteger(maximoAceptadoMicro) ||
        maximoAceptadoMicro < estimacion.maximoMicro
      ) {
        // Se devuelve la estimación nueva para que el panel la muestre y se vuelva a confirmar.
        const e = new ErrorIA(
          'estimacion',
          'El costo cambió desde la estimación (por ejemplo, porque cambió el archivo). Revisa el nuevo antes de consultar.'
        )
        e.estimacion = estimacion
        throw e
      }
    }

    const fecha = ahora()
    const creditoId = idCredito(userId, fecha)
    const motivos = new Set()

    for (const cand of candidatos(nivel, config, { preferir })) {
      const { gastadoMicro, reservadoMicro } = await saldos.leer(
        c.creditos,
        creditoId,
        { ahora: fecha }
      )
      const disponible =
        config.creditoMensualMicro - gastadoMicro - reservadoMicro
      const maxSalida = Math.min(
        salidaPermitida,
        salidaQueCabe(cand.modelo, tokensEntrada, disponible, config.precios)
      )
      if (maxSalida < def.minSalida) {
        motivos.add('sin_saldo')
        continue
      }
      const maximo = costoMaximo(
        cand.modelo,
        tokensEntrada,
        maxSalida,
        config.precios
      )
      const reservaCredito = await saldos.reservar(
        c.creditos,
        creditoId,
        maximo,
        config.creditoMensualMicro,
        {
          datos: { userId, ciclo: ciclo(fecha, 1).id },
          ahora: fecha,
        }
      )
      if (!reservaCredito) {
        motivos.add('sin_saldo')
        continue
      }
      const presupuestoId = idPresupuesto(cand.proveedor, fecha)
      const reservaPresupuesto = await saldos.reservar(
        c.presupuestos,
        presupuestoId,
        maximo,
        config.presupuestos[cand.proveedor].topeMicro,
        { datos: { proveedor: cand.proveedor }, ahora: fecha }
      )
      if (!reservaPresupuesto) {
        await saldos.liberar(c.creditos, creditoId, reservaCredito)
        motivos.add('sin_presupuesto')
        await alAgotarPresupuesto?.(cand.proveedor, presupuestoId)
        continue
      }

      let escrito = false
      let costoMicro = 0
      try {
        const resultado = streamText({
          model: crearModelo(cand),
          system: sistema,
          messages: mensajes,
          maxOutputTokens: maxSalida,
          maxRetries: 1,
          abortSignal: senal,
          // Los errores se tratan abajo (fullStream); sin esto el SDK los imprime en la consola.
          onError: () => {},
          ...((def.propuesta || def.esquema) && {
            output: def.esquema
              ? Output.object({
                  schema: jsonSchema(def.esquema),
                  name: 'respuesta_de_revision',
                })
              : SALIDA_CAMBIOS,
          }),
          providerOptions: combinarOpciones(
            // Que OpenAI no guarde las respuestas en su plataforma (Responses API).
            { openai: { store: false } },
            (def.propuesta || def.esquema) && {
              anthropic: { structuredOutputMode: 'outputFormat' },
            },
            opcionesDeEsfuerzo(cand),
            opciones.providerOptions
          ),
        })
        let errorStream
        for await (const parte of resultado.fullStream) {
          if (parte.type === 'text-delta') {
            escrito = true
            await alEscribir(parte.text)
          } else if (parte.type === 'error') {
            errorStream = parte.error
            break
          }
        }
        if (errorStream) throw errorStream
        const uso = await resultado.totalUsage
        costoMicro = costoReal(cand.modelo, uso, config.precios)
        await saldos.liquidar(c.creditos, creditoId, reservaCredito, costoMicro)
        await saldos.liquidar(
          c.presupuestos,
          presupuestoId,
          reservaPresupuesto,
          costoMicro
        )
        const eventoId = await registrarEvento({
          userId,
          ...(projectId ? { projectId } : {}),
          funcion,
          nivel,
          proveedor: cand.proveedor,
          modelo: cand.modelo,
          alternativa: preferir === 'alternativa',
          tokensEntrada: uso.inputTokens ?? 0,
          tokensCache: uso.inputTokenDetails?.cacheReadTokens ?? 0,
          tokensSalida: uso.outputTokens ?? 0,
          costoMicro,
          estado: 'ok',
        })
        return {
          eventoId,
          proveedor: cand.proveedor,
          modelo: cand.modelo,
          costoMicro,
          saldo: await saldo(userId),
        }
      } catch (err) {
        // Sin uso real conocido no se cobra al estudiante: el costo lo asume el programa.
        await saldos.liberar(c.creditos, creditoId, reservaCredito)
        await saldos.liberar(c.presupuestos, presupuestoId, reservaPresupuesto)
        const cancelada = senal?.aborted
        await registrarEvento({
          userId,
          ...(projectId ? { projectId } : {}),
          funcion,
          nivel,
          proveedor: cand.proveedor,
          modelo: cand.modelo,
          alternativa: preferir === 'alternativa',
          costoMicro: 0,
          estado: cancelada ? 'cancelada' : 'error',
        })
        if (cancelada) throw err
        // Si ya se mostró parte de la respuesta, no se mezcla con la de otro modelo.
        if (escrito) throw error('no_disponible')
        motivos.add('no_disponible')
      }
    }
    for (const codigo of ['no_disponible', 'sin_presupuesto', 'sin_saldo']) {
      if (motivos.has(codigo)) throw error(codigo)
    }
    throw error('no_disponible')
  }

  // Una consulta por estudiante entre pestañas y procesos, sin guardar contenido. Envuelve
  // también la preparación del contexto (PDF, Crossref, historial): es costosa para el servidor
  // aunque todavía no gaste crédito, y no debe correr en paralelo desde varias pestañas.
  async function conBloqueo(userId, fn) {
    if (!config.habilitada) throw error('deshabilitada')
    if (!(await activada(userId))) throw error('no_activada')
    const id = randomUUID()
    const fecha = ahora()
    const bloqueo = await c.usuarios.updateOne(
      {
        _id: userId,
        $or: [
          { consultaHasta: { $exists: false } },
          { consultaHasta: { $lte: fecha } },
        ],
      },
      {
        $set: {
          consultaId: id,
          consultaHasta: new Date(fecha.getTime() + saldos.RESERVA_MAX_MS),
        },
      }
    )
    if (!bloqueo.matchedCount)
      throw new ErrorIA(
        'ocupada',
        'Ya tienes una consulta en curso. Espera a que termine.'
      )
    try {
      return await fn()
    } finally {
      await c.usuarios.updateOne(
        { _id: userId, consultaId: id },
        { $unset: { consultaId: '', consultaHasta: '' } }
      )
    }
  }

  // `bloqueado`: el llamador ya tiene el bloqueo (conBloqueo) porque preparó el contexto dentro.
  async function consultar({ bloqueado, ...peticion }) {
    const ejecutar = () => {
      const limite = AbortSignal.timeout(10 * 60 * 1000)
      return ejecutarConsulta({
        ...peticion,
        senal: peticion.senal
          ? AbortSignal.any([peticion.senal, limite])
          : limite,
      })
    }
    if (bloqueado) {
      if (!config.habilitada) throw error('deshabilitada')
      return ejecutar()
    }
    return conBloqueo(peticion.userId, ejecutar)
  }

  async function valorar(userId, eventoId, valoracion) {
    if (![1, -1, null].includes(valoracion))
      throw new ErrorIA('entrada', 'valoración no válida')
    const { matchedCount } = await c.eventos.updateOne(
      { _id: eventoId, userId, estado: 'ok' },
      { $set: { valoracion } }
    )
    return matchedCount === 1
  }

  // Registro de uso de IA del proyecto: lo ven el estudiante y sus colaboradores.
  async function registrar(projectId, userId, eventoId, detalle = '') {
    const evento = await c.eventos.findOne({
      _id: eventoId,
      userId,
      estado: 'ok',
    })
    // Solo eventos de este proyecto: uno sin proyecto (soporte) tampoco se registra aquí.
    if (!evento || String(evento.projectId) !== String(projectId)) return false
    const def = definicion(evento.funcion)
    const resumen = [def.resumen(), String(detalle).trim().slice(0, 120)]
      .filter(Boolean)
      .join(': ')
    await c.registro.updateOne(
      { projectId, eventoId },
      {
        $setOnInsert: {
          projectId,
          eventoId,
          userId,
          funcion: evento.funcion,
          resumen,
          fecha: ahora(),
        },
      },
      { upsert: true }
    )
    return true
  }

  async function verRegistro(projectId) {
    return c.registro
      .find(
        { projectId },
        { projection: { _id: 0, userId: 1, funcion: 1, resumen: 1, fecha: 1 } }
      )
      .sort({ fecha: 1 })
      .limit(2000)
      .toArray()
  }

  async function vaciarRegistro(projectId) {
    await c.registro.deleteMany({ projectId })
  }

  return {
    estado,
    activar,
    saldo,
    consultar,
    conBloqueo,
    estimar,
    eventoPropio,
    valorar,
    registrar,
    verRegistro,
    vaciarRegistro,
    idPresupuesto,
  }
}
