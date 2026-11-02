import {
  useCodeMirrorViewContext,
  useCodeMirrorStateContext,
} from '@/features/source-editor/components/codemirror-context'
import { useEditorOpenDocContext } from '@/features/ide-react/context/editor-open-doc-context'
import { useFileTreePathContext } from '@/features/file-tree/contexts/file-tree-path'
import { useEditorPropertiesContext } from '@/features/ide-react/context/editor-properties-context'
import MaterialIcon from '@/shared/components/material-icon'
import getMeta from '@/utils/meta'
import { useSolicitudIA } from '../solicitud-context'

const ACCIONES = [
  ['mejorar', 'Mejorar redacción'],
  ['academico', 'Tono académico'],
  ['resumir', 'Resumir'],
  ['ampliar', 'Ampliar'],
  ['ingles', 'Traducir al inglés'],
  ['espanol', 'Traducir al español'],
]

export default function AccionesSeleccion() {
  const view = useCodeMirrorViewContext()
  const state = useCodeMirrorStateContext()
  const { currentDocumentId } = useEditorOpenDocContext()
  const { pathInFolder } = useFileTreePathContext()
  const { showVisual } = useEditorPropertiesContext()
  const { abrir, ocupado } = useSolicitudIA()
  const archivo = currentDocumentId && pathInFolder(currentDocumentId)
  if (
    !getMeta('ol-ExposedSettings')?.aemcicdAiEnabled ||
    showVisual ||
    !archivo ||
    state.selection.main.empty
  )
    return null
  return (
    <details className="aemcicd-ai-menu">
      <summary
        className="editor-floating-menu-button"
        aria-label="Reescribir con IA"
        title="Reescribir con IA"
      >
        <MaterialIcon type="smart_toy" />
      </summary>
      <div className="aemcicd-ai-menu-acciones">
        {['codigo_algoritmo', 'tutor_latex'].map(funcion => (
          <button
            key={funcion}
            type="button"
            disabled={ocupado}
            onClick={() => {
              const { from: desde, to: hasta } = view.state.selection.main
              abrir({
                funcion,
                titulo:
                  funcion === 'codigo_algoritmo'
                    ? 'Código a algoritmo'
                    : 'Aprender esta selección',
                entrada: {
                  archivo,
                  desde,
                  hasta,
                  seleccion: view.state.sliceDoc(desde, hasta),
                  pregunta:
                    funcion === 'codigo_algoritmo'
                      ? 'Convierte este código a pseudocódigo LaTeX con algorithm2e e indica los paquetes necesarios.'
                      : 'Explícame esta selección de LaTeX paso a paso y propón un ejercicio.',
                },
              })
            }}
          >
            {funcion === 'codigo_algoritmo'
              ? 'Código a algoritmo'
              : 'Aprender esta selección'}
          </button>
        ))}
        {ACCIONES.map(([accion, titulo]) => (
          <button
            key={accion}
            type="button"
            disabled={ocupado}
            onClick={() => {
              const { from: desde, to: hasta } = view.state.selection.main
              abrir({
                funcion: 'reescribir',
                titulo,
                entrada: {
                  accion,
                  archivo,
                  desde,
                  hasta,
                  seleccion: view.state.sliceDoc(desde, hasta),
                },
              })
            }}
          >
            {titulo}
          </button>
        ))}
      </div>
    </details>
  )
}
