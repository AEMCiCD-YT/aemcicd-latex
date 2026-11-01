// No se guarda el archivo: solo su imagen reducida permanece en memoria hasta enviar la consulta.
export async function prepararImagen(
  archivo: File
): Promise<{ base64: string }> {
  if (archivo.size > 5 * 1024 * 1024)
    throw new Error('El archivo supera los 5 MB.')
  const cabecera = new Uint8Array(await archivo.slice(0, 12).arrayBuffer())
  let fuente: CanvasImageSource
  let ancho: number, alto: number
  let limpiar = () => {}
  if (new TextDecoder().decode(cabecera.slice(0, 5)) === '%PDF-') {
    const { PDFJS } = await import('@/features/pdf-preview/util/pdf-js')
    const tarea = PDFJS.getDocument({
      data: await archivo.arrayBuffer(),
      isEvalSupported: false,
      enableXfa: false,
    })
    try {
      const pdf = await tarea.promise
      if (pdf.numPages !== 1)
        throw new Error('Elige un PDF de una sola página.')
      const pagina = await pdf.getPage(1)
      const original = pagina.getViewport({ scale: 1 })
      const viewport = pagina.getViewport({
        scale: Math.min(2, 1600 / Math.max(original.width, original.height)),
      })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      await pagina.render({ canvasContext: canvas.getContext('2d')!, viewport })
        .promise
      fuente = canvas
      ancho = canvas.width
      alto = canvas.height
    } finally {
      await tarea.destroy()
    }
  } else {
    const bitmap = await createImageBitmap(archivo)
    fuente = bitmap
    ancho = bitmap.width
    alto = bitmap.height
    limpiar = () => bitmap.close()
  }
  try {
    const escala = Math.min(1, 1600 / Math.max(ancho, alto))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.floor(ancho * escala))
    canvas.height = Math.max(1, Math.floor(alto * escala))
    const contexto = canvas.getContext('2d')!
    contexto.fillStyle = '#fff'
    contexto.fillRect(0, 0, canvas.width, canvas.height)
    contexto.drawImage(fuente, 0, 0, canvas.width, canvas.height)
    const base64 = canvas.toDataURL('image/png').split(',')[1]
    if ((base64.length * 3) / 4 > 5 * 1024 * 1024)
      throw new Error(
        'La imagen reducida supera los 5 MB. Usa una imagen más pequeña.'
      )
    return { base64 }
  } finally {
    limpiar()
  }
}
