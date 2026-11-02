import { ErrorEntrada } from './entrada.mjs'

// Para atributos (ruta="…"): escapa todo lo que podría cerrar el atributo o la etiqueta.
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

// Etiquetas con las que el módulo marca el contenido del estudiante como datos.
export const ETIQUETAS_DATOS = [
  'documento',
  'pagina_pdf',
  'historial',
  'referencias_verificadas',
  'seleccion',
  'log',
  'imagen_del_estudiante',
  'instrucciones_del_estudiante',
]
const CIERRE = new RegExp(`</(?=\\s*(?:${ETIQUETAS_DATOS.join('|')})\\b)`, 'gi')

// El contenido va tal cual: LaTeX usa & y < en cada tabla y fórmula, y el modelo debe poder
// copiarlo exacto en «antes» y «despues». Solo se neutraliza un cierre de nuestras etiquetas
// («</documento» pasa a «<\/documento»), para que un archivo no pueda salir de su bloque.
export function neutralizar(contenido) {
  return String(contenido).replace(CIERRE, '<\\/')
}

export function dato(etiqueta, contenido, atributos = '') {
  return `<${etiqueta}${atributos}>\n${neutralizar(contenido)}\n</${etiqueta}>`
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
