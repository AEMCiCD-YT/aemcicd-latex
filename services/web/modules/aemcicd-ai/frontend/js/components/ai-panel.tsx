import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import RailPanelHeader from '@/features/ide-react/components/rail/rail-panel-header'
import { useProjectContext } from '@/shared/context/project-context'
import MaterialIcon from '@/shared/components/material-icon'
import OLButton from '@/shared/components/ol/ol-button'
import { FullSizeLoadingSpinner } from '@/shared/components/loading-spinner'
import withErrorBoundary from '@/infrastructure/error-boundary'
import {
  EstadoIA,
  Saldo,
  Cambio,
  Solicitud,
  Estimacion,
  ComentarioIA,
  FUNCIONES_PROYECTO,
  activar,
  consultar,
  estimar,
  leerInstrucciones,
  crearInstrucciones,
  leerEstado,
  valorar,
} from '../api'
import Respuesta from './respuesta'
import AccionesFase2 from './acciones-fase2'
import AccionesFase3 from './acciones-fase3'
import { useSolicitudIA } from '../solicitud-context'
import { useEditorOpenDocContext } from '@/features/ide-react/context/editor-open-doc-context'
import { useEditorPropertiesContext } from '@/features/ide-react/context/editor-properties-context'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import { useFileTreePathContext } from '@/features/file-tree/contexts/file-tree-path'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import { prepararImagen } from '../imagen'
import '../../stylesheets/aemcicd-ai.scss'

export type Turno = {
  id: number
  pregunta: string
  texto: string
  estado: 'escribiendo' | 'lista' | 'error'
  eventoId?: string
  modelo?: string
  costo?: number
  error?: string
  valoracion?: 1 | -1 | null
  // Confirmación visible del 👍/👎 (se borra a los pocos segundos).
  voto?: 'guardado' | 'quitado' | 'error'
  alternativa?: boolean
  solicitud: Solicitud
  documento?: { archivo: string; contenido: string }
  cambios?: Cambio[]
  aviso?: string
  comentarios?: ComentarioIA[]
  grafica?: { archivo: string; script: string }
}

// El saldo se muestra truncado: con $0,995 disponibles se lee $0,99, no $1,00.
const centavosAbajo = (n: number) => Math.floor(n * 100 + 1e-9) / 100

const dinero = (n: number) =>
  new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n)

function BarraSaldo({ saldo }: { saldo: Saldo }) {
  const usado = Math.min(100, Math.round((saldo.gastado / saldo.credito) * 100))
  const renueva = new Date(saldo.renuevaEl).toLocaleDateString('es-EC', {
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Guayaquil',
  })
  return (
    <div className="aemcicd-ai-saldo">
      <div className="aemcicd-ai-saldo-texto">
        Te quedan <strong>{dinero(centavosAbajo(saldo.disponible))}</strong> de{' '}
        {dinero(saldo.credito)} este mes
      </div>
      <div
        className="aemcicd-ai-saldo-barra"
        role="progressbar"
        aria-label="Crédito de IA usado"
        aria-valuenow={usado}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div style={{ width: `${100 - usado}%` }} />
      </div>
      <div className="aemcicd-ai-saldo-renueva">Se renueva el {renueva}</div>
    </div>
  )
}

function Activacion({
  version,
  alActivar,
}: {
  version: string
  alActivar: () => void
}) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const enviar = async () => {
    setEnviando(true)
    setError('')
    try {
      await activar(version)
      alActivar()
    } catch {
      setError('No se pudo activar. Inténtalo de nuevo.')
      setEnviando(false)
    }
  }
  return (
    <div className="aemcicd-ai-activacion">
      <h5>Asistente de IA del programa</h5>
      <p>
        Incluido en tu inscripción, con <strong>$1 de crédito al mes</strong>.
        Te ayuda a corregir errores, escribir fórmulas y mejorar tu documento;
        tú decides qué aplicar.
      </p>
      <ul>
        <li>
          Lo que le preguntes, y el texto que elijas incluir, se envía a{' '}
          <strong>Anthropic</strong> o a <strong>OpenAI</strong> para generar la
          respuesta. Ninguno de los dos lo usa para entrenar sus modelos.
        </li>
        <li>
          La AEMCiCD solo mide el uso (qué funciones, cuánto crédito, 👍/👎),
          sin el contenido de tus documentos ni de tus preguntas. Esos datos{' '}
          <strong>no se venden ni se entregan a nadie</strong>.
        </li>
        <li>
          La IA puede equivocarse. Revisa lo que propone. Declarar el uso de IA
          en tus trabajos es tu responsabilidad.
        </li>
      </ul>
      <p className="aemcicd-ai-nota">
        Detalles en los{' '}
        <a
          href="https://plataforma.aemcicd.org/latex/terminos"
          target="_blank"
          rel="noreferrer"
        >
          términos del programa
        </a>
        .
      </p>
      {error && <p className="text-danger">{error}</p>}
      <OLButton variant="primary" onClick={enviar} isLoading={enviando}>
        Activar la IA
      </OLButton>
    </div>
  )
}

function AiPanel() {
  const { projectId } = useProjectContext()
  const [estado, setEstado] = useState<EstadoIA | null>(null)
  const [errorEstado, setErrorEstado] = useState(false)
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [pregunta, setPregunta] = useState('')
  const [funcion, setFuncion] = useState('pregunta')
  const [usarProyecto, setUsarProyecto] = useState(false)
  const [imagen, setImagen] = useState<{ base64: string } | null>(null)
  const [nombreImagen, setNombreImagen] = useState('')
  const [aviso, setAviso] = useState('')
  const [tieneInstrucciones, setTieneInstrucciones] = useState<boolean | null>(
    null
  )
  const [confirmacion, setConfirmacion] = useState<{
    solicitud: Solicitud
    estimacion: Estimacion
  } | null>(null)
  const { pendiente, consumir, ocupado, setOcupado } = useSolicitudIA()
  const { currentDocument, currentDocumentId } = useEditorOpenDocContext()
  const { showVisual } = useEditorPropertiesContext()
  const { openDocWithId } = useEditorManagerContext()
  const { pathInFolder } = useFileTreePathContext()
  const permisos = usePermissionsContext()
  const control = useRef<AbortController | null>(null)
  const fin = useRef<HTMLDivElement>(null)
  const archivoImagen = useRef<HTMLInputElement>(null)
  const siguienteId = useRef(1)

  const cargar = useCallback(() => {
    setErrorEstado(false)
    leerEstado()
      .then(setEstado)
      .catch(() => setErrorEstado(true))
  }, [])

  useEffect(() => {
    cargar()
    return () => control.current?.abort()
  }, [cargar])

  useEffect(() => {
    if (estado?.habilitada && estado.activada)
      leerInstrucciones(projectId)
        .then(r => setTieneInstrucciones(r.existe))
        .catch(() =>
          setAviso('No se pudieron comprobar las instrucciones del proyecto.')
        )
  }, [projectId, estado?.habilitada, estado?.activada])

  useEffect(() => {
    fin.current?.scrollIntoView({ block: 'end' })
  }, [turnos])

  const actualizar = (id: number, cambio: (t: Turno) => Partial<Turno>) =>
    setTurnos(ts => ts.map(t => (t.id === id ? { ...t, ...cambio(t) } : t)))

  const preguntar = async (solicitud: Solicitud) => {
    if (control.current) return
    setOcupado(true)
    setConfirmacion(null)
    const { titulo: texto, preferir } = solicitud
    const id = siguienteId.current++
    setTurnos(ts => [
      ...ts,
      {
        id,
        pregunta: texto,
        texto: '',
        estado: 'escribiendo',
        alternativa: !!preferir,
        solicitud,
      },
    ])
    control.current = new AbortController()
    try {
      const r = await consultar(
        projectId,
        solicitud,
        trozo => actualizar(id, t => ({ texto: t.texto + trozo })),
        control.current.signal
      )
      if (r.tipo === 'fin') {
        actualizar(id, t => ({
          estado: 'lista',
          eventoId: r.eventoId,
          modelo: r.modelo,
          costo: r.costo,
          texto: r.explicacion ?? t.texto,
          cambios: r.cambios,
          aviso: r.aviso,
          comentarios: r.comentarios,
          grafica: r.grafica,
          documento: r.documento,
        }))
        setEstado(e => (e ? { ...e, saldo: r.saldo } : e))
      } else {
        actualizar(id, () => ({ estado: 'error', error: r.mensaje }))
        if (r.codigo === 'sin_saldo' || r.codigo === 'no_activada') cargar()
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        actualizar(id, () => ({ estado: 'error', error: 'Cancelada.' }))
      } else {
        actualizar(id, () => ({
          estado: 'error',
          error: 'No hay conexión con el servidor.',
        }))
      }
    } finally {
      control.current = null
      setOcupado(false)
    }
  }

  const iniciar = async (solicitud: Solicitud) => {
    if (ocupado || control.current) return
    setAviso('')
    setConfirmacion(null)
    if (!FUNCIONES_PROYECTO.includes(solicitud.funcion))
      return preguntar(solicitud)
    setOcupado(true)
    try {
      const estimacion = await estimar(projectId, solicitud)
      setConfirmacion({ solicitud, estimacion })
    } catch (err) {
      const datos = (err as { data?: { mensaje?: string } }).data
      setAviso(
        datos?.mensaje || 'No se pudo estimar el proyecto. Inténtalo de nuevo.'
      )
    } finally {
      setOcupado(false)
    }
  }

  useEffect(() => {
    if (
      pendiente &&
      estado?.habilitada &&
      estado.activada &&
      !control.current
    ) {
      consumir()
      iniciar(pendiente)
    }
  })

  const destinoActual = () => {
    const view = currentDocument?.cm6?.view
    const archivo = currentDocumentId && pathInFolder(currentDocumentId)
    if (!view || !archivo || showVisual) return {}
    const { from: desde, to: hasta } = view.state.selection.main
    return {
      archivo,
      desde,
      hasta,
      seleccion: view.state.sliceDoc(desde, hasta),
    }
  }

  const enviar = (e: Pick<FormEvent, 'preventDefault'>) => {
    e.preventDefault()
    const texto = pregunta.trim()
    if ((!texto && !imagen) || ocupado) return
    setPregunta('')
    const elegida = imagen
      ? 'foto_latex'
      : usarProyecto
        ? 'chat_proyecto'
        : funcion
    iniciar({
      funcion: elegida,
      titulo: texto || `Transcribir ${nombreImagen}`,
      entrada: {
        pregunta: texto,
        ...(imagen ? { imagen } : {}),
        ...(!['pregunta', 'chat_proyecto'].includes(elegida)
          ? destinoActual()
          : {}),
      },
    })
    setImagen(null)
    setNombreImagen('')
  }

  const subir = async (archivo?: File) => {
    if (!archivo || ocupado) return
    setOcupado(true)
    setAviso('')
    setImagen(null)
    setNombreImagen('')
    try {
      setImagen(await prepararImagen(archivo))
      setNombreImagen(archivo.name)
      setUsarProyecto(false)
    } catch (err) {
      setAviso((err as Error).message || 'No se pudo leer la imagen.')
    } finally {
      setOcupado(false)
    }
  }

  const crearArchivoInstrucciones = async () => {
    try {
      const r = await crearInstrucciones(projectId)
      setTieneInstrucciones(true)
      await openDocWithId(r.id)
    } catch {
      setAviso('No se pudieron crear las instrucciones. Inténtalo de nuevo.')
    }
  }

  const alValorar = async (t: Turno, valor: 1 | -1) => {
    if (!t.eventoId) return
    const nuevo = t.valoracion === valor ? null : valor
    actualizar(t.id, () => ({ valoracion: nuevo, voto: undefined }))
    try {
      await valorar(t.eventoId, nuevo)
      actualizar(t.id, () => ({
        voto: nuevo === null ? 'quitado' : 'guardado',
      }))
    } catch {
      actualizar(t.id, () => ({ valoracion: t.valoracion, voto: 'error' }))
    }
    setTimeout(() => actualizar(t.id, () => ({ voto: undefined })), 4000)
  }

  let contenido
  if (errorEstado) {
    contenido = (
      <div className="aemcicd-ai-mensaje">
        No se pudo cargar la IA.{' '}
        <OLButton variant="link" onClick={cargar}>
          Reintentar
        </OLButton>
      </div>
    )
  } else if (!estado) {
    contenido = <FullSizeLoadingSpinner delay={300} />
  } else if (!estado.habilitada) {
    contenido = (
      <div className="aemcicd-ai-mensaje">
        La IA no está disponible en este momento.
      </div>
    )
  } else if (!estado.activada) {
    contenido = <Activacion version={estado.versionAviso} alActivar={cargar} />
  } else {
    contenido = (
      <>
        {estado.saldo && <BarraSaldo saldo={estado.saldo} />}
        <div className="aemcicd-ai-turnos">
          {turnos.length === 0 && (
            <div className="aemcicd-ai-vacio">
              <MaterialIcon type="smart_toy" />
              <p>
                Pregúntame sobre LaTeX: un error, un paquete, cómo armar una
                tabla o una fórmula.
              </p>
            </div>
          )}
          {turnos.map(t => (
            <Respuesta
              key={t.id}
              turno={t}
              alValorar={v => alValorar(t, v)}
              alProbarOtro={() =>
                iniciar({ ...t.solicitud, preferir: 'alternativa' })
              }
              ocupado={ocupado}
            />
          ))}
          <div ref={fin} />
        </div>
        <form className="aemcicd-ai-formulario" onSubmit={enviar}>
          <AccionesFase2 />
          <AccionesFase3 />
          {tieneInstrucciones === false && permisos.write && (
            <OLButton
              size="sm"
              variant="link"
              onClick={crearArchivoInstrucciones}
            >
              Crear instrucciones del proyecto
            </OLButton>
          )}
          <div className="aemcicd-ai-acciones" aria-label="Acciones rápidas">
            {[
              [
                'formula_texto',
                'Fórmula desde texto',
                'Escribe en LaTeX: integral de 0 a infinito de e a la menos x al cuadrado.',
              ],
              [
                'tabla_excel',
                'Tabla desde Excel',
                'Pega aquí los datos de Excel (tabuladores o CSV):\n',
              ],
              [
                'esqueleto',
                'Esqueleto de documento',
                'Crea una estructura para un informe de laboratorio de Física II.',
              ],
            ].map(([clave, titulo, plantilla]) => (
              <OLButton
                key={clave}
                size="sm"
                variant={funcion === clave ? 'primary' : 'secondary'}
                disabled={ocupado}
                onClick={() => {
                  setFuncion(clave)
                  setPregunta(plantilla)
                  setUsarProyecto(false)
                  setImagen(null)
                  setNombreImagen('')
                }}
              >
                {titulo}
              </OLButton>
            ))}
            <OLButton
              size="sm"
              variant="link"
              disabled={ocupado}
              onClick={() => {
                setFuncion('pregunta')
                setImagen(null)
                setNombreImagen('')
              }}
            >
              Pregunta libre
            </OLButton>
          </div>
          <div className="aemcicd-ai-adjunto">
            <OLButton
              size="sm"
              variant="secondary"
              disabled={ocupado}
              onClick={() => archivoImagen.current?.click()}
            >
              Subir foto o PDF a LaTeX
            </OLButton>
            <input
              ref={archivoImagen}
              hidden
              aria-label="Foto o PDF a LaTeX"
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              disabled={ocupado}
              onChange={e => {
                subir(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </div>
          {imagen && (
            <div role="status">
              {nombreImagen}{' '}
              <OLButton
                size="sm"
                variant="link"
                onClick={() => {
                  setImagen(null)
                  setNombreImagen('')
                }}
              >
                Quitar imagen
              </OLButton>
            </div>
          )}
          <label>
            Modo de conversación
            <select
              value={funcion === 'tutor_latex' ? 'tutor_latex' : 'pregunta'}
              disabled={ocupado || !!imagen}
              onChange={e => {
                setFuncion(e.target.value)
                setUsarProyecto(false)
              }}
            >
              <option value="pregunta">Consultar</option>
              <option value="tutor_latex">Aprender LaTeX</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={usarProyecto}
              disabled={ocupado || !!imagen}
              onChange={e => setUsarProyecto(e.target.checked)}
            />{' '}
            Usar todo el proyecto
          </label>
          {aviso && (
            <p className="aemcicd-ai-error" role="alert">
              {aviso}
            </p>
          )}
          {confirmacion && (
            <div className="aemcicd-ai-estimacion" role="status">
              <p>
                Se enviarán unos{' '}
                {confirmacion.estimacion.tokensEntrada.toLocaleString('es-EC')}{' '}
                tokens. Costo máximo estimado: $
                {(confirmacion.estimacion.maximoMicro / 1e6).toFixed(4)},
                incluyendo la alternativa. Se cobra el uso real.
              </p>
              <OLButton
                size="sm"
                variant="primary"
                disabled={ocupado}
                onClick={() =>
                  preguntar({
                    ...confirmacion.solicitud,
                    maximoAceptadoMicro: confirmacion.estimacion.maximoMicro,
                  })
                }
              >
                Consultar con este costo
              </OLButton>
              <OLButton
                size="sm"
                variant="secondary"
                onClick={() => setConfirmacion(null)}
              >
                Cancelar
              </OLButton>
            </div>
          )}
          <textarea
            className="form-control"
            rows={3}
            maxLength={funcion === 'tabla_excel' ? 20000 : 4000}
            placeholder="Escribe tu pregunta…"
            aria-label="Pregunta para la IA"
            value={pregunta}
            onChange={e => setPregunta(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) enviar(e)
            }}
          />
          {ocupado ? (
            <OLButton
              variant="secondary"
              onClick={() => control.current?.abort()}
            >
              Detener
            </OLButton>
          ) : (
            <OLButton
              type="submit"
              variant="primary"
              disabled={!pregunta.trim() && !imagen}
            >
              Preguntar
            </OLButton>
          )}
        </form>
      </>
    )
  }

  return (
    <div className="aemcicd-ai-panel">
      <RailPanelHeader title="Asistente de IA" />
      <div className="aemcicd-ai-cuerpo">{contenido}</div>
    </div>
  )
}

export default withErrorBoundary(AiPanel)
