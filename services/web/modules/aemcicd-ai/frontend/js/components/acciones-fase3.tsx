import { useEffect, useState } from 'react'
import OLButton from '@/shared/components/ol/ol-button'
import getMeta from '@/utils/meta'
import { useProjectContext } from '@/shared/context/project-context'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import { useSolicitudIA } from '../solicitud-context'
import { leerArchivosFase3, crearBibliografia } from '../api'
import { useRootDoc } from '@/shared/hooks/use-root-doc'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import useConvertProject from '@/features/ide-react/hooks/use-convert-project'

export default function AccionesFase3() {
  const { projectId } = useProjectContext()
  const { write } = usePermissionsContext()
  const { abrir, ocupado } = useSolicitudIA()
  const [archivos, setArchivos] = useState<{
    pdfs: string[]
    bibliografias: string[]
  }>({ pdfs: [], bibliografias: [] })
  const [pdfs, setPdfs] = useState<string[]>([])
  const [bib, setBib] = useState('')
  const [pregunta, setPregunta] = useState('')
  const [dois, setDois] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [error, setError] = useState('')
  const [creando, setCreando] = useState(false)
  const { openDocs } = useEditorManagerContext()
  const getRootDocInfo = useRootDoc()
  const exportar = useConvertProject('docx', openDocs, getRootDocInfo)
  const actualizar = () =>
    leerArchivosFase3(projectId)
      .then(r => {
        setArchivos(r)
        setBib(actual =>
          r.bibliografias.includes(actual) ? actual : r.bibliografias[0] || ''
        )
        setPdfs(actual => actual.filter(p => r.pdfs.includes(p)))
        setError('')
      })
      .catch(() =>
        setError('No se pudo leer el árbol de archivos. Inténtalo de nuevo.')
      )
  useEffect(() => {
    actualizar()
  }, [projectId])
  const ejecutar = (
    funcion: string,
    titulo: string,
    entrada: Record<string, unknown>
  ) => abrir({ funcion, titulo, entrada })
  const boton = (funcion: string, titulo: string, solicitud: string) => (
    <OLButton
      key={funcion}
      size="sm"
      variant="secondary"
      disabled={ocupado}
      onClick={() => ejecutar(funcion, titulo, { pregunta: solicitud })}
    >
      {titulo}
    </OLButton>
  )
  return (
    <div className="aemcicd-ai-fase3">
      <details>
        <summary>Investigación y PDF</summary>
        <p className="aemcicd-ai-nota">
          La búsqueda envía solo tu tema o los DOI a Crossref. Verificar un DOI
          no demuestra que el artículo respalde tu afirmación. Revisa las
          fuentes.
        </p>
        <label>
          Pregunta o tema
          <textarea
            rows={2}
            maxLength={1000}
            value={pregunta}
            onChange={e => setPregunta(e.target.value)}
          />
        </label>
        <label>
          DOI opcionales, uno por línea (máximo cinco)
          <textarea
            rows={2}
            maxLength={1100}
            value={dois}
            onChange={e => setDois(e.target.value)}
          />
        </label>
        <label>
          Archivo de bibliografía
          <select value={bib} onChange={e => setBib(e.target.value)}>
            <option value="">Elige un archivo .bib</option>
            {archivos.bibliografias.map(r => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        {!archivos.bibliografias.length && write && (
          <OLButton
            size="sm"
            variant="secondary"
            disabled={creando}
            onClick={async () => {
              setCreando(true)
              try {
                await crearBibliografia(projectId)
                await actualizar()
              } catch {
                setError('No se pudo crear referencias.bib.')
              } finally {
                setCreando(false)
              }
            }}
          >
            Crear referencias.bib
          </OLButton>
        )}
        <OLButton
          size="sm"
          variant="secondary"
          disabled={ocupado || !pregunta.trim() || !bib}
          onClick={() =>
            ejecutar('bibliografia_verificada', 'Bibliografía verificada', {
              pregunta,
              archivoBib: bib,
              dois: dois
                .split(/\n/)
                .map(d => d.trim())
                .filter(Boolean),
            })
          }
        >
          Buscar y proponer bibliografía
        </OLButton>
        {boton(
          'citas_faltantes',
          'Revisar citas faltantes',
          'Identifica citas sin entrada y afirmaciones que necesitan respaldo. Usa solo claves existentes y señala lo que requiere una fuente nueva.'
        )}
        <label>
          PDF del proyecto (elige hasta tres)
          <select
            multiple
            value={pdfs}
            onChange={e =>
              setPdfs(Array.from(e.target.selectedOptions).map(o => o.value))
            }
          >
            {archivos.pdfs.map(r => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <p className="aemcicd-ai-nota">
          Se extrae texto en el servidor con ruta y página; no hay OCR ni
          lectura de figuras. Se muestra el costo antes de consultar.
        </p>
        <OLButton
          size="sm"
          variant="secondary"
          disabled={
            ocupado || !pregunta.trim() || !pdfs.length || pdfs.length > 3
          }
          onClick={() =>
            ejecutar('chat_pdf', 'Consultar PDF', { pregunta, pdfs })
          }
        >
          Consultar estos PDF
        </OLButton>
        <OLButton
          size="sm"
          variant="link"
          disabled={ocupado}
          onClick={actualizar}
        >
          Actualizar archivos
        </OLButton>
      </details>
      <details>
        <summary>Equipo y notación</summary>
        {boton(
          'revision_equipo',
          'Revisar el trabajo en equipo',
          'Revisa contradicciones, duplicaciones y pendientes entre capítulos; propón comentarios para el grupo sin atribuir autorías.'
        )}
        {boton(
          'coherencia_notacion',
          'Revisar coherencia de notación',
          'Compara símbolos, índices, unidades y definiciones entre capítulos y propone cambios mínimos explicados.'
        )}
        <label>
          Historial: desde la versión
          <input
            type="number"
            min={0}
            value={desde}
            onChange={e => setDesde(e.target.value)}
          />
        </label>
        <label>
          Hasta la versión
          <input
            type="number"
            min={1}
            value={hasta}
            onChange={e => setHasta(e.target.value)}
          />
        </label>
        <OLButton
          size="sm"
          variant="secondary"
          disabled={
            ocupado ||
            desde === '' ||
            hasta === '' ||
            Number(hasta) <= Number(desde)
          }
          onClick={() =>
            ejecutar('resumen_cambios', 'Resumen del Historial', {
              pregunta:
                'Resume qué cambió en este intervalo y qué conviene revisar.',
              desdeVersion: Number(desde),
              hastaVersion: Number(hasta),
            })
          }
        >
          Resumir cambios
        </OLButton>
      </details>
      <details>
        <summary>Presentar y exportar</summary>
        {boton(
          'beamer',
          'Crear presentación Beamer',
          'Sintetiza el informe en una presentación Beamer completa, sin inventar resultados ni autores.'
        )}
        {boton(
          'poster',
          'Crear póster',
          'Prepara un póster académico completo a partir del informe, sin inventar resultados ni recursos.'
        )}
        <p className="aemcicd-ai-nota">
          Se propone un archivo nuevo. Revisa el contenido y elige guardarlo; el
          original se conserva.
        </p>
        {getMeta('ol-ExposedSettings')?.enablePandocConversions && (
          <OLButton
            size="sm"
            variant="secondary"
            disabled={ocupado}
            onClick={exportar}
          >
            Descargar Word
          </OLButton>
        )}
        <p className="aemcicd-ai-nota">
          Word usa la conversión nativa y no consume crédito de IA. Revisa las
          fórmulas y el formato después de descargar.
        </p>
        <a href="/templates" target="_blank" rel="noreferrer">
          Abrir galería de plantillas
        </a>
      </details>
      {error && (
        <p role="alert" className="aemcicd-ai-error">
          {error}
        </p>
      )}
    </div>
  )
}
