import { useState, useSyncExternalStore } from 'react'
import { useProjectContext } from '@/shared/context/project-context'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import {
  PythonExecutionProvider,
  usePythonExecutionContext,
} from '../../../../python-runner/frontend/js/context/python-execution-context'
import type { PythonRunner } from '../../../../python-runner/frontend/js/components/editor/python/python-runner'
import OLButton from '@/shared/components/ol/ol-button'
import { guardarGrafica } from '../api'

function Ejecucion({ runner }: { runner: PythonRunner }) {
  const estado = useSyncExternalStore(runner.subscribe, runner.getState)
  const ocupado = ['loading', 'running'].includes(estado.status)
  return (
    <div>
      <OLButton
        size="sm"
        variant="primary"
        disabled={ocupado}
        onClick={() => runner.run()}
      >
        Ejecutar Python
      </OLButton>
      {estado.status === 'running' && (
        <OLButton
          size="sm"
          variant="secondary"
          onClick={() => runner.interrupt()}
        >
          Detener
        </OLButton>
      )}
      <p role="status">
        {estado.status === 'loading'
          ? 'Cargando Python…'
          : estado.status === 'finished'
            ? 'Ejecución terminada. Revisa el PDF y los resultados en el proyecto.'
            : estado.status === 'errored'
              ? 'La ejecución falló. Revisa los mensajes.'
              : ''}
      </p>
      {estado.error && <p role="alert">{String(estado.error)}</p>}
      <pre className="aemcicd-ai-salida-python">
        {estado.output.map(l => l.line).join('\n')}
      </pre>
    </div>
  )
}
function GraficaInterior({
  grafica,
  eventoId,
}: {
  grafica: { archivo: string; script: string }
  eventoId: string
}) {
  const { projectId } = useProjectContext()
  const permisos = usePermissionsContext()
  const { getPythonRunner } = usePythonExecutionContext()
  const [runner, setRunner] = useState<PythonRunner | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  async function guardar() {
    setGuardando(true)
    setError('')
    try {
      const r = await guardarGrafica(projectId, eventoId, grafica.script)
      setRunner(getPythonRunner(r.id))
    } catch {
      setError('No se pudo guardar el script. Inténtalo de nuevo.')
    } finally {
      setGuardando(false)
    }
  }
  return (
    <div className="aemcicd-ai-propuesta">
      <strong>{grafica.archivo}</strong>
      <p>
        Revisa el script, las columnas y el ajuste. Guardarlo no lo ejecuta.
      </p>
      <details>
        <summary>Ver script</summary>
        <pre>{grafica.script}</pre>
      </details>
      {permisos.write &&
        (runner ? (
          <Ejecucion runner={runner} />
        ) : (
          <OLButton
            size="sm"
            variant="primary"
            isLoading={guardando}
            onClick={guardar}
          >
            Guardar script en el proyecto
          </OLButton>
        ))}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
export default function Grafica(props: {
  grafica: { archivo: string; script: string }
  eventoId: string
}) {
  return (
    <PythonExecutionProvider>
      <GraficaInterior {...props} />
    </PythonExecutionProvider>
  )
}
