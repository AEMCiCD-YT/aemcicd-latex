import ProjectGetter from '../../../../app/src/Features/Project/ProjectGetter.mjs'
import DocumentUpdaterHandler from '../../../../app/src/Features/DocumentUpdater/DocumentUpdaterHandler.mjs'
import EditorController from '../../../../app/src/Features/Editor/EditorController.mjs'
import { crearLectorProyecto } from './proyecto.mjs'
import { ErrorEntrada } from './entrada.mjs'
import HistoryManager from '../../../../app/src/Features/History/HistoryManager.mjs'

import Settings from '@overleaf/settings'
import { fetchJson } from '@overleaf/fetch-utils'
import { crearBibliografia } from './bibliografia.mjs'
import { leerHistorial } from './historial.mjs'
import { MAX_PDF_BYTES } from './pdf-proyecto.mjs'

async function leerBinario(projectId, archivo) {
  const { stream, contentLength } =
    await HistoryManager.promises.requestBlobWithProjectId(
      projectId,
      archivo.hash
    )
  if (contentLength > MAX_PDF_BYTES) {
    stream.destroy()
    throw new ErrorEntrada('El PDF supera 10 MiB.')
  }
  const partes = []
  let bytes = 0
  for await (const parte of stream) {
    bytes += parte.length
    if (bytes > MAX_PDF_BYTES) {
      stream.destroy()
      throw new ErrorEntrada('El PDF supera 10 MiB.')
    }
    partes.push(parte)
  }
  return Buffer.concat(partes)
}

async function consultarHistorial(projectId, accion, parametros) {
  const url = new URL(
    `/project/${projectId}/${accion}`,
    Settings.apis.project_history.url
  )
  for (const [k, v] of Object.entries(parametros))
    url.searchParams.set(k, String(v))
  try {
    return await fetchJson(url, { signal: AbortSignal.timeout(20000) })
  } catch {
    throw new ErrorEntrada(
      'No se pudo leer ese intervalo del Historial. Elige versiones disponibles.'
    )
  }
}

export const lectorProyecto = crearLectorProyecto({
  obtenerArchivoBinario: leerBinario,
  obtenerHistorial: (projectId, entrada) =>
    leerHistorial(projectId, entrada, consultarHistorial),
  buscarBibliografia: crearBibliografia(),
  obtenerProyecto: id =>
    ProjectGetter.promises.getProject(id, { rootFolder: 1, rootDoc_id: 1 }),
  // -1: solo la versión actual. Sin este argumento document-updater rechaza la petición
  // (fromVersion=undefined) y ninguna función que lea el proyecto funciona.
  obtenerDocumento: (projectId, docId) =>
    DocumentUpdaterHandler.promises.getDocument(projectId, docId, -1),
  // CSV/TSV normalmente son fileRefs, no documentos editables. Mismo almacén que la descarga ZIP.
  obtenerArchivo: async (projectId, archivo) => {
    const { stream } = await HistoryManager.promises.requestBlobWithProjectId(
      projectId,
      archivo.hash
    )
    const partes = []
    let bytes = 0
    for await (const parte of stream) {
      bytes += parte.length
      if (bytes > 150000) {
        stream.destroy()
        throw new ErrorEntrada(
          'Reduce los datos a 50 000 caracteres antes de consultar.'
        )
      }
      partes.push(parte)
    }
    let texto
    try {
      texto = new TextDecoder('utf-8', { fatal: true }).decode(
        Buffer.concat(partes)
      )
    } catch {
      throw new ErrorEntrada('El archivo de datos debe ser texto UTF-8.')
    }
    if (texto.includes('\0'))
      throw new ErrorEntrada('El archivo de datos no es texto válido.')
    return texto
  },
  crearDocumento: (projectId, folderId, nombre, lineas, userId) =>
    EditorController.promises.addDoc(
      projectId,
      folderId,
      nombre,
      lineas,
      'aemcicd-ai',
      userId
    ),
})

// Creación idempotente por la misma vía del árbol de archivos; nunca se sobrescribe un script.
export async function guardarGrafica(projectId, userId, archivo, script) {
  if (
    !/^graficas\/grafica-[a-f\d]{24}\.py$/.test(archivo) ||
    typeof script !== 'string' ||
    !script.trim() ||
    script.length > 90000
  )
    throw new ErrorEntrada('El script de la gráfica no es válido.')
  const sesion = await lectorProyecto.abrir(projectId)
  if (sesion.documentos.has(archivo)) {
    const doc = await sesion.leer(archivo)
    if (doc.texto !== script)
      throw new ErrorEntrada(
        'El script ya existe y fue modificado; no se sobrescribió.'
      )
    return { id: doc.id, archivo }
  }
  const raiz = sesion.proyecto.rootFolder[0]
  let carpeta = (raiz.folders || []).find(f => f.name === 'graficas')
  if (!carpeta)
    carpeta = await EditorController.promises.addFolder(
      projectId,
      raiz._id,
      'graficas',
      'aemcicd-ai',
      userId
    )
  const doc = await EditorController.promises.addDoc(
    projectId,
    carpeta._id,
    archivo.split('/')[1],
    script.split('\n'),
    'aemcicd-ai',
    userId
  )
  return { id: String(doc._id), archivo }
}

// Archivo nuevo por el mismo canal del editor; nunca modifica el documento original.
export async function guardarDocumento(
  projectId,
  userId,
  tipo,
  eventoId,
  contenido
) {
  const { validarDocumento } = await import('./fase3.mjs')
  const { documento } = validarDocumento(
    JSON.stringify({ explicacion: '', contenido }),
    tipo,
    eventoId
  )
  const sesion = await lectorProyecto.abrir(projectId)
  if (sesion.documentos.has(documento.archivo)) {
    const doc = await sesion.leer(documento.archivo)
    if (doc.texto !== contenido)
      throw new ErrorEntrada(
        'El archivo generado ya fue modificado; no se sobrescribió.'
      )
    return { id: doc.id, archivo: documento.archivo }
  }
  const raiz = sesion.proyecto.rootFolder[0]
  let carpeta = (raiz.folders || []).find(f => f.name === 'ia-generados')
  if (!carpeta)
    carpeta = await EditorController.promises.addFolder(
      projectId,
      raiz._id,
      'ia-generados',
      'aemcicd-ai',
      userId
    )
  const doc = await EditorController.promises.addDoc(
    projectId,
    carpeta._id,
    documento.archivo.split('/')[1],
    contenido.split('\n'),
    'aemcicd-ai',
    userId
  )
  return { id: String(doc._id), archivo: documento.archivo }
}
