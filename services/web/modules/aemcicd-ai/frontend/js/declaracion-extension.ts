import { EditorView } from '@codemirror/view'

export const extension = () =>
  EditorView.updateListener.of(actualizacion => {
    if (!actualizacion.docChanged) return
    const marca = '% AEMCICD-IA-DECLARACION-INICIO'
    if (
      actualizacion.startState.doc.toString().includes(marca) &&
      !actualizacion.state.doc.toString().includes(marca)
    )
      window.dispatchEvent(new Event('aemcicd-ai:declaracion-retirada'))
  })
