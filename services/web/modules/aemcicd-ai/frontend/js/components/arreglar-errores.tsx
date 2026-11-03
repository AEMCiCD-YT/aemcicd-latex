import OLButton from '@/shared/components/ol/ol-button'
import getMeta from '@/utils/meta'
import { useDetachCompileContext } from '@/shared/context/detach-compile-context'
import { useSolicitudIA } from '../solicitud-context'

// Encima de la lista del log: manda al agente todos los errores de la compilación junto con el
// archivo abierto (el panel añade el contexto del editor).
export default function ArreglarErrores() {
  const { abrir, ocupado } = useSolicitudIA()
  const { logEntries } = useDetachCompileContext()
  const errores = logEntries?.errors?.length ?? 0
  if (!getMeta('ol-ExposedSettings')?.aemcicdAiEnabled || !errores) return null
  return (
    <div className="aemcicd-ai-arreglar-log">
      <OLButton
        size="sm"
        variant="primary"
        disabled={ocupado}
        leadingIcon="auto_fix_high"
        onClick={() =>
          abrir({
            funcion: 'agente',
            titulo:
              errores === 1
                ? 'Arregla el error de compilación'
                : `Arregla los ${errores} errores de compilación`,
            entrada: {
              pregunta:
                'La compilación falla. Corrige los errores con el menor cambio posible y explica brevemente qué estaba mal.',
            },
          })
        }
      >
        Arreglar {errores === 1 ? 'el error' : 'los errores'} con IA
      </OLButton>
    </div>
  )
}
