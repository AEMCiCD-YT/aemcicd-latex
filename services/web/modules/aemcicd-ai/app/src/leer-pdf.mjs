import { ErrorEntrada } from './entrada.mjs'

export const MAX_PDF_PAGINAS = 100
export const MAX_PDF_CARACTERES = 500000

// Lógica de extracción, sin E/S. La usa el proceso hijo (pdf-hijo.mjs) y, en las pruebas, se
// llama directamente con un cargador simulado. Devuelve el texto de cada página.
export async function textoDePdf(datos, getDocument) {
  let documento, tarea
  try {
    tarea = getDocument({
      data: new Uint8Array(datos),
      isEvalSupported: false,
      useSystemFonts: false,
      disableFontFace: true,
      disableAutoFetch: true,
      verbosity: 0,
      stopAtErrors: true,
    })
    documento = await tarea.promise
    if (
      !Number.isInteger(documento.numPages) ||
      documento.numPages < 1 ||
      documento.numPages > MAX_PDF_PAGINAS
    )
      throw new ErrorEntrada(
        `Elige un PDF de entre 1 y ${MAX_PDF_PAGINAS} páginas; no se recortará en silencio.`
      )
    const paginas = []
    let caracteres = 0
    let tieneTexto = false
    for (let pagina = 1; pagina <= documento.numPages; pagina++) {
      const hoja = await documento.getPage(pagina)
      const contenido = await hoja.getTextContent()
      const texto = contenido.items
        .map(i =>
          typeof i.str === 'string' ? i.str + (i.hasEOL ? '\n' : ' ') : ''
        )
        .join('')
      caracteres += texto.length
      tieneTexto ||= Boolean(texto.trim())
      if (caracteres > MAX_PDF_CARACTERES)
        throw new ErrorEntrada(
          'El PDF contiene demasiado texto. Elige uno más pequeño; no se envió un fragmento parcial.'
        )
      paginas.push(texto)
      hoja.cleanup?.()
    }
    if (!tieneTexto)
      throw new ErrorEntrada(
        'No se pudo extraer texto del PDF. Si es escaneado, usa «Foto o PDF a LaTeX», que lee las páginas como imagen.'
      )
    return paginas
  } catch (err) {
    if (err instanceof ErrorEntrada) throw err
    throw new ErrorEntrada(
      'No se pudo leer el PDF; comprueba que no esté cifrado ni dañado.'
    )
  } finally {
    await (documento ? documento.destroy() : tarea?.destroy())?.catch(() => {})
  }
}
