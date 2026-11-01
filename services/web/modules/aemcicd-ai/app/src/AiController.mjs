import logger from '@overleaf/logger'
import SessionManager from '../../../../app/src/Features/Authentication/SessionManager.mjs'
import { ObjectId } from '../../../../app/src/infrastructure/mongodb.mjs'
import { contexto } from './contexto.mjs'
import { ErrorEntrada } from './funciones.mjs'
import { ErrorIA } from './servicio.mjs'
import { aUsd } from './precios.mjs'

// Versión del aviso de IA que el estudiante acepta al activar (cambia si cambian los términos).
export const VERSION_AVISO = '2026-11'

const ESTADOS_HTTP = {
  deshabilitada: 503,
  no_activada: 403,
  sin_saldo: 402,
  sin_presupuesto: 503,
  no_disponible: 503,
  entrada: 400,
}

function usuario(req) {
  return new ObjectId(SessionManager.getLoggedInUserId(req.session))
}

// Con AEMCICD_AI_ONLY_ADMINS=true, para el resto de cuentas la IA está deshabilitada.
function permitido(req, config) {
  return (
    !config.soloAdmins ||
    Boolean(SessionManager.getSessionUser(req.session)?.isAdmin)
  )
}

function idValido(texto) {
  return typeof texto === 'string' && ObjectId.isValid(texto)
    ? new ObjectId(texto)
    : null
}

function saldoJson(saldo) {
  if (!saldo) return null
  return {
    credito: aUsd(saldo.creditoMicro),
    gastado: aUsd(saldo.gastadoMicro),
    disponible: aUsd(saldo.disponibleMicro),
    renuevaEl: saldo.renuevaEl,
  }
}

async function estado(req, res) {
  const { servicio, config } = await contexto()
  if (!permitido(req, config)) {
    return res.json({
      habilitada: false,
      activada: false,
      saldo: null,
      versionAviso: VERSION_AVISO,
    })
  }
  const e = await servicio.estado(usuario(req))
  res.json({
    habilitada: e.habilitada,
    activada: e.activada,
    saldo: saldoJson(e.saldo),
    versionAviso: VERSION_AVISO,
  })
}

async function activar(req, res) {
  const { servicio, config } = await contexto()
  if (!config.habilitada || !permitido(req, config))
    return res.status(503).json({ codigo: 'deshabilitada' })
  if (req.body?.aviso !== VERSION_AVISO)
    return res.status(400).json({ codigo: 'entrada' })
  await servicio.activar(usuario(req), VERSION_AVISO)
  res.sendStatus(204)
}

// Responde en NDJSON: una línea {"tipo":"texto","texto":…} por trozo y al final
// {"tipo":"fin",…} o {"tipo":"error","codigo":…,"mensaje":…}.
async function consultar(req, res) {
  const { servicio, config } = await contexto()
  if (!permitido(req, config))
    return res.status(503).json({ codigo: 'deshabilitada' })
  const userId = usuario(req)
  const { funcion, entrada, preferir } = req.body || {}
  const control = new AbortController()
  res.on('close', () => {
    if (!res.writableFinished) control.abort()
  })
  res.status(200)
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Accel-Buffering', 'no')
  const linea = obj => res.write(JSON.stringify(obj) + '\n')
  try {
    const r = await servicio.consultar({
      userId,
      funcion: String(funcion || ''),
      entrada,
      preferir: preferir === 'alternativa' ? 'alternativa' : undefined,
      senal: control.signal,
      alEscribir: texto => linea({ tipo: 'texto', texto }),
    })
    linea({
      tipo: 'fin',
      eventoId: String(r.eventoId),
      proveedor: r.proveedor,
      modelo: r.modelo,
      costo: aUsd(r.costoMicro),
      saldo: saldoJson(r.saldo),
    })
  } catch (err) {
    if (control.signal.aborted) return res.end()
    if (err instanceof ErrorIA || err instanceof ErrorEntrada) {
      linea({
        tipo: 'error',
        codigo: err.codigo || 'entrada',
        mensaje: err.message,
      })
    } else {
      logger.error({ err, userId }, 'aemcicd-ai: error en la consulta')
      linea({
        tipo: 'error',
        codigo: 'interno',
        mensaje: 'Algo falló. Inténtalo de nuevo.',
      })
    }
  }
  res.end()
}

async function valorar(req, res) {
  const { servicio } = await contexto()
  const eventoId = idValido(req.params.eventoId)
  const valor = req.body?.valoracion ?? null
  if (!eventoId || ![1, -1, null].includes(valor))
    return res.status(400).json({ codigo: 'entrada' })
  const ok = await servicio.valorar(usuario(req), eventoId, valor)
  res.sendStatus(ok ? 204 : 404)
}

async function registrar(req, res) {
  const { servicio } = await contexto()
  const eventoId = idValido(req.body?.eventoId)
  if (!eventoId) return res.status(400).json({ codigo: 'entrada' })
  const ok = await servicio.registrar(
    new ObjectId(req.params.Project_id),
    usuario(req),
    eventoId,
    typeof req.body?.detalle === 'string' ? req.body.detalle : ''
  )
  res.sendStatus(ok ? 204 : 404)
}

async function verRegistro(req, res) {
  const { servicio } = await contexto()
  res.json({
    registro: await servicio.verRegistro(new ObjectId(req.params.Project_id)),
  })
}

async function vaciarRegistro(req, res) {
  const { servicio } = await contexto()
  await servicio.vaciarRegistro(new ObjectId(req.params.Project_id))
  res.sendStatus(204)
}

function manejar(fn) {
  return (req, res, next) => {
    fn(req, res).catch(err => {
      if (err instanceof ErrorIA || err instanceof ErrorEntrada) {
        return res
          .status(ESTADOS_HTTP[err.codigo] || 400)
          .json({ codigo: err.codigo, mensaje: err.message })
      }
      next(err)
    })
  }
}

export default {
  estado: manejar(estado),
  activar: manejar(activar),
  consultar: manejar(consultar),
  valorar: manejar(valorar),
  registrar: manejar(registrar),
  verRegistro: manejar(verRegistro),
  vaciarRegistro: manejar(vaciarRegistro),
}
