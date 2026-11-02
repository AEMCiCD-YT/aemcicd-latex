import {
  createContext,
  PropsWithChildren,
  useContext,
  useState,
  useEffect,
} from 'react'
import { useRailContext } from '@/features/ide-react/context/rail-context'
import getMeta from '@/utils/meta'
import type { Solicitud } from './api'
import { useModalsContext } from '@/features/ide-react/context/modals-context'
import { AVISO } from './components/registro'

const Contexto = createContext<{
  pendiente: Solicitud | null
  abrir: (solicitud: Solicitud) => void
  consumir: () => void
  ocupado: boolean
  setOcupado: (valor: boolean) => void
} | null>(null)

export default function SolicitudProvider({ children }: PropsWithChildren) {
  const [pendiente, setPendiente] = useState<Solicitud | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const { openTab } = useRailContext()
  const { showGenericMessageModal } = useModalsContext()
  useEffect(() => {
    const avisar = () =>
      showGenericMessageModal('Declaración de uso de IA', AVISO)
    window.addEventListener('aemcicd-ai:declaracion-retirada', avisar)
    return () =>
      window.removeEventListener('aemcicd-ai:declaracion-retirada', avisar)
  }, [showGenericMessageModal])
  return (
    <Contexto.Provider
      value={{
        pendiente,
        ocupado,
        setOcupado,
        consumir: () => setPendiente(null),
        abrir: solicitud => {
          if (ocupado || !getMeta('ol-ExposedSettings')?.aemcicdAiEnabled)
            return
          setPendiente(solicitud)
          openTab('workbench')
        },
      }}
    >
      {children}
    </Contexto.Provider>
  )
}

export function useSolicitudIA() {
  const contexto = useContext(Contexto)
  if (!contexto)
    throw new Error('El asistente necesita su proveedor de contexto.')
  return contexto
}
