import { useEffect, useState } from 'react'
import { getJSON, postJSON } from '@/infrastructure/fetch-json'
import OLButton from '@/shared/components/ol/ol-button'

export default function Plantillas() {
  const [plantillas, setPlantillas] = useState<
    { id: string; nombre: string }[]
  >([])
  const [ocupada, setOcupada] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let activa = true
    getJSON<{ plantillas: { id: string; nombre: string }[] }>(
      '/aemcicd-ai/plantillas'
    )
      .then(r => {
        if (activa) setPlantillas(r.plantillas)
      })
      .catch(() => {})
    return () => {
      activa = false
    }
  }, [])
  if (!plantillas.length) return null
  return (
    <section
      className="container my-4"
      aria-label="Plantillas iniciales del programa"
    >
      <h2>Plantillas del Programa AEMCiCD</h2>
      <p>
        Puntos de partida editables por área. No certifican el formato oficial
        de tu carrera, materia o revista; revisa sus requisitos.
      </p>
      <div className="d-flex flex-wrap gap-2">
        {plantillas.map(p => (
          <OLButton
            key={p.id}
            variant="secondary"
            disabled={ocupada}
            onClick={async () => {
              setOcupada(true)
              setError('')
              try {
                const r = await postJSON<{ projectId: string }>(
                  `/aemcicd-ai/plantillas/${p.id}`
                )
                window.location.assign(`/project/${r.projectId}`)
              } catch {
                setError(
                  'No se pudo crear el proyecto. Comprueba tu sesión e inténtalo de nuevo.'
                )
                setOcupada(false)
              }
            }}
          >
            {p.nombre}
          </OLButton>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
