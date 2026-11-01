import { createContext, PropsWithChildren, useContext, useState } from 'react'
import { useRailContext } from '@/features/ide-react/context/rail-context'
import getMeta from '@/utils/meta'
import type { Solicitud } from './api'

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
