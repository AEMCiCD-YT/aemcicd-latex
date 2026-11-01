import { useLayoutEffect, useRef, useState } from 'react'
import { useProjectContext } from '@/shared/context/project-context'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import { useEditorOpenDocContext } from '@/features/ide-react/context/editor-open-doc-context'
import OLButton from '@/shared/components/ol/ol-button'
import { Cambio, registrar, validarCambio } from '../api'
import { aplicarEnEditor } from '../aplicar'

export default function Propuesta({
  cambio,
  eventoId,
}: {
  cambio: Cambio
  eventoId: string
}) {
  const { projectId } = useProjectContext()
  const permisos = usePermissionsContext()
  const { currentDocument } = useEditorOpenDocContext()
  const { openDocWithId } = useEditorManagerContext()
  const actual = useRef({ currentDocument, permisos })
  useLayoutEffect(() => {
    actual.current = { currentDocument, permisos }
  }, [currentDocument, permisos])
  const [estado, setEstado] = useState<
    'pendiente' | 'aplicando' | 'aplicada' | 'descartada'
  >('pendiente')
  const [error, setError] = useState('')
  const [registroPendiente, setRegistroPendiente] = useState(false)

  const guardarRegistro = async () => {
    try {
      await registrar(projectId, eventoId, cambio.archivo)
      setRegistroPendiente(false)
      setError('')
    } catch {
      setRegistroPendiente(true)
      setError('El cambio se aplicó, pero no se pudo registrar su uso de IA.')
    }
  }

  const aplicar = async () => {
    if (estado !== 'pendiente') return
    setEstado('aplicando')
    setError('')
    try {
      await validarCambio(projectId, eventoId, cambio)
      await openDocWithId(cambio.docId)
      // Abrir un archivo requiere montar el editor y unirlo a ShareJS antes de despachar.
      const limite = Date.now() + 5000
      while (
        (actual.current.currentDocument?.doc_id !== cambio.docId ||
          !actual.current.currentDocument?.cm6) &&
        Date.now() < limite
      )
        await new Promise(r => setTimeout(r, 20))
      const doc = actual.current.currentDocument
      const view = doc?.cm6?.view
      if (!view || !doc || doc.doc_id !== cambio.docId)
        throw new Error('No se pudo abrir el archivo. Inténtalo de nuevo.')
      await aplicarEnEditor(
        view,
        cambio,
        () =>
          actual.current.permisos.write &&
          actual.current.currentDocument === doc
      )
      setEstado('aplicada')
      await guardarRegistro()
    } catch (err) {
      setEstado('pendiente')
      const datos = (err as { data?: { mensaje?: string } }).data
      setError(
        datos?.mensaje ||
          (err as Error).message ||
          'No se pudo aplicar el cambio.'
      )
    }
  }

  return (
    <div className="aemcicd-ai-propuesta">
      <strong>{cambio.archivo}</strong>
      <details>
        <summary>Ver diferencias</summary>
        <div className="aemcicd-ai-diferencia">
          <span>Antes</span>
          <pre>{cambio.antes || '(inserción)'}</pre>
        </div>
        <div className="aemcicd-ai-diferencia">
          <span>Después</span>
          <pre>{cambio.despues || '(eliminar)'}</pre>
        </div>
      </details>
      {estado === 'pendiente' || estado === 'aplicando' ? (
        <div className="aemcicd-ai-acciones">
          {permisos.write && (
            <OLButton
              size="sm"
              variant="primary"
              isLoading={estado === 'aplicando'}
              onClick={aplicar}
            >
              Aplicar
            </OLButton>
          )}
          <OLButton
            size="sm"
            variant="secondary"
            disabled={estado === 'aplicando'}
            onClick={() => setEstado('descartada')}
          >
            Descartar
          </OLButton>
        </div>
      ) : (
        <p role="status">
          {estado === 'aplicada' ? 'Cambio aplicado.' : 'Propuesta descartada.'}
        </p>
      )}
      {error && (
        <p className="aemcicd-ai-error" role="alert">
          {error}
        </p>
      )}
      {registroPendiente && (
        <OLButton size="sm" variant="link" onClick={guardarRegistro}>
          Reintentar registro
        </OLButton>
      )}
    </div>
  )
}
