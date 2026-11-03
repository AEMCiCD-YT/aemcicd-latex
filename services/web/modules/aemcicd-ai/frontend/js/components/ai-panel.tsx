import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import RailPanelHeader from '@/features/ide-react/components/rail/rail-panel-header'
import { useProjectContext } from '@/shared/context/project-context'
import MaterialIcon from '@/shared/components/material-icon'
import OLButton from '@/shared/components/ol/ol-button'
import OLIconButton from '@/shared/components/ol/ol-icon-button'
import { FullSizeLoadingSpinner } from '@/shared/components/loading-spinner'
import withErrorBoundary from '@/infrastructure/error-boundary'
import { useDetachCompileContext } from '@/shared/context/detach-compile-context'
import type { LogEntry } from '@/features/pdf-preview/util/types'
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
import { MAX_PAGINAS, contarPaginas, prepararPaginas } from '../imagen'
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
  // Caracteres recibidos mientras la IA escribe cambios (aún sin explicación).
  progreso?: number
  solicitud: Solicitud
  documento?: { archivo: string; contenido: string }
  cambios?: Cambio[]
  aviso?: string
  comentarios?: ComentarioIA[]
  grafica?: { archivo: string; script: string }
}

// Intentos automáticos de «sigue sin compilar, arréglalo» tras aplicar cambios del agente.
const MAX_INTENTOS = 3

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
    month: 'short',
    timeZone: 'America/Guayaquil',
  })
  return (
    <div
      className="aemcicd-ai-saldo"
      title={`Crédito mensual de ${dinero(saldo.credito)}. Se renueva el ${renueva}.`}
    >
      <span>
        <strong>{dinero(centavosAbajo(saldo.disponible))}</strong> de{' '}
        {dinero(saldo.credito)}
      </span>
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
      <span className="aemcicd-ai-saldo-renueva">renueva {renueva}</span>
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

// Diagnósticos útiles para el agente: errores, advertencias y cajas desbordadas (tablas o
// ecuaciones que se salen del margen). El servidor se queda con los 10 primeros.
function diagnosticos(logEntries?: {
  errors?: LogEntry[]
  warnings?: LogEntry[]
  typesetting?: LogEntry[]
}) {
  const desbordes = (logEntries?.typesetting ?? []).filter(e =>
    /^Overfull/.test(e.message ?? '')
  )
  return [
    ...(logEntries?.errors ?? []),
    ...(logEntries?.warnings ?? []),
    ...desbordes,
  ]
    .slice(0, 10)
    .map(e => ({
      nivel: e.level === 'typesetting' ? 'warning' : e.level,
      mensaje: e.message || e.raw || 'Diagnóstico de compilación',
      archivo: e.file?.replace(/^\.\//, ''),
      linea: e.line,
      detalle: (e.content || e.raw || '').slice(0, 1500),
    }))
}

const ATAJOS: [string, string, string, string][] = [
  [
    'formula_texto',
    'Fórmula desde texto',
    'Describe la fórmula en palabras y te doy el LaTeX.',
    'Escribe en LaTeX: integral de 0 a infinito de e a la menos x al cuadrado.',
  ],
  [
    'tabla_excel',
    'Tabla desde Excel',
    'Pega celdas copiadas de Excel o un CSV.',
    'Pega aquí los datos de Excel (tabuladores o CSV):\n',
  ],
  [
    'esqueleto',
    'Esqueleto de documento',
    'Una estructura inicial para un informe, tesis o artículo.',
    'Crea una estructura para un informe de laboratorio de Física II.',
  ],
]
const NOMBRE_FUNCION: Record<string, string> = {
  tutor_latex: 'Aprender LaTeX',
  ...Object.fromEntries(ATAJOS.map(([clave, titulo]) => [clave, titulo])),
}

type Adjunto = { nombre: string; imagenes: { base64: string }[] }
type Rango = { archivo: File; total: number; desde: number; hasta: number }
type Seguimiento = {
  intento: number
  fase: 'esperando' | 'compilando' | 'leyendo' | 'ok' | 'errores'
  errores?: number
}

function AiPanel() {
  const { projectId } = useProjectContext()
  const [estado, setEstado] = useState<EstadoIA | null>(null)
  const [errorEstado, setErrorEstado] = useState(false)
  const [pestana, setPestana] = useState<'chat' | 'herramientas'>('chat')
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [pregunta, setPregunta] = useState('')
  // 'agente' por defecto; los atajos y el modo aprender cambian la función del siguiente envío.
  const [funcion, setFuncion] = useState('agente')
  const [usarProyecto, setUsarProyecto] = useState(false)
  const [incluirErrores, setIncluirErrores] = useState(true)
  const [incluirSeleccion, setIncluirSeleccion] = useState(true)
  const [seleccion, setSeleccion] = useState(0)
  const [adjunto, setAdjunto] = useState<Adjunto | null>(null)
  // Destino de la transcripción: el cursor (o la selección) o el archivo abierto completo.
  const [reemplazarTodo, setReemplazarTodo] = useState(false)
  const [rango, setRango] = useState<Rango | null>(null)
  const [preparando, setPreparando] = useState('')
  const [aviso, setAviso] = useState('')
  const [seguimiento, setSeguimiento] = useState<Seguimiento | null>(null)
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
  const { logEntries, compiling, startCompile } = useDetachCompileContext()
  const permisos = usePermissionsContext()
  const control = useRef<AbortController | null>(null)
  const fin = useRef<HTMLDivElement>(null)
  const archivoImagen = useRef<HTMLInputElement>(null)
  const siguienteId = useRef(1)
  const turnosRef = useRef<Turno[]>([])
  turnosRef.current = turnos
  const intentoRef = useRef(0)
  const logRef = useRef<unknown>(undefined)
  const logAntes = useRef<unknown>(undefined)
  const numErroresRef = useRef(0)

  const archivoAbierto =
    (currentDocumentId && pathInFolder(currentDocumentId)) || ''
  const errores = diagnosticos(logEntries)
  const numErrores = logEntries?.errors?.length ?? 0
  logRef.current = logEntries
  numErroresRef.current = numErrores

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
  }, [turnos, seguimiento])

  // El panel no se entera de cada movimiento del cursor: revisa la selección cada segundo
  // para mostrar el chip «N líneas seleccionadas».
  useEffect(() => {
    const id = window.setInterval(() => {
      const view = currentDocument?.cm6?.view
      const sel = view?.state.selection.main
      const lineas =
        view && sel && !sel.empty
          ? view.state.doc.lineAt(sel.to).number -
            view.state.doc.lineAt(sel.from).number +
            1
          : 0
      setSeleccion(s => (s === lineas ? s : lineas))
    }, 1000)
    return () => window.clearInterval(id)
  }, [currentDocument])

  const actualizar = (id: number, cambio: (t: Turno) => Partial<Turno>) =>
    setTurnos(ts => ts.map(t => (t.id === id ? { ...t, ...cambio(t) } : t)))

  // Lo que el agente necesita saber del editor. El texto lo lee el servidor; aquí solo van la
  // ruta, el cursor, la selección, los errores del log y los turnos anteriores.
  const contextoEditor = (opciones: {
    errores: boolean
    seleccion: boolean
    proyecto: boolean
  }) => {
    const view = currentDocument?.cm6?.view
    const posicion =
      view && !showVisual
        ? (() => {
            const { from, to, head } = view.state.selection.main
            return opciones.seleccion && from !== to
              ? { cursor: head, desde: from, hasta: to }
              : { cursor: head }
          })()
        : {}
    const historial = turnosRef.current
      .filter(t => t.solicitud.funcion === 'agente' && t.estado === 'lista')
      .slice(-4)
      .flatMap(t => [
        { rol: 'estudiante', texto: t.pregunta },
        {
          rol: 'asistente',
          texto: [
            t.texto,
            t.cambios?.length
              ? `(Propuse ${t.cambios.length} cambio(s) en ${[...new Set(t.cambios.map(c => c.archivo))].join(', ')}.)`
              : '',
          ]
            .filter(Boolean)
            .join('\n'),
        },
      ])
    return {
      ...(archivoAbierto ? { archivo: archivoAbierto, ...posicion } : {}),
      ...(opciones.errores && errores.length ? { errores } : {}),
      ...(historial.length ? { historial } : {}),
      ...(opciones.proyecto ? { usarProyecto: true } : {}),
    }
  }

  const preguntar = async (solicitud: Solicitud) => {
    if (control.current) return
    setOcupado(true)
    setConfirmacion(null)
    setAviso('')
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
        control.current.signal,
        caracteres => actualizar(id, () => ({ progreso: caracteres }))
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
      } else if (r.codigo === 'estimacion' && r.estimacion) {
        // El costo cambió entre la estimación y la confirmación: se muestra el nuevo.
        setTurnos(ts => ts.filter(t => t.id !== id))
        setConfirmacion({
          solicitud: { ...solicitud, maximoAceptadoMicro: undefined },
          estimacion: r.estimacion,
        })
        setAviso(r.mensaje)
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

  // Las consultas grandes (proyecto completo, PDF de varias páginas) muestran antes su costo.
  const necesitaEstimacion = (s: Solicitud) =>
    FUNCIONES_PROYECTO.includes(s.funcion) ||
    (s.funcion === 'agente' && s.entrada.usarProyecto === true) ||
    (s.funcion === 'foto_latex' &&
      ((s.entrada.imagenes as unknown[] | undefined)?.length ?? 1) > 2)

  const iniciar = async (solicitud: Solicitud) => {
    if (ocupado || control.current) return
    setAviso('')
    setConfirmacion(null)
    if (!necesitaEstimacion(solicitud)) return preguntar(solicitud)
    setOcupado(true)
    try {
      // La foto se estima sin reenviar las imágenes: solo el número de páginas.
      const { imagenes, ...resto } = solicitud.entrada as {
        imagenes?: unknown[]
      }
      const estimacion = await estimar(
        projectId,
        solicitud.funcion === 'foto_latex'
          ? {
              ...solicitud,
              entrada: {
                ...resto,
                soloEstimar: true,
                paginas: imagenes?.length ?? 1,
              },
            }
          : solicitud
      )
      setConfirmacion({ solicitud, estimacion })
    } catch (err) {
      const datos = (err as { data?: { mensaje?: string } }).data
      setAviso(
        datos?.mensaje || 'No se pudo estimar la consulta. Inténtalo de nuevo.'
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
      setPestana('chat')
      // El botón del log solo dice qué pedir; el contexto del editor se añade aquí.
      iniciar(
        pendiente.funcion === 'agente' && !pendiente.entrada.archivo
          ? {
              ...pendiente,
              entrada: {
                ...contextoEditor({
                  errores: true,
                  seleccion: false,
                  proyecto: false,
                }),
                ...pendiente.entrada,
              },
            }
          : pendiente
      )
    }
  })

  // Seguimiento del agente: al aplicar un cambio se recompila y, si quedan errores, se
  // ofrece seguir arreglando (hasta MAX_INTENTOS veces).
  useEffect(() => {
    let espera: number | undefined
    const alAplicar = (e: Event) => {
      const { eventoId } = (e as CustomEvent<{ eventoId: string }>).detail
      const turno = turnosRef.current.find(t => t.eventoId === eventoId)
      if (turno?.solicitud.funcion !== 'agente') return
      setSeguimiento({ intento: intentoRef.current, fase: 'esperando' })
      // Si hay varios cambios, se compila una vez tras el último (y con el texto ya enviado).
      window.clearTimeout(espera)
      espera = window.setTimeout(() => {
        setSeguimiento(s => (s ? { ...s, fase: 'compilando' } : s))
        logAntes.current = logRef.current
        startCompile()
      }, 1500)
    }
    window.addEventListener('aemcicd-ai:cambio-aplicado', alAplicar)
    return () => {
      window.removeEventListener('aemcicd-ai:cambio-aplicado', alAplicar)
      window.clearTimeout(espera)
    }
  }, [startCompile])

  // El log se descarga y analiza después de que termina la compilación: se espera a que
  // cambie respecto del que había al recompilar (o 8 s como máximo).
  const compilabaAntes = useRef(false)
  useEffect(() => {
    if (compiling) compilabaAntes.current = true
    else if (compilabaAntes.current) {
      compilabaAntes.current = false
      setSeguimiento(s =>
        s?.fase === 'compilando' ? { ...s, fase: 'leyendo' } : s
      )
    }
  }, [compiling])
  const fase = seguimiento?.fase
  useEffect(() => {
    if (fase !== 'leyendo') return
    const decidir = () =>
      setSeguimiento(s =>
        s?.fase === 'leyendo'
          ? numErroresRef.current
            ? { ...s, fase: 'errores', errores: numErroresRef.current }
            : { ...s, fase: 'ok' }
          : s
      )
    // Al recibir la compilación el log pasa por undefined antes de llegar el nuevo.
    if (logEntries && logEntries !== logAntes.current) return decidir()
    const id = window.setTimeout(decidir, 8000)
    return () => window.clearTimeout(id)
  }, [fase, logEntries])

  const seguirArreglando = () => {
    intentoRef.current += 1
    setSeguimiento(null)
    iniciar({
      funcion: 'agente',
      titulo: 'Sigue sin compilar. Corrige los errores que quedan.',
      entrada: {
        pregunta:
          'Apliqué tus cambios y recompilé, pero sigue habiendo errores. Corrige los que quedan.',
        ...contextoEditor({ errores: true, seleccion: false, proyecto: false }),
      },
    })
  }

  const enviar = (e: Pick<FormEvent, 'preventDefault'>) => {
    e.preventDefault()
    const texto = pregunta.trim()
    if ((!texto && !adjunto) || ocupado || preparando) return
    setPregunta('')
    intentoRef.current = 0
    setSeguimiento(null)
    if (adjunto) {
      const view = currentDocument?.cm6?.view
      const destino =
        view && archivoAbierto && !showVisual
          ? (() => {
              const { from, to } = view.state.selection.main
              const [desde, hasta] = reemplazarTodo
                ? [0, view.state.doc.length]
                : [from, to]
              return {
                archivo: archivoAbierto,
                desde,
                hasta,
                seleccion: view.state.sliceDoc(desde, hasta),
              }
            })()
          : {}
      iniciar({
        funcion: 'foto_latex',
        titulo:
          texto ||
          `Transcribir ${adjunto.nombre}${adjunto.imagenes.length > 1 ? ` (${adjunto.imagenes.length} páginas)` : ''}`,
        entrada: { pregunta: texto, imagenes: adjunto.imagenes, ...destino },
      })
      setAdjunto(null)
      return
    }
    if (funcion === 'agente') {
      iniciar({
        funcion: 'agente',
        titulo: texto,
        entrada: {
          pregunta: texto,
          ...contextoEditor({
            errores: incluirErrores,
            seleccion: incluirSeleccion,
            proyecto: usarProyecto,
          }),
        },
      })
      return
    }
    iniciar({ funcion, titulo: texto, entrada: { pregunta: texto } })
    // Los atajos sirven para un envío; el modo aprender se queda hasta quitarlo.
    if (funcion !== 'tutor_latex') setFuncion('agente')
  }

  const prepararAdjunto = async (
    archivo: File,
    desde = 1,
    hasta = MAX_PAGINAS
  ) => {
    setRango(null)
    setPreparando('Preparando…')
    try {
      const imagenes = await prepararPaginas(archivo, desde, hasta, (k, n) =>
        setPreparando(`Preparando página ${k} de ${n}…`)
      )
      setReemplazarTodo(false)
      setAdjunto({
        nombre:
          archivo.name +
          (desde > 1 || hasta < MAX_PAGINAS
            ? ` (págs. ${desde}–${desde + imagenes.length - 1})`
            : ''),
        imagenes,
      })
    } catch (err) {
      setAviso((err as Error).message || 'No se pudo leer el archivo.')
    } finally {
      setPreparando('')
    }
  }

  const subir = async (archivo?: File) => {
    if (!archivo || ocupado || preparando) return
    setAviso('')
    setAdjunto(null)
    setRango(null)
    try {
      const total = await contarPaginas(archivo)
      if (total && total > MAX_PAGINAS) {
        setRango({ archivo, total, desde: 1, hasta: MAX_PAGINAS })
        return
      }
    } catch {
      setAviso('No se pudo abrir el PDF. ¿Está dañado o protegido?')
      return
    }
    await prepararAdjunto(archivo)
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

  const usarAtajo = (clave: string, plantilla: string) => {
    setFuncion(clave)
    setPregunta(plantilla)
    setAdjunto(null)
    setPestana('chat')
  }

  const chips = () => {
    if (adjunto)
      return (
        <>
          <span className="aemcicd-ai-chip activo">
            <MaterialIcon
              type={adjunto.imagenes.length > 1 ? 'picture_as_pdf' : 'image'}
            />
            {adjunto.nombre}
            {adjunto.imagenes.length > 1 &&
              ` · ${adjunto.imagenes.length} págs.`}
            <button
              type="button"
              aria-label="Quitar el archivo"
              onClick={() => setAdjunto(null)}
            >
              <MaterialIcon type="close" />
            </button>
          </span>
          {archivoAbierto && !showVisual && (
            <button
              type="button"
              className={`aemcicd-ai-chip ${reemplazarTodo ? 'error' : 'activo'}`}
              aria-pressed={reemplazarTodo}
              title="Dónde va el LaTeX transcrito. Pulsa para cambiar."
              onClick={() => setReemplazarTodo(v => !v)}
            >
              <MaterialIcon type={reemplazarTodo ? 'swap_horiz' : 'input'} />
              {reemplazarTodo
                ? `Reemplazar todo ${archivoAbierto.split('/').pop()}`
                : seleccion > 0
                  ? 'En la selección'
                  : 'En el cursor'}
            </button>
          )}
        </>
      )
    if (funcion !== 'agente')
      return (
        <span className="aemcicd-ai-chip activo">
          {NOMBRE_FUNCION[funcion] ?? funcion}
          <button
            type="button"
            aria-label="Volver al chat con el documento"
            onClick={() => setFuncion('agente')}
          >
            <MaterialIcon type="close" />
          </button>
        </span>
      )
    return (
      <>
        {archivoAbierto && (
          <span
            className="aemcicd-ai-chip"
            title="La IA lee este archivo y su preámbulo"
          >
            <MaterialIcon type="description" />
            {archivoAbierto.split('/').pop()}
          </span>
        )}
        {seleccion > 0 && !showVisual && (
          <button
            type="button"
            className={`aemcicd-ai-chip ${incluirSeleccion ? 'activo' : 'apagado'}`}
            aria-pressed={incluirSeleccion}
            title="Pulsa para incluir o no la selección"
            onClick={() => setIncluirSeleccion(v => !v)}
          >
            <MaterialIcon type="text_select_start" />
            {seleccion === 1 ? '1 línea' : `${seleccion} líneas`}
          </button>
        )}
        {errores.length > 0 && (
          <button
            type="button"
            className={`aemcicd-ai-chip ${incluirErrores ? (numErrores ? 'error' : 'activo') : 'apagado'}`}
            aria-pressed={incluirErrores}
            title="Pulsa para incluir o no los diagnósticos de la última compilación"
            onClick={() => setIncluirErrores(v => !v)}
          >
            <MaterialIcon type={numErrores ? 'error' : 'warning'} />
            {numErrores
              ? `${numErrores} ${numErrores === 1 ? 'error' : 'errores'}`
              : `${errores.length} ${errores.length === 1 ? 'aviso' : 'avisos'}`}
          </button>
        )}
        <button
          type="button"
          className={`aemcicd-ai-chip ${usarProyecto ? 'activo' : 'apagado'}`}
          aria-pressed={usarProyecto}
          title="Enviar todos los archivos del proyecto (cuesta más; se muestra el costo antes)"
          onClick={() => setUsarProyecto(v => !v)}
        >
          <MaterialIcon type="folder" />
          Todo el proyecto
        </button>
      </>
    )
  }

  const chat = (
    <>
      <div className="aemcicd-ai-turnos">
        {turnos.length === 0 && (
          <div className="aemcicd-ai-vacio">
            <MaterialIcon type="smart_toy" />
            <p>
              Trabajo sobre el archivo que tienes abierto. Pídeme, por ejemplo:
            </p>
            <ul>
              <li>«No compila, arréglalo»</li>
              <li>«La tabla se sale del margen»</li>
              <li>«Dibuja aquí un diagrama con TikZ»</li>
            </ul>
            <p className="aemcicd-ai-nota">
              Te propongo los cambios y tú decides si aplicarlos.
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
        {seguimiento && (
          <div className="aemcicd-ai-seguimiento" role="status">
            {seguimiento.fase === 'esperando' && 'Cambio aplicado.'}
            {(seguimiento.fase === 'compilando' ||
              seguimiento.fase === 'leyendo') && (
              <>
                <MaterialIcon type="autorenew" /> Recompilando para comprobar…
              </>
            )}
            {seguimiento.fase === 'ok' && (
              <>
                <MaterialIcon type="check_circle" /> Compila sin errores.
              </>
            )}
            {seguimiento.fase === 'errores' && (
              <>
                <span>
                  Sigue habiendo {seguimiento.errores}{' '}
                  {seguimiento.errores === 1 ? 'error' : 'errores'}.
                </span>
                {seguimiento.intento < MAX_INTENTOS ? (
                  <span className="aemcicd-ai-botones">
                    <OLButton
                      size="sm"
                      variant="primary"
                      disabled={ocupado}
                      onClick={seguirArreglando}
                    >
                      Seguir arreglando
                    </OLButton>
                    <OLButton
                      size="sm"
                      variant="secondary"
                      onClick={() => setSeguimiento(null)}
                    >
                      Dejarlo así
                    </OLButton>
                  </span>
                ) : (
                  <span>
                    Ya van {MAX_INTENTOS} intentos. Revisa el log o explícame
                    qué querías hacer.
                  </span>
                )}
              </>
            )}
          </div>
        )}
        <div ref={fin} />
      </div>
      <form className="aemcicd-ai-formulario" onSubmit={enviar}>
        {aviso && (
          <p className="aemcicd-ai-error" role="alert">
            {aviso}
          </p>
        )}
        {rango && (
          <div className="aemcicd-ai-estimacion">
            <p>
              El PDF tiene {rango.total} páginas. Se transcriben hasta{' '}
              {MAX_PAGINAS} por consulta: elige cuáles.
            </p>
            <div className="aemcicd-ai-rango">
              <label>
                Desde
                <input
                  type="number"
                  className="form-control"
                  min={1}
                  max={rango.total}
                  value={rango.desde}
                  onChange={e => {
                    const desde = Math.max(
                      1,
                      Math.min(rango.total, Number(e.target.value) || 1)
                    )
                    setRango({
                      ...rango,
                      desde,
                      hasta: Math.min(rango.total, desde + MAX_PAGINAS - 1),
                    })
                  }}
                />
              </label>
              <label>
                Hasta
                <input
                  type="number"
                  className="form-control"
                  min={rango.desde}
                  max={Math.min(rango.total, rango.desde + MAX_PAGINAS - 1)}
                  value={rango.hasta}
                  onChange={e =>
                    setRango({
                      ...rango,
                      hasta: Math.max(
                        rango.desde,
                        Math.min(
                          rango.total,
                          rango.desde + MAX_PAGINAS - 1,
                          Number(e.target.value) || rango.desde
                        )
                      ),
                    })
                  }
                />
              </label>
            </div>
            <div className="aemcicd-ai-botones">
              <OLButton
                size="sm"
                variant="primary"
                onClick={() =>
                  prepararAdjunto(rango.archivo, rango.desde, rango.hasta)
                }
              >
                Usar estas páginas
              </OLButton>
              <OLButton
                size="sm"
                variant="secondary"
                onClick={() => setRango(null)}
              >
                Cancelar
              </OLButton>
            </div>
          </div>
        )}
        {preparando && (
          <p className="aemcicd-ai-nota" role="status">
            {preparando}
          </p>
        )}
        {confirmacion && (
          <div className="aemcicd-ai-estimacion" role="status">
            <p>
              Se enviarán unos{' '}
              {confirmacion.estimacion.tokensEntrada.toLocaleString('es-EC')}{' '}
              tokens. Costo máximo: $
              {(confirmacion.estimacion.maximoMicro / 1e6).toFixed(4)} (incluye
              la alternativa). Se cobra el uso real.
            </p>
            <div className="aemcicd-ai-botones">
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
          </div>
        )}
        <div
          className="aemcicd-ai-contexto"
          aria-label="Contexto de la consulta"
        >
          {chips()}
        </div>
        <div className="aemcicd-ai-redactar">
          <textarea
            className="form-control"
            rows={3}
            maxLength={funcion === 'tabla_excel' ? 20000 : 4000}
            placeholder={
              adjunto
                ? 'Opcional: qué hacer con el archivo (p. ej. «solo las ecuaciones»)'
                : funcion === 'tutor_latex'
                  ? '¿Qué quieres aprender de LaTeX?'
                  : 'Pide un cambio o pregunta sobre tu documento…'
            }
            aria-label="Mensaje para la IA"
            value={pregunta}
            onChange={e => setPregunta(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) enviar(e)
            }}
          />
          <div className="aemcicd-ai-barra-envio">
            <OLIconButton
              size="sm"
              variant="ghost"
              icon="attach_file"
              disabled={ocupado || !!preparando}
              accessibilityLabel={`Foto o PDF a LaTeX (hasta ${MAX_PAGINAS} páginas)`}
              onClick={() => archivoImagen.current?.click()}
            />
            <span className="aemcicd-ai-pista">Mayús+Enter: nueva línea</span>
            {ocupado && control.current ? (
              <OLButton
                size="sm"
                variant="secondary"
                onClick={() => control.current?.abort()}
              >
                Detener
              </OLButton>
            ) : (
              <OLButton
                size="sm"
                type="submit"
                variant="primary"
                disabled={
                  (!pregunta.trim() && !adjunto) || ocupado || !!preparando
                }
              >
                Enviar
              </OLButton>
            )}
          </div>
        </div>
      </form>
    </>
  )

  const herramientas = (
    <div className="aemcicd-ai-herramientas">
      <section>
        <h6>Atajos</h6>
        {ATAJOS.map(([clave, titulo, descripcion, plantilla]) => (
          <button
            key={clave}
            type="button"
            className="aemcicd-ai-herramienta"
            disabled={ocupado}
            onClick={() => usarAtajo(clave, plantilla)}
          >
            <strong>{titulo}</strong>
            <span>{descripcion}</span>
          </button>
        ))}
        <button
          type="button"
          className="aemcicd-ai-herramienta"
          disabled={ocupado}
          onClick={() => {
            archivoImagen.current?.click()
            setPestana('chat')
          }}
        >
          <strong>Foto o PDF a LaTeX</strong>
          <span>
            Una foto o un PDF de hasta {MAX_PAGINAS} páginas por consulta.
          </span>
        </button>
        <button
          type="button"
          className="aemcicd-ai-herramienta"
          disabled={ocupado}
          onClick={() => {
            setFuncion('tutor_latex')
            setPestana('chat')
          }}
        >
          <strong>Aprender LaTeX</strong>
          <span>Te explica paso a paso en lugar de escribirlo por ti.</span>
        </button>
      </section>
      <section>
        <AccionesFase2 />
        <AccionesFase3 />
      </section>
      {tieneInstrucciones === false && permisos.write && (
        <section>
          <h6>Instrucciones del proyecto</h6>
          <p className="aemcicd-ai-nota">
            Un archivo con el idioma, el tipo de documento y las normas que la
            IA debe respetar en todas las consultas.
          </p>
          <OLButton
            size="sm"
            variant="secondary"
            onClick={crearArchivoInstrucciones}
          >
            Crear instrucciones
          </OLButton>
        </section>
      )}
    </div>
  )

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
        <div className="aemcicd-ai-cabecera">
          <div className="aemcicd-ai-pestanas" role="tablist">
            {(
              [
                ['chat', 'Conversación'],
                ['herramientas', 'Herramientas'],
              ] as const
            ).map(([clave, titulo]) => (
              <button
                key={clave}
                type="button"
                role="tab"
                aria-selected={pestana === clave}
                className={pestana === clave ? 'activa' : undefined}
                onClick={() => setPestana(clave)}
              >
                {titulo}
              </button>
            ))}
          </div>
          {estado.saldo && <BarraSaldo saldo={estado.saldo} />}
        </div>
        {/* Las dos pestañas quedan montadas: los formularios de Herramientas conservan lo
            escrito al volver del chat. */}
        <div className="aemcicd-ai-vista" hidden={pestana !== 'chat'}>
          {chat}
        </div>
        <div className="aemcicd-ai-vista" hidden={pestana !== 'herramientas'}>
          {herramientas}
        </div>
        <input
          ref={archivoImagen}
          hidden
          aria-label="Foto o PDF a LaTeX"
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          onChange={e => {
            subir(e.target.files?.[0])
            e.target.value = ''
          }}
        />
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
