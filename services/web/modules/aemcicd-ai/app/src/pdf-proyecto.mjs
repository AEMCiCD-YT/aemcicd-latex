import { dato, escapar } from './datos.mjs'
import { ErrorEntrada } from './entrada.mjs'

export const MAX_PDF_BYTES = 10 * 1024 * 1024
export async function extraerPdf(datos, ruta, cargar) {
  if (
    !(datos instanceof Uint8Array) ||
    datos.length > MAX_PDF_BYTES ||
    !Buffer.from(datos.subarray(0, 5)).equals(Buffer.from('%PDF-'))
  )
    throw new ErrorEntrada('El archivo debe ser un PDF de hasta 10 MiB.')
  let documento, tarea
  try {
    const getDocument =
      cargar || (await import('pdfjs-dist/legacy/build/pdf.mjs')).getDocument
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
      documento.numPages > 100
    )
      throw new ErrorEntrada(
        'Elige un PDF de entre 1 y 100 páginas; no se recortará en silencio.'
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
      if (caracteres > 500000)
        throw new ErrorEntrada(
          'El PDF contiene demasiado texto. Elige uno más pequeño; no se envió un fragmento parcial.'
        )
      paginas.push(
        dato('pagina_pdf', texto, ` ruta="${escapar(ruta)}" numero="${pagina}"`)
      )
      hoja.cleanup?.()
    }
    if (!tieneTexto)
      throw new ErrorEntrada(
        'No se pudo extraer texto del PDF. Un PDF escaneado requiere OCR; puedes usar Foto o PDF a LaTeX para una página.'
      )
    return paginas.join('\n\n')
  } catch (err) {
    if (err instanceof ErrorEntrada) throw err
    throw new ErrorEntrada(
      'No se pudo leer el PDF; comprueba que no esté cifrado ni dañado.'
    )
  } finally {
    await (documento ? documento.destroy() : tarea?.destroy())?.catch(() => {})
  }
}
