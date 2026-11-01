import { EditorState, Transaction } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import type { Cambio } from './api'

export async function aplicarEnEditor(
  view: EditorView,
  cambio: Cambio,
  autorizado: () => boolean
) {
  const documento = view.state.doc
  const resumen = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(documento.toString())
  )
  const huella = Array.from(new Uint8Array(resumen), b =>
    b.toString(16).padStart(2, '0')
  ).join('')
  if (!autorizado() || view.state.facet(EditorState.readOnly))
    throw new Error('Necesitas permiso para editar este proyecto.')
  if (
    view.state.doc !== documento ||
    huella !== cambio.huella ||
    cambio.desde < 0 ||
    cambio.hasta < cambio.desde ||
    cambio.hasta > documento.length ||
    view.state.sliceDoc(cambio.desde, cambio.hasta) !== cambio.antes
  )
    throw new Error('El archivo cambió. Vuelve a consultar antes de aplicar.')
  view.dispatch({
    changes: { from: cambio.desde, to: cambio.hasta, insert: cambio.despues },
    annotations: Transaction.userEvent.of('input.aemcicd-ai'),
  })
  view.focus()
}
