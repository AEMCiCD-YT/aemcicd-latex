import { postJSON } from '@/infrastructure/fetch-json'
import type { DocumentContainer } from '@/features/ide-react/editor/document-container'
import type { CommentOperation } from '../../../../types/change'
import { AddCommentOperation } from 'overleaf-editor-core'
import Range from 'overleaf-editor-core/lib/range'
import { trackedDeletesFromState } from '@/features/source-editor/utils/tracked-deletes'
import { rangesUpdatedEffect } from '@/features/source-editor/extensions/history-ot'

// Identificador de hilo de 96 bits, del mismo formato que los comentarios nativos.
export function idComentario() {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), n =>
    n.toString(16).padStart(2, '0')
  ).join('')
}

export async function comentarIA(
  projectId: string,
  doc: DocumentContainer,
  desde: number,
  cita: string,
  contenido: string
) {
  const threadId = idComentario()
  await postJSON(`/project/${projectId}/thread/${threadId}/messages`, {
    body: { content: contenido },
  })
  // Reubicar después de la petición HTTP: un colaborador pudo editar mientras se publicaba.
  const texto = doc.cm6?.view.state.doc.toString() ?? ''
  const pos =
    texto.slice(desde, desde + cita.length) === cita
      ? desde
      : texto.indexOf(cita)
  if (!cita || pos < 0 || (pos !== desde && texto.indexOf(cita, pos + 1) >= 0))
    throw new Error(
      'El fragmento cambió; el comentario no se pudo anclar. Revisa el panel de revisión antes de repetirlo.'
    )
  if (doc.getType() === 'history-ot') {
    const view = doc.cm6!.view
    const punto = trackedDeletesFromState(view.state).toSnapshot(pos)
    doc.historyOTShareDoc.submitOp([
      new AddCommentOperation(threadId, [new Range(punto, cita.length)]),
    ])
    view.dispatch({ effects: rangesUpdatedEffect.of(null) })
  } else doc.submitOp({ c: cita, p: pos, t: threadId } as CommentOperation)
}
