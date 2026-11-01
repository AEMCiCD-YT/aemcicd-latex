import { useEffect, useMemo, useRef } from 'react'
import { micromark } from 'micromark'
import DOMPurify from 'dompurify'
import { loadMathJax } from '@/features/mathjax/load-mathjax'
import { debugConsole } from '@/utils/debugging'

// Markdown de las respuestas convertido a HTML seguro. micromark no deja pasar HTML crudo y
// DOMPurify limita las etiquetas a las de formato. Las fórmulas \( … \) y \[ … \] se dibujan con
// MathJax, como en el chat del editor.
const PURIFY = {
  ALLOWED_TAGS: [
    'p',
    'em',
    'strong',
    'a',
    'code',
    'ul',
    'ol',
    'li',
    'blockquote',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'br',
    'hr',
    'del',
  ],
  ALLOWED_ATTR: ['href'],
}

const escaparHtml = (t: string) =>
  t.replace(
    /[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!
  )

// Markdown trata \( como un escape (borra la barra) y _ o * como énfasis: las fórmulas se apartan
// antes de convertir y se devuelven, como texto escapado, al final.
function aHtml(texto: string) {
  const formulas: string[] = []
  const protegido = texto.replace(/\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]/g, f => {
    formulas.push(f)
    return `AEMCICDFORMULA${formulas.length - 1}X`
  })
  const html = limpiar(protegido)
  return html.replace(/AEMCICDFORMULA(\d+)X/g, (_, i) =>
    escaparHtml(formulas[Number(i)])
  )
}

function limpiar(texto: string) {
  DOMPurify.addHook('afterSanitizeAttributes', nodo => {
    if (nodo.nodeName === 'A') {
      nodo.setAttribute('target', '_blank')
      nodo.setAttribute('rel', 'noreferrer noopener')
    }
  })
  try {
    return DOMPurify.sanitize(micromark(texto), PURIFY)
  } finally {
    DOMPurify.removeHook('afterSanitizeAttributes')
  }
}

export default function Markdown({
  texto,
  formulas,
}: {
  texto: string
  // Solo al terminar la respuesta: dibujar fórmulas en cada trozo haría parpadear el texto.
  formulas: boolean
}) {
  const html = useMemo(() => aHtml(texto), [texto])
  const raiz = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!formulas || !raiz.current || !/\\\(|\\\[|\$/.test(texto)) return
    const elemento = raiz.current
    loadMathJax()
      .then(async MathJax => {
        await MathJax.typesetPromise([elemento])
        MathJax.typesetClear([elemento])
      })
      .catch(debugConsole.error)
  }, [formulas, html, texto])

  return (
    <div
      ref={raiz}
      className="aemcicd-ai-markdown"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
