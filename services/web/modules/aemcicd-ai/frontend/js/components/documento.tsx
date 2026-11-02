import { useState } from 'react'
import OLButton from '@/shared/components/ol/ol-button'
import { useProjectContext } from '@/shared/context/project-context'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import { guardarDocumento } from '../api'

export default function Documento({
  documento,
  eventoId,
}: {
  documento: { archivo: string; contenido: string }
  eventoId: string
}) {
  const { projectId } = useProjectContext()
  const { write } = usePermissionsContext()
  const { openDocWithId } = useEditorManagerContext()
  const [estado, setEstado] = useState('')
  const [descartado, setDescartado] = useState(false)
  const [error, setError] = useState('')
  if (descartado) return <p>Documento descartado.</p>
  const tipo = documento.archivo.split('/')[1]?.startsWith('beamer-')
    ? 'beamer'
    : documento.archivo.split('/')[1]?.startsWith('codigo_algoritmo-')
      ? 'codigo_algoritmo'
      : 'poster'
  return (
    <div className="aemcicd-ai-propuesta">
      <p>{documento.archivo}</p>
      <pre>
        <code>{documento.contenido}</code>
      </pre>
      {write && estado !== 'guardado' && (
        <OLButton
          size="sm"
          variant="primary"
          disabled={estado === 'guardando'}
          onClick={async () => {
            setEstado('guardando')
            setError('')
            try {
              const r = await guardarDocumento(
                projectId,
                eventoId,
                tipo,
                documento.contenido
              )
              setEstado('guardado')
              await openDocWithId(r.id)
            } catch {
              setError(
                'No se pudo guardar el archivo. Si ya existe y cambió, no se sobrescribe.'
              )
              setEstado('')
            }
          }}
        >
          Guardar como archivo nuevo
        </OLButton>
      )}
      {estado !== 'guardado' && (
        <OLButton
          size="sm"
          variant="secondary"
          disabled={estado === 'guardando'}
          onClick={() => setDescartado(true)}
        >
          Descartar
        </OLButton>
      )}
      {estado === 'guardado' && (
        <p role="status">
          Archivo guardado. Compílalo antes de usarlo; puedes elegirlo como
          documento principal en Opciones.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
