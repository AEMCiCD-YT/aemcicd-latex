import OLButton from '@/shared/components/ol/ol-button'
import getMeta from '@/utils/meta'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useSolicitudIA } from '../solicitud-context'

export default function ResumenHistorial({
  selection,
}: {
  selection: { updateRange: { fromV: number; toV: number } | null }
}) {
  const { abrir, ocupado } = useSolicitudIA()
  const { setView } = useLayoutContext()
  if (
    !getMeta('ol-ExposedSettings')?.aemcicdAiEnabled ||
    !selection.updateRange
  )
    return null
  const { fromV, toV } = selection.updateRange
  return (
    <OLButton
      size="sm"
      variant="secondary"
      disabled={ocupado || fromV >= toV}
      onClick={() => {
        setView('editor')
        abrir({
          funcion: 'resumen_cambios',
          titulo: `Resumen del Historial: ${fromV}–${toV}`,
          entrada: {
            pregunta:
              'Resume las diferencias de este intervalo y señala qué conviene revisar.',
            desdeVersion: fromV,
            hastaVersion: toV,
          },
        })
      }}
    >
      Resumir con IA
    </OLButton>
  )
}
