import { readFile } from 'node:fs/promises'
import { funcion } from '../../services/web/modules/aemcicd-ai/app/src/funciones.mjs'
import { crearLectorProyecto } from '../../services/web/modules/aemcicd-ai/app/src/proyecto.mjs'

// Proyecto sintético: permite evaluar el mismo armado de contexto que usa el servidor, sin Mongo,
// sin leer proyectos reales y sin aceptar un bloque de contexto preparado por el navegador.
export async function prepararCaso(caso) {
  const nombre = caso.funcion || 'pregunta'
  const entrada = { ...(caso.entrada || { pregunta: caso.pregunta }) }
  if (caso.imagen)
    entrada.imagen = {
      base64: (await readFile(new URL(caso.imagen, import.meta.url))).toString(
        'base64'
      ),
    }
  const archivos = caso.archivos || {}
  const docs = Object.keys(archivos).map((name, i) => ({
    _id: String(i),
    name,
  }))
  const lector = crearLectorProyecto({
    obtenerProyecto: async () => ({
      rootDoc_id: docs.find(d => d.name === 'main.tex')?._id,
      rootFolder: [{ docs, folders: [] }],
    }),
    obtenerDocumento: async (_, id) => ({
      lines: archivos[docs[Number(id)].name].split('\n'),
      version: 1,
    }),
  })
  const contexto = await lector.preparar('evaluacion', nombre, entrada, 150000)
  const def = funcion(nombre)
  // La sesión permite validar la propuesta igual que el servidor (validarRespuesta).
  const sesion = await lector.abrir('evaluacion')
  return { def, contexto, sesion, ...def.preparar(entrada, contexto) }
}
