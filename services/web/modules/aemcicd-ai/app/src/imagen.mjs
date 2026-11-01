import { ErrorEntrada } from './entrada.mjs'

export const MAX_IMAGEN_BYTES = 5 * 1024 * 1024
const MAX_LADO = 1600

// Se comprueba la firma y las dimensiones del formato, nunca el nombre o el MIME del navegador.
// PDF se rasteriza a PNG de una página en el navegador, usando el PDF.js que ya trae Overleaf.
export function validarImagen(imagen) {
  if (
    !imagen ||
    typeof imagen.base64 !== 'string' ||
    !imagen.base64 ||
    imagen.base64.length > Math.ceil(MAX_IMAGEN_BYTES / 3) * 4 ||
    imagen.base64.length % 4 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(imagen.base64)
  )
    throw new ErrorEntrada('Sube una imagen válida de hasta 5 MB.')
  const datos = Buffer.from(imagen.base64, 'base64')
  if (!datos.length || datos.length > MAX_IMAGEN_BYTES)
    throw new ErrorEntrada('La imagen supera los 5 MB.')
  let tipo, ancho, alto
  if (
    datos.length >= 33 &&
    datos
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    datos.toString('ascii', 12, 16) === 'IHDR'
  ) {
    tipo = 'image/png'
    ancho = datos.readUInt32BE(16)
    alto = datos.readUInt32BE(20)
  } else if (
    datos.length >= 12 &&
    datos[0] === 255 &&
    datos[1] === 216 &&
    datos[datos.length - 2] === 255 &&
    datos[datos.length - 1] === 217
  ) {
    tipo = 'image/jpeg'
    for (let i = 2; i + 8 < datos.length; ) {
      if (datos[i++] !== 255) break
      while (datos[i] === 255) i++
      const marcador = datos[i++]
      if (marcador === 0xda || marcador === 0xd9) break
      if (i + 2 > datos.length) break
      const longitud = datos.readUInt16BE(i)
      if (longitud < 2 || i + longitud > datos.length) break
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marcador)
      ) {
        if (longitud < 8 || i + 7 > datos.length) break
        alto = datos.readUInt16BE(i + 3)
        ancho = datos.readUInt16BE(i + 5)
        break
      }
      i += longitud
    }
  } else if (
    datos.length >= 30 &&
    datos.toString('ascii', 0, 4) === 'RIFF' &&
    datos.toString('ascii', 8, 12) === 'WEBP' &&
    datos.readUInt32LE(4) + 8 === datos.length
  ) {
    tipo = 'image/webp'
    const bloque = datos.toString('ascii', 12, 16)
    if (bloque === 'VP8X') {
      ancho = 1 + datos.readUIntLE(24, 3)
      alto = 1 + datos.readUIntLE(27, 3)
    } else if (bloque === 'VP8L' && datos[20] === 0x2f) {
      const bits = datos.readUInt32LE(21)
      ancho = (bits & 0x3fff) + 1
      alto = ((bits >>> 14) & 0x3fff) + 1
    } else if (
      bloque === 'VP8 ' &&
      datos.subarray(23, 26).equals(Buffer.from([0x9d, 1, 0x2a]))
    ) {
      ancho = datos.readUInt16LE(26) & 0x3fff
      alto = datos.readUInt16LE(28) & 0x3fff
    }
  }
  if (!tipo || !ancho || !alto || ancho > MAX_LADO || alto > MAX_LADO)
    throw new ErrorEntrada(
      'Sube una imagen PNG, JPEG o WebP de hasta 1600 píxeles por lado.'
    )
  return { datos, tipo, ancho, alto }
}
