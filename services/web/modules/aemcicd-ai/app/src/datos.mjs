import { ErrorEntrada } from './entrada.mjs'

// Escapar delimitadores impide que un archivo cierre su propio bloque de datos.
export function escapar(valor) {
  return String(valor).replace(
    /[&<>"']/g,
    c =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;',
      })[c]
  )
}

export function dato(etiqueta, contenido, atributos = '') {
  return `<${etiqueta}${atributos}>\n${escapar(contenido)}\n</${etiqueta}>`
}

export function documentoComoDatos(doc) {
  return dato('documento', doc.texto, ` ruta="${escapar(doc.ruta)}"`)
}

export function rutaSegura(valor) {
  if (
    typeof valor !== 'string' ||
    !valor ||
    valor.length > 500 ||
    /[\\\x00-\x1f]/.test(valor) ||
    valor.startsWith('/') ||
    valor.split('/').some(p => !p || p === '.' || p === '..')
  ) {
    throw new ErrorEntrada('La ruta del archivo no es válida.')
  }
  return valor
}
