import { useState } from 'react'
import OLButton from '@/shared/components/ol/ol-button'
import { useSolicitudIA } from '../solicitud-context'
import Registro from './registro'

export default function AccionesFase2() {
  const { abrir, ocupado } = useSolicitudIA()
  const [datos, setDatos] = useState('')
  const [archivo, setArchivo] = useState('')
  const [pregunta, setPregunta] = useState(
    'Gráfica de dispersión con ajuste lineal, incertidumbre de parámetros y R².'
  )
  return (
    <div className="aemcicd-ai-fase2">
      <details>
        <summary>Revisión y entrega</summary>
        <div className="aemcicd-ai-acciones">
          <OLButton
            size="sm"
            variant="secondary"
            disabled={ocupado}
            onClick={() =>
              abrir({
                funcion: 'revisor_jurado',
                titulo: 'Revisor tipo jurado',
                entrada: {
                  pregunta:
                    'Revisa el proyecto como jurado académico y propone observaciones para el margen.',
                },
              })
            }
          >
            Revisor tipo jurado
          </OLButton>
          <OLButton
            size="sm"
            variant="secondary"
            disabled={ocupado}
            onClick={() =>
              abrir({
                funcion: 'revisar_entrega',
                titulo: 'Revisar antes de entregar',
                entrada: {
                  pregunta:
                    'Revisa ortografía, gramática y la lista de chequeo del proyecto antes de entregar.',
                },
              })
            }
          >
            Revisar antes de entregar
          </OLButton>
          <OLButton
            size="sm"
            variant="secondary"
            disabled={ocupado}
            onClick={() =>
              abrir({
                funcion: 'revisar_importacion',
                titulo: 'Revisar importación de Prism o Word',
                entrada: {
                  pregunta:
                    'Revisa la conversión a LaTeX y los posibles errores del documento importado.',
                },
              })
            }
          >
            Revisar importación
          </OLButton>
        </div>
      </details>
      <details>
        <summary>Gráfica desde datos</summary>
        <label>
          Datos de Excel o CSV
          <textarea
            rows={4}
            maxLength={50000}
            value={datos}
            onChange={e => setDatos(e.target.value)}
            placeholder={'x\ty\n0\t0\n1\t2'}
          />
        </label>
        <label>
          O archivo del proyecto (CSV, TSV o TXT)
          <input
            value={archivo}
            onChange={e => setArchivo(e.target.value)}
            placeholder="datos/mediciones.csv"
          />
        </label>
        <label>
          Gráfica y ajuste
          <textarea
            rows={2}
            maxLength={4000}
            value={pregunta}
            onChange={e => setPregunta(e.target.value)}
          />
        </label>
        <p className="aemcicd-ai-nota">
          Puedes pedir barras de error, IR, UV-Vis, titulación, DRX, Arrhenius,
          corrección de línea base, picos, doble eje o un ajuste no lineal.
          Indica las columnas y unidades.
        </p>
        <OLButton
          size="sm"
          variant="secondary"
          disabled={
            ocupado || (!datos.trim() && !archivo.trim()) || !pregunta.trim()
          }
          onClick={() =>
            abrir({
              funcion: 'grafica_datos',
              titulo: 'Gráfica desde datos',
              entrada: {
                pregunta,
                ...(archivo.trim()
                  ? { archivoDatos: archivo.trim() }
                  : { seleccion: datos }),
              },
            })
          }
        >
          Proponer gráfica
        </OLButton>
      </details>
      <Registro />
      <a
        href="https://plataforma.aemcicd.org/latex#soporte"
        target="_blank"
        rel="noreferrer"
      >
        Ayuda y soporte del programa
      </a>
    </div>
  )
}
