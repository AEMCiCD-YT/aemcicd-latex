// Adaptadores del entorno de Overleaf para el banco aislado. Los componentes del módulo y
// CodeMirror son reales; proyecto, permisos y transporte se simulan explícitamente.
import {
  createContext,
  useContext,
  PropsWithChildren,
  ButtonHTMLAttributes,
} from 'react'
import type { EditorView } from '@codemirror/view'
import { StateEffect } from '@codemirror/state'

export const Banco = createContext<{
  view: EditorView
  escribir: boolean
  revision: number
} | null>(null)
const banco = () => useContext(Banco)!
export const useProjectContext = () => ({
  projectId: '0123456789abcdef01234567',
})
export const usePermissionsContext = () => ({
  write: banco().escribir,
  comment: banco().escribir,
  trackedWrite: banco().escribir,
})
export const useRailContext = () => ({
  openTab: (tab: string) => {
    Object.assign(window, { ultimoPanel: tab })
  },
})
export const useUserContext = () => ({
  id: '0123456789abcdef012345ab',
  first_name: 'Estudiante',
  last_name: 'de prueba',
})
export const useModalsContext = () => ({
  showGenericMessageModal: (titulo: string, texto: string) => {
    Object.assign(window, { avisoDeclaracion: { titulo, texto } })
  },
})
let documento: any
export const useEditorOpenDocContext = () => {
  const { view } = banco()
  if (!documento || documento.cm6.view !== view)
    documento = {
      doc_id: 'doc-main',
      cm6: { view },
      track_changes_as: null,
      getType: () =>
        location.search.includes('history') ? 'history-ot' : 'sharejs-text-ot',
      submitOp: (op: unknown) => {
        const w = window as any
        ;(w.comentariosLegacy ??= []).push(op)
      },
      historyOTShareDoc: {
        submitOp: (ops: unknown) => {
          const w = window as any
          ;(w.comentariosHistory ??= []).push(ops)
        },
      },
      withTrackedChanges: async (
        _user: string,
        action: () => Promise<void>
      ) => {
        Object.assign(window, { seguimientoActivo: true })
        try {
          await action()
        } finally {
          Object.assign(window, { seguimientoActivo: false })
        }
      },
    }
  return { currentDocumentId: 'doc-main', currentDocument: documento }
}
export const useEditorPropertiesContext = () => ({ showVisual: false })
export const useEditorManagerContext = () => ({
  openDocs: { awaitBufferedOps: async () => {} },
  openDocWithId: async (id: string) => {
    if (id === 'generado')
      return Object.assign(window, { generadoAbierto: true })
    if (id !== 'doc-main')
      throw new Error('El archivo no existe en el banco de prueba.')
  },
})
export const trackedDeletesFromState = () => ({
  toSnapshot: (pos: number) => pos,
})
export const rangesUpdatedEffect = StateEffect.define<null>()
export const PythonExecutionProvider = ({ children }: PropsWithChildren) => (
  <>{children}</>
)
const ejecutores = new Map<string, any>()
export const usePythonExecutionContext = () => ({
  getPythonRunner: (id: string) => {
    if (!ejecutores.has(id)) {
      let estado = { status: 'idle', output: [], error: null }
      const listeners = new Set<() => void>()
      ejecutores.set(id, {
        getState: () => estado,
        subscribe: (fn: () => void) => {
          listeners.add(fn)
          return () => listeners.delete(fn)
        },
        run: async () => {
          const w = window as any
          w.ejecucionesPython = (w.ejecucionesPython || 0) + 1
          estado = { ...estado, status: 'finished' }
          listeners.forEach(fn => fn())
        },
        interrupt: () => {},
      })
    }
    return ejecutores.get(id)
  },
})
export const useFileTreePathContext = () => ({
  pathInFolder: () => 'main.tex',
  findEntityByPath: (ruta: string) =>
    ruta === 'main.tex' ? { type: 'doc' } : null,
})
export const useCodeMirrorViewContext = () => banco().view
export const useCodeMirrorStateContext = () => banco().view.state
export const FullSizeLoadingSpinner = () => <p>Cargando…</p>
export const debugConsole = { error: () => {} }
export const loadMathJax = async () => ({
  typesetPromise: async () => {},
  typesetClear: () => {},
})

export async function getJSON<T>(url: string): Promise<T> {
  return json(url)
}
export async function postJSON<T>(
  url: string,
  opciones?: { body?: unknown }
): Promise<T> {
  return json(url, opciones?.body ?? {}, 'POST')
}
async function json(url: string, body?: unknown, method = 'GET') {
  const r = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Csrf-Token': 'csrf-de-prueba',
    },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  })
  const data = r.status === 204 ? undefined : await r.json()
  if (!r.ok)
    throw Object.assign(new Error('No se pudo completar la solicitud.'), {
      data,
    })
  return data
}

export function Boton({
  children,
  isLoading,
  variant,
  size,
  ...props
}: PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    isLoading?: boolean
    variant?: string
    size?: string
  }
>) {
  return (
    <button
      type="button"
      {...props}
      disabled={isLoading || props.disabled}
      className={`btn ${variant || ''}`}
    >
      {children}
    </button>
  )
}
export function Icono({ type }: { type: string }) {
  return <span aria-hidden="true">{type === 'smart_toy' ? '✦' : '•'}</span>
}
export function BotonIcono({
  accessibilityLabel,
  icon,
  variant,
  size,
  ...props
}: {
  accessibilityLabel: string
  icon: string
  variant?: string
  size?: string
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...props} aria-label={accessibilityLabel}>
      {icon === 'thumb_up'
        ? '👍'
        : icon === 'thumb_down'
          ? '👎'
          : icon === 'content_copy'
            ? '⧉'
            : '↻'}
    </button>
  )
}
export function Tooltip({ children }: PropsWithChildren) {
  return <>{children}</>
}
export function Cabecera({ title }: { title: string }) {
  return <h2>{title}</h2>
}

// Log de la última compilación: las pruebas lo fijan en window.bancoLog.
export const useDetachCompileContext = () => ({
  logEntries: (window as unknown as { bancoLog?: unknown }).bancoLog as
    | undefined
    | { errors: { level: string; message: string }[] },
  compiling: false,
  startCompile: () => {
    ;(window as unknown as { compilaciones?: number }).compilaciones =
      ((window as unknown as { compilaciones?: number }).compilaciones || 0) + 1
  },
})
export const useRootDoc = () => () => ({ rootResourcePath: 'main.tex' })
export const useLayoutContext = () => ({
  setView: (vista: string) => Object.assign(window, { vistaElegida: vista }),
})
export const Convertir = () => async () =>
  Object.assign(window, { wordSolicitado: true })
