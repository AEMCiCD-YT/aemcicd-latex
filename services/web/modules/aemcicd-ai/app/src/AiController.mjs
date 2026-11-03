import logger from '@overleaf/logger'
import Settings from '@overleaf/settings'
import { crearFirmador } from './token-soporte.mjs'
import { PLANTILLAS, plantilla } from './plantillas.mjs'
import ProjectCreationHandler from '../../../../app/src/Features/Project/ProjectCreationHandler.mjs'
import SessionManager from '../../../../app/src/Features/Authentication/SessionManager.mjs'
import { ObjectId } from '../../../../app/src/infrastructure/mongodb.mjs'
import { contexto } from './contexto.mjs'
import { ErrorEntrada, funcion as definicion } from './funciones.mjs'
import { ErrorIA } from './servicio.mjs'
import { aUsd } from './precios.mjs'
import {
  lectorProyecto,
  guardarGrafica,
  guardarDocumento,
} from './overleaf.mjs'
import {
  validarBibliografia,
  validarDocumento,
  verificarClavesCitas,
} from './fase3.mjs'
import { validarRespuesta, verificarCambio } from './cambios.mjs'
import { rutaSegura } from './datos.mjs'
import { validarComentarios, validarGrafica, textoFase2 } from './fase2.mjs'
import { prepararDeclaracion, AVISO_DECLARACION } from './declaracion.mjs'
import { resumenMensual } from './resumen.mjs'

// Versión del aviso de IA que el estudiante acepta al activar (cambia si cambian los términos).
export const VERSION_AVISO = '2026-11'

const firmadorSoporte = crearFirmador(
  Settings.security?.sessionSecret || undefined
)

const ESTADOS_HTTP = {
  deshabilitada: 503,
  no_activada: 403,
  sin_saldo: 402,
  sin_presupuesto: 503,
  no_disponible: 503,
  entrada: 400,
  ocupada: 409,
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
  const { funcion, entrada, preferir, maximoAceptadoMicro } = req.body || {}
  const projectId = new ObjectId(req.params.Project_id)
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
    const def = definicion(funcion)
    if ((funcion === 'foto_latex') !== req.path.endsWith('/foto'))
      throw new ErrorEntrada('La función no corresponde a esta ruta.')
    const estadoUsuario = await servicio.estado(userId)
    if (!estadoUsuario.habilitada || !estadoUsuario.activada)
      throw new ErrorEntrada('Activa la IA para consultar.')
    let textoPropuesta = ''
    let contextoProyecto
    const r = await servicio.conBloqueo(userId, async () => {
      contextoProyecto = await lectorProyecto.preparar(
        projectId,
        funcion,
        entrada,
        config.maxTokensProyecto
      )
      return servicio.consultar({
        bloqueado: true,
        userId,
        projectId,
        funcion: String(funcion || ''),
        entrada,
        contextoProyecto,
        maximoAceptadoMicro,
        preferir: preferir === 'alternativa' ? 'alternativa' : undefined,
        senal: control.signal,
        alEscribir: texto => {
          if (def.propuesta || def.respuesta) textoPropuesta += texto
          else linea({ tipo: 'texto', texto })
        },
      })
    })
    let propuesta = {}
    if (def.propuesta || def.respuesta) {
      try {
        if (def.respuesta === 'comentarios')
          propuesta = await validarComentarios(
            textoPropuesta,
            contextoProyecto,
            await lectorProyecto.abrir(projectId)
          )
        else if (def.respuesta === 'bibliografia')
          propuesta = await validarBibliografia(
            textoPropuesta,
            contextoProyecto,
            await lectorProyecto.abrir(projectId)
          )
        else if (def.respuesta === 'documento')
          propuesta = validarDocumento(
            textoPropuesta,
            funcion,
            String(r.eventoId)
          )
        else if (def.respuesta === 'grafica')
          propuesta = validarGrafica(
            textoPropuesta,
            contextoProyecto.datosGrafica ?? entrada?.seleccion,
            String(r.eventoId)
          )
        else
          propuesta = await validarRespuesta(
            textoPropuesta,
            contextoProyecto,
            await lectorProyecto.abrir(projectId),
            funcion,
            { agrupar: false }
          )
        if (funcion === 'citas_faltantes')
          propuesta = verificarClavesCitas(propuesta, contextoProyecto)
      } catch (err) {
        propuesta = {
          explicacion: '',
          cambios: [],
          aviso:
            err instanceof ErrorEntrada
              ? err.message
              : 'No se pudo verificar la propuesta. Vuelve a intentarlo; el costo mostrado corresponde a la consulta realizada.',
        }
      }
    }
    linea({
      tipo: 'fin',
      eventoId: String(r.eventoId),
      proveedor: r.proveedor,
      modelo: r.modelo,
      costo: aUsd(r.costoMicro),
      saldo: saldoJson(r.saldo),
      ...propuesta,
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
      // Los errores del SDK o de Overleaf pueden adjuntar el contenido de una petición.
      logger.error({ userId }, 'aemcicd-ai: error en la consulta')
      linea({
        tipo: 'error',
        codigo: 'interno',
        mensaje: 'Algo falló. Inténtalo de nuevo.',
      })
    }
  }
  res.end()
}

async function estimar(req, res) {
  const { servicio, config } = await contexto()
  if (!config.habilitada || !permitido(req, config)) return res.sendStatus(503)
  const e = await servicio.estado(usuario(req))
  if (!e.activada)
    return res.status(403).json({ mensaje: 'Activa la IA para usarla.' })
  const nombre = req.body?.funcion
  if (
    nombre !== 'chat_proyecto' &&
    !definicion(nombre).usaProyecto &&
    !definicion(nombre).usaContexto
  )
    throw new ErrorEntrada('Solo se estima la consulta del proyecto completo.')
  // Dentro del bloqueo: preparar lee PDF, historial o Crossref y no debe correr en paralelo.
  const estimacion = await servicio.conBloqueo(usuario(req), async () => {
    const contextoProyecto = await lectorProyecto.preparar(
      new ObjectId(req.params.Project_id),
      nombre,
      req.body.entrada,
      config.maxTokensProyecto
    )
    return servicio.estimar({
      funcion: nombre,
      entrada: req.body.entrada,
      contextoProyecto,
      preferir: req.body.preferir,
    })
  })
  res.json(estimacion)
}

async function instrucciones(req, res) {
  const { config } = await contexto()
  if (!config.habilitada || !permitido(req, config)) return res.sendStatus(503)
  res.json(
    await lectorProyecto.instrucciones(new ObjectId(req.params.Project_id))
  )
}

async function crearInstrucciones(req, res) {
  const { config } = await contexto()
  if (!config.habilitada || !permitido(req, config)) return res.sendStatus(503)
  res.json(
    await lectorProyecto.crearInstrucciones(
      new ObjectId(req.params.Project_id),
      usuario(req)
    )
  )
}

async function validarCambio(req, res) {
  const { servicio, config } = await contexto()
  if (!config.habilitada || !permitido(req, config)) return res.sendStatus(503)
  const projectId = new ObjectId(req.params.Project_id)
  const eventoId = idValido(req.body?.eventoId)
  if (req.body?.tipo === 'declaracion') {
    const sesion = await lectorProyecto.abrir(projectId)
    const doc = await sesion.leer(req.body?.cambio?.archivo)
    const esperado = prepararDeclaracion(
      doc,
      await servicio.verRegistro(projectId),
      req.body.retirar === true
    )
    if (
      esperado.antes !== req.body.cambio.antes ||
      esperado.despues !== req.body.cambio.despues
    )
      throw new ErrorEntrada(
        'La declaración o el registro cambió. Vuelve a generarla.'
      )
    return res.json(await verificarCambio(esperado, sesion))
  }
  if (
    !eventoId ||
    !(await servicio.eventoPropio(usuario(req), projectId, eventoId))
  )
    return res.sendStatus(404)
  res.json(
    await verificarCambio(
      req.body?.cambio,
      await lectorProyecto.abrir(projectId)
    )
  )
}

async function declaracion(req, res) {
  const { servicio, config } = await contexto()
  if (!config.habilitada || !permitido(req, config)) return res.sendStatus(503)
  const projectId = new ObjectId(req.params.Project_id)
  const sesion = await lectorProyecto.abrir(projectId)
  const principal = [...sesion.documentos.values()].find(
    d => d.id === String(sesion.proyecto.rootDoc_id)
  )
  if (!principal)
    throw new ErrorEntrada(
      'Selecciona un documento principal antes de generar la declaración.'
    )
  const doc = await sesion.leer(principal.ruta)
  res.json({
    cambio: prepararDeclaracion(
      doc,
      await servicio.verRegistro(projectId),
      req.body?.retirar === true
    ),
    aviso: AVISO_DECLARACION,
  })
}

async function validarComentario(req, res) {
  const { servicio, config } = await contexto()
  if (!config.habilitada || !permitido(req, config)) return res.sendStatus(503)
  const projectId = new ObjectId(req.params.Project_id)
  const eventoId = idValido(req.body?.eventoId)
  if (
    !eventoId ||
    !(await servicio.eventoPropio(usuario(req), projectId, eventoId))
  )
    return res.sendStatus(404)
  const sesion = await lectorProyecto.abrir(projectId)
  const c = req.body?.comentario
  if (!c || typeof c !== 'object')
    throw new ErrorEntrada('Falta el comentario que hay que validar.')
  const doc = await sesion.leer(c.archivo)
  const validada = await validarComentarios(
    JSON.stringify({
      explicacion: '',
      comentarios: [
        { archivo: c.archivo, cita: c.cita, comentario: c.comentario },
      ],
    }),
    { documentos: [doc] },
    sesion
  )
  res.json(validada.comentarios[0])
}

async function guardarScript(req, res) {
  const { servicio, config } = await contexto()
  if (!config.habilitada || !permitido(req, config)) return res.sendStatus(503)
  const projectId = new ObjectId(req.params.Project_id)
  const eventoId = idValido(req.body?.eventoId)
  if (
    !eventoId ||
    !(await servicio.eventoPropio(
      usuario(req),
      projectId,
      eventoId,
      'grafica_datos'
    ))
  )
    return res.sendStatus(404)
  const archivo = `graficas/grafica-${eventoId}.py`
  const resultado = await guardarGrafica(
    projectId,
    usuario(req),
    archivo,
    req.body?.script
  )
  await servicio.registrar(projectId, usuario(req), eventoId, archivo)
  res.json(resultado)
}

async function plantillas(req, res) {
  res.json({ plantillas: PLANTILLAS.map(({ id, nombre }) => ({ id, nombre })) })
}
async function crearDesdePlantilla(req, res) {
  const p = plantilla(req.params.plantilla)
  if (!p) throw new ErrorEntrada('Elige una plantilla del programa.')
  const proyecto =
    await ProjectCreationHandler.promises.createProjectFromSnippet(
      usuario(req),
      p.nombre,
      p.contenido.split('\n')
    )
  res.json({ projectId: String(proyecto._id) })
}

async function crearBib(req, res) {
  const { config } = await contexto()
  if (!config.habilitada || !permitido(req, config)) return res.sendStatus(503)
  const projectId = new ObjectId(req.params.Project_id)
  const s = await lectorProyecto.abrir(projectId)
  if (s.archivos.has('referencias.bib'))
    throw new ErrorEntrada('Ya existe un archivo subido con ese nombre.')
  if (s.documentos.has('referencias.bib'))
    return res.json({
      id: (await s.leer('referencias.bib')).id,
      archivo: 'referencias.bib',
    })
  const { default: EditorController } =
    await import('../../../../app/src/Features/Editor/EditorController.mjs')
  const doc = await EditorController.promises.addDoc(
    projectId,
    s.proyecto.rootFolder[0]._id,
    'referencias.bib',
    ['% Añade y revisa aquí tus referencias bibliográficas.'],
    'aemcicd-ai',
    usuario(req)
  )
  res.json({ id: String(doc._id), archivo: 'referencias.bib' })
}

async function archivosFase3(req, res) {
  const { config } = await contexto()
  if (!config.habilitada || !permitido(req, config)) return res.sendStatus(503)
  const s = await lectorProyecto.abrir(new ObjectId(req.params.Project_id))
  res.setHeader('Cache-Control', 'no-store')
  res.json({
    pdfs: [...s.archivos.keys()].filter(r => /\.pdf$/i.test(r)),
    bibliografias: [...s.documentos.keys()].filter(r => /\.bib$/i.test(r)),
  })
}

async function guardarGenerado(req, res) {
  const { servicio, config } = await contexto()
  if (!config.habilitada || !permitido(req, config)) return res.sendStatus(503)
  const projectId = new ObjectId(req.params.Project_id)
  const eventoId = idValido(req.body?.eventoId)
  const tipo = req.body?.funcion
  if (
    !['beamer', 'poster', 'codigo_algoritmo'].includes(tipo) ||
    !eventoId ||
    !(await servicio.eventoPropio(usuario(req), projectId, eventoId, tipo))
  )
    return res.sendStatus(404)
  const resultado = await guardarDocumento(
    projectId,
    usuario(req),
    tipo,
    String(eventoId),
    req.body?.contenido
  )
  await servicio.registrar(projectId, usuario(req), eventoId, resultado.archivo)
  res.json(resultado)
}

async function soporteSesion(req, res) {
  const { servicio, config } = await contexto()
  if (!permitido(req, config))
    return res.status(503).json({ habilitada: false })
  res.setHeader('Cache-Control', 'no-store')
  const e = await servicio.estado(usuario(req))
  res.json({
    habilitada: e.habilitada,
    activada: e.activada,
    saldo: saldoJson(e.saldo),
    // Se llama «csrf» por compatibilidad con la plataforma, pero NO es el token CSRF de la sesión
    // de Overleaf: es un token propio, válido solo para POST /aemcicd-ai/soporte (ver
    // token-soporte.mjs).
    csrf: firmadorSoporte.crear(usuario(req)),
  })
}

async function soporte(req, res) {
  const { servicio, config } = await contexto()
  if (!permitido(req, config)) return res.sendStatus(503)
  // Ruta fuera de la protección CSRF general: se exige el token propio del soporte.
  if (!firmadorSoporte.valido(usuario(req), req.get('X-Csrf-Token')))
    return res.status(403).json({
      mensaje: 'La sesión de soporte venció. Vuelve a conectar.',
    })
  // Mismo crédito y proveedores del estudiante, sin proyecto ni datos de cuentas.
  res.setHeader('Cache-Control', 'no-store')
  let texto = ''
  const control = new AbortController()
  res.on('close', () => {
    if (!res.writableFinished) control.abort()
  })
  const r = await servicio.consultar({
    userId: usuario(req),
    funcion: 'soporte',
    entrada: { pregunta: textoFase2(req.body?.pregunta, 4000, 'La pregunta') },
    senal: control.signal,
    alEscribir: t => {
      texto += t
    },
  })
  res.json({ texto, costo: aUsd(r.costoMicro), saldo: saldoJson(r.saldo) })
}

async function resumen(req, res) {
  if (!SessionManager.getSessionUser(req.session)?.isAdmin)
    return res.sendStatus(403)
  const { c, config } = await contexto()
  const mes = req.query?.mes
  if (mes && !/^\d{4}-(0[1-9]|1[0-2])$/.test(mes))
    throw new ErrorEntrada('El mes debe tener el formato AAAA-MM.')
  res.setHeader('Cache-Control', 'no-store')
  res.json(
    await resumenMensual(
      c,
      config,
      mes ? new Date(`${mes}-15T12:00:00-05:00`) : new Date()
    )
  )
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
  const detalle = rutaSegura(req.body?.detalle)
  // El registro guarda solo la ruta de un documento propio, nunca texto libre del navegador.
  const sesion = await lectorProyecto.abrir(new ObjectId(req.params.Project_id))
  if (!sesion.documentos.has(detalle))
    throw new ErrorEntrada('El archivo no pertenece a este proyecto.')
  const ok = await servicio.registrar(
    new ObjectId(req.params.Project_id),
    usuario(req),
    eventoId,
    detalle
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
      logger.error({}, 'aemcicd-ai: error interno sin contenido de la petición')
      res
        .status(500)
        .json({ codigo: 'interno', mensaje: 'Algo falló. Inténtalo de nuevo.' })
    })
  }
}

export default {
  crearBib: manejar(crearBib),
  plantillas: manejar(plantillas),
  crearDesdePlantilla: manejar(crearDesdePlantilla),
  archivosFase3: manejar(archivosFase3),
  guardarGenerado: manejar(guardarGenerado),
  estado: manejar(estado),
  activar: manejar(activar),
  consultar: manejar(consultar),
  estimar: manejar(estimar),
  instrucciones: manejar(instrucciones),
  crearInstrucciones: manejar(crearInstrucciones),
  validarCambio: manejar(validarCambio),
  declaracion: manejar(declaracion),
  validarComentario: manejar(validarComentario),
  guardarScript: manejar(guardarScript),
  soporteSesion: manejar(soporteSesion),
  soporte: manejar(soporte),
  resumen: manejar(resumen),
  valorar: manejar(valorar),
  registrar: manejar(registrar),
  verRegistro: manejar(verRegistro),
  vaciarRegistro: manejar(vaciarRegistro),
}
