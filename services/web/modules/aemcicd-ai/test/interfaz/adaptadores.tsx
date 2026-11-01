// Adaptadores del entorno de Overleaf para el banco aislado. Los componentes del módulo y
// CodeMirror son reales; proyecto, permisos y transporte se simulan explícitamente.
import {
  createContext,
  useContext,
  PropsWithChildren,
  ButtonHTMLAttributes,
} from 'react'
import type { EditorView } from '@codemirror/view'

export const Banco = createContext<{
  view: EditorView
  escribir: boolean
  revision: number
} | null>(null)
const banco = () => useContext(Banco)!
export const useProjectContext = () => ({
  projectId: '0123456789abcdef01234567',
})
export const usePermissionsContext = () => ({ write: banco().escribir })
export const useRailContext = () => ({ openTab: () => {} })
let documento: { doc_id: string; cm6: { view: EditorView } }
export const useEditorOpenDocContext = () => {
  const { view } = banco()
  if (!documento || documento.cm6.view !== view)
    documento = { doc_id: 'doc-main', cm6: { view } }
  return { currentDocumentId: 'doc-main', currentDocument: documento }
}
export const useEditorPropertiesContext = () => ({ showVisual: false })
export const useEditorManagerContext = () => ({
  openDocWithId: async (id: string) => {
    if (id !== 'doc-main')
      throw new Error('El archivo no existe en el banco de prueba.')
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
