import { useState } from 'react'
import { OLDropdownItem } from '@/shared/components/ol/ol-dropdown-menu'
import getMeta from '@/utils/meta'
import UploadProjectModal from '@/features/project-list/components/new-project-button/upload-project-modal'

// Word utiliza la opción nativa «Documento Word», habilitada en la imagen del fork.
export default function Importar() {
  const [abierto, setAbierto] = useState(false)
  if (!getMeta('ol-ExposedSettings')?.aemcicdAiEnabled) return null
  return (
    <>
      <li role="none">
        <OLDropdownItem
          onClick={e => {
            e.stopPropagation()
            setAbierto(true)
          }}
        >
          Importar desde Prism (ZIP)
        </OLDropdownItem>
      </li>
      {abierto && (
        <UploadProjectModal
          onHide={() => setAbierto(false)}
          openProject={id =>
            window.location.assign(`/project/${id}?converted-from=prism`)
          }
          descripcion="Exporta el proyecto completo desde Prism como ZIP, con sus imágenes y bibliografía. Conserva una copia; después de importar, recompila y usa Revisar importación en el Asistente de IA."
        />
      )}
    </>
  )
}
