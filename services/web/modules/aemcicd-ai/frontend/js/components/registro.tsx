import { useState } from 'react'
import { useProjectContext } from '@/shared/context/project-context'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import OLButton from '@/shared/components/ol/ol-button'
import { Cambio, leerRegistro, generarDeclaracion } from '../api'
import Propuesta from './propuesta'

export const AVISO =
  'Algunas materias, revistas y la normativa de la universidad exigen declarar el uso de IA. Si la borras, lo haces bajo tu responsabilidad.'
export default function Registro() {
  const { projectId } = useProjectContext()
  const permisos = usePermissionsContext()
  const [registro, setRegistro] = useState<
    Awaited<ReturnType<typeof leerRegistro>>['registro'] | null
  >(null)
  const [error, setError] = useState('')
  const [propuesta, setPropuesta] = useState<{
    cambio: Cambio
    retirar: boolean
  } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  async function cargar() {
    try {
      const r = await leerRegistro(projectId)
      setRegistro(r.registro)
      setError('')
    } catch {
      setError('No se pudo cargar el registro.')
    }
  }
  async function generar(retirar: boolean) {
    setOcupado(true)
    setError('')
    setPropuesta(null)
    try {
      const r = await generarDeclaracion(projectId, retirar)
      setPropuesta({ cambio: r.cambio, retirar })
    } catch (e) {
      setError(
        (e as { data?: { mensaje?: string } }).data?.mensaje ||
          'No se pudo preparar la declaración.'
      )
    } finally {
      setOcupado(false)
    }
  }
  return (
    <details
      className="aemcicd-ai-registro"
      onToggle={e => {
        if (e.currentTarget.open) cargar()
      }}
    >
      <summary>Registro de uso</summary>
      <p className="aemcicd-ai-nota">
        Incluye propuestas enviadas a revisión; comprueba cuáles aceptaste antes
        de generar la declaración.
      </p>
      {registro && (
        <ul>
          {registro.map((r, i) => (
            <li key={i}>
              {new Date(r.fecha).toLocaleDateString('es-EC')}: {r.resumen}
            </li>
          ))}
        </ul>
      )}
      {registro?.length === 0 && <p>Todavía no hay acciones registradas.</p>}
      <p className="aemcicd-ai-nota">{AVISO}</p>
      {permisos.write && (
        <div className="aemcicd-ai-acciones">
          <OLButton
            size="sm"
            variant="secondary"
            disabled={ocupado}
            onClick={() => generar(false)}
          >
            Generar declaración
          </OLButton>
          <OLButton
            size="sm"
            variant="link"
            disabled={ocupado}
            onClick={() => generar(true)}
          >
            Preparar retirada de la declaración
          </OLButton>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {propuesta && (
        <Propuesta
          key={JSON.stringify(propuesta)}
          cambio={propuesta.cambio}
          declaracion={{ retirar: propuesta.retirar }}
        />
      )}
    </details>
  )
}
