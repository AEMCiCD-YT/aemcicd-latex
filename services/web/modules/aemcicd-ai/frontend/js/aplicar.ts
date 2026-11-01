import { EditorState, Transaction } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import type { Cambio } from './api'

async function huellaDe(texto: string) {
  const resumen = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(texto)
  )
  return Array.from(new Uint8Array(resumen), b =>
    b.toString(16).padStart(2, '0')
  ).join('')
}

// Misma regla que ubicar() en app/src/cambios.mjs: primero en la posición prevista y, si el
// archivo cambió en otra parte (el estudiante o un compañero siguieron escribiendo), por
// contenido, siempre que el texto original aparezca una sola vez.
export function ubicar(texto: string, antes: string, desde: number) {
  if (!antes) return null
  if (desde >= 0 && texto.slice(desde, desde + antes.length) === antes)
    return { desde, hasta: desde + antes.length }
  const primera = texto.indexOf(antes)
  if (primera < 0 || texto.indexOf(antes, primera + 1) >= 0) return null
  return { desde: primera, hasta: primera + antes.length }
}

export async function aplicarEnEditor(
  view: EditorView,
  cambio: Cambio,
  autorizado: () => boolean
) {
  const documento = view.state.doc
  const texto = documento.toString()
  // Una inserción pura no tiene texto que buscar: solo vale si el archivo no cambió.
  const lugar = cambio.antes
    ? ubicar(texto, cambio.antes, cambio.desde)
    : cambio.desde === cambio.hasta &&
        cambio.desde >= 0 &&
        cambio.desde <= texto.length &&
        (await huellaDe(texto)) === cambio.huella
      ? { desde: cambio.desde, hasta: cambio.hasta }
      : null
  if (!autorizado() || view.state.facet(EditorState.readOnly))
    throw new Error('Necesitas permiso para editar este proyecto.')
  if (view.state.doc !== documento || !lugar)
    throw new Error(
      'El texto que había que cambiar ya no está igual. Vuelve a consultar antes de aplicar.'
    )
  view.dispatch({
    changes: { from: lugar.desde, to: lugar.hasta, insert: cambio.despues },
    annotations: Transaction.userEvent.of('input.aemcicd-ai'),
  })
  view.focus()
}
