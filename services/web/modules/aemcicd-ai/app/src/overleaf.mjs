import ProjectGetter from '../../../../app/src/Features/Project/ProjectGetter.mjs'
import DocumentUpdaterHandler from '../../../../app/src/Features/DocumentUpdater/DocumentUpdaterHandler.mjs'
import EditorController from '../../../../app/src/Features/Editor/EditorController.mjs'
import { crearLectorProyecto } from './proyecto.mjs'

export const lectorProyecto = crearLectorProyecto({
  obtenerProyecto: id =>
    ProjectGetter.promises.getProject(id, { rootFolder: 1, rootDoc_id: 1 }),
  // -1: solo la versión actual. Sin este argumento document-updater rechaza la petición
  // (fromVersion=undefined) y ninguna función que lea el proyecto funciona.
  obtenerDocumento: (projectId, docId) =>
    DocumentUpdaterHandler.promises.getDocument(projectId, docId, -1),
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
