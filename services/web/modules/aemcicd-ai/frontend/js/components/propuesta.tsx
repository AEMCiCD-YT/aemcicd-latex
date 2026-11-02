import { useLayoutEffect, useRef, useState } from 'react'
import { useProjectContext } from '@/shared/context/project-context'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import { useEditorOpenDocContext } from '@/features/ide-react/context/editor-open-doc-context'
import OLButton from '@/shared/components/ol/ol-button'
import { Cambio, registrar, validarCambio } from '../api'
import { aplicarEnEditor } from '../aplicar'
import { useUserContext } from '@/shared/context/user-context'
import { useRailContext } from '@/features/ide-react/context/rail-context'
import { comentarIA } from '../comentarios'

export default function Propuesta({
  cambio,
  eventoId,
  declaracion,
}: {
  cambio: Cambio
  eventoId?: string
  declaracion?: { retirar: boolean }
}) {
  const { projectId } = useProjectContext()
  const permisos = usePermissionsContext()
  const { currentDocument } = useEditorOpenDocContext()
  const { openDocWithId, openDocs } = useEditorManagerContext()
  const user = useUserContext()
  const { openTab } = useRailContext()
  const actual = useRef({ currentDocument, permisos })
  useLayoutEffect(() => {
    actual.current = { currentDocument, permisos }
  }, [currentDocument, permisos])
  const [estado, setEstado] = useState<
    'pendiente' | 'aplicando' | 'aplicada' | 'descartada'
  >('pendiente')
  const [error, setError] = useState('')
  const [avisoMarca, setAvisoMarca] = useState('')
  const [registroPendiente, setRegistroPendiente] = useState(false)

  const guardarRegistro = async () => {
    if (!eventoId) return
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
    let cambioEscrito = false
    try {
      await validarCambio(projectId, eventoId, cambio, declaracion)
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
      if (!declaracion && !permisos.trackedWrite)
        throw new Error(
          'Este proyecto no permite proponer cambios con seguimiento.'
        )
      await openDocs.awaitBufferedOps(AbortSignal.timeout(5000))
      let posicion = cambio.desde
      const escribir = async () => {
        await aplicarEnEditor(
          view,
          cambio,
          () =>
            actual.current.permisos.write &&
            actual.current.currentDocument === doc,
          desde => {
            posicion = desde
          }
        )
        cambioEscrito = true
        setEstado('aplicada')
        await openDocs.awaitBufferedOps(AbortSignal.timeout(5000))
      }
      if (declaracion) await escribir()
      else {
        if (!user.id)
          throw new Error('Inicia sesión para enviar cambios a revisión.')
        await doc.withTrackedChanges(user.id, escribir)
      }
      setEstado('aplicada')
      if (!declaracion) {
        openTab('review-panel')
        const nombre =
          [user.first_name, user.last_name].filter(Boolean).join(' ') ||
          'el estudiante'
        try {
          const cita =
            cambio.despues ||
            view.state.sliceDoc(Math.max(0, posicion - 1), posicion)
          await comentarIA(
            projectId,
            doc,
            cambio.despues ? posicion : Math.max(0, posicion - 1),
            cita,
            `IA, pedido por ${nombre}. Propuesta pendiente de aceptación o rechazo en Control de cambios.`
          )
        } catch {
          setAvisoMarca(
            'La propuesta quedó en revisión, pero no se pudo añadir su comentario de identificación. Revisa el Panel de revisión.'
          )
        }
      }
      await guardarRegistro()
    } catch (err) {
      setEstado(cambioEscrito ? 'aplicada' : 'pendiente')
      const datos = (err as { data?: { mensaje?: string } }).data
      setError(
        cambioEscrito
          ? 'El cambio ya se envió al editor. Comprueba la sincronización y el Panel de revisión antes de continuar.'
          : datos?.mensaje ||
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
              {declaracion ? 'Aplicar' : 'Enviar a revisión'}
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
          {estado === 'aplicada'
            ? declaracion
              ? 'Cambio aplicado.'
              : 'Propuesta enviada al Panel de revisión.'
            : 'Propuesta descartada.'}
        </p>
      )}
      {error && (
        <p className="aemcicd-ai-error" role="alert">
          {error}
        </p>
      )}
      {avisoMarca && <p role="alert">{avisoMarca}</p>}
      {registroPendiente && (
        <OLButton size="sm" variant="link" onClick={guardarRegistro}>
          Reintentar registro
        </OLButton>
      )}
    </div>
  )
}
