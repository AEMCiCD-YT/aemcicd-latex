import ProjectGetter from '../../../../app/src/Features/Project/ProjectGetter.mjs'
import DocumentUpdaterHandler from '../../../../app/src/Features/DocumentUpdater/DocumentUpdaterHandler.mjs'
import EditorController from '../../../../app/src/Features/Editor/EditorController.mjs'
import { crearLectorProyecto } from './proyecto.mjs'
import { ErrorEntrada } from './entrada.mjs'
import HistoryManager from '../../../../app/src/Features/History/HistoryManager.mjs'

export const lectorProyecto = crearLectorProyecto({
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
