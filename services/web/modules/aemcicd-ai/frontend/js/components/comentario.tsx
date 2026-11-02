import { useLayoutEffect, useRef, useState } from 'react'
import { useProjectContext } from '@/shared/context/project-context'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import { useEditorOpenDocContext } from '@/features/ide-react/context/editor-open-doc-context'
import { useRailContext } from '@/features/ide-react/context/rail-context'
import { useUserContext } from '@/shared/context/user-context'
import OLButton from '@/shared/components/ol/ol-button'
import Markdown from './markdown'
import { ComentarioIA, validarComentario, registrar } from '../api'
import { comentarIA } from '../comentarios'

export default function Comentario({
  comentario,
  eventoId,
}: {
  comentario: ComentarioIA
  eventoId: string
}) {
  const { projectId } = useProjectContext()
  const permisos = usePermissionsContext()
  const { openDocWithId } = useEditorManagerContext()
  const { currentDocument } = useEditorOpenDocContext()
  const { openTab } = useRailContext()
  const user = useUserContext()
  const actual = useRef(currentDocument)
  useLayoutEffect(() => {
    actual.current = currentDocument
  }, [currentDocument])
  const [estado, setEstado] = useState<
    'pendiente' | 'añadiendo' | 'lista' | 'descartada'
  >('pendiente')
  const [error, setError] = useState('')
  const [registroPendiente, setRegistroPendiente] = useState(false)
  async function registrarUso() {
    try {
      await registrar(projectId, eventoId, comentario.archivo)
      setRegistroPendiente(false)
    } catch {
      setRegistroPendiente(true)
    }
  }
  async function añadir() {
    if (estado !== 'pendiente' || !permisos.write || !permisos.comment) return
    setEstado('añadiendo')
    setError('')
    let publicada = false
    try {
      const c = await validarComentario(projectId, eventoId, comentario)
      await openDocWithId(c.docId)
      const limite = Date.now() + 5000
      while (
        (actual.current?.doc_id !== c.docId || !actual.current?.cm6) &&
        Date.now() < limite
      )
        await new Promise(r => setTimeout(r, 20))
      const doc = actual.current
      if (!doc || doc.doc_id !== c.docId)
        throw new Error('No se pudo abrir el documento.')
      const nombre =
        [user.first_name, user.last_name].filter(Boolean).join(' ') ||
        'el estudiante'
      await comentarIA(
        projectId,
        doc,
        c.desde,
        c.cita,
        `IA, pedido por ${nombre}.\n\n${c.comentario}`
      )
      publicada = true
      setEstado('lista')
      openTab('review-panel')
      await registrarUso()
    } catch (e) {
      setEstado(publicada ? 'lista' : 'pendiente')
      setError((e as Error).message || 'No se pudo añadir el comentario.')
    }
  }
  return (
    <div className="aemcicd-ai-propuesta">
      <strong>{comentario.archivo}</strong>
      <blockquote>{comentario.cita}</blockquote>
      <Markdown texto={comentario.comentario} formulas />
      {estado === 'pendiente' || estado === 'añadiendo' ? (
        <div className="aemcicd-ai-acciones">
          {permisos.write && permisos.comment && (
            <OLButton
              size="sm"
              variant="primary"
              isLoading={estado === 'añadiendo'}
              onClick={añadir}
            >
              Añadir al margen
            </OLButton>
          )}
          <OLButton
            size="sm"
            variant="secondary"
            disabled={estado === 'añadiendo'}
            onClick={() => setEstado('descartada')}
          >
            Descartar
          </OLButton>
        </div>
      ) : (
        <p role="status">
          {estado === 'lista'
            ? 'Comentario añadido al Panel de revisión.'
            : 'Observación descartada.'}
        </p>
      )}
      {error && (
        <p role="alert" className="aemcicd-ai-error">
          {error}
        </p>
      )}
      {registroPendiente && (
        <OLButton variant="link" onClick={registrarUso}>
          Reintentar registro
        </OLButton>
      )}
    </div>
  )
}
