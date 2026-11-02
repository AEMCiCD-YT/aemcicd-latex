import { ErrorEntrada } from './entrada.mjs'

export const AVISO_DECLARACION =
  'Algunas materias, revistas y la normativa de la universidad exigen declarar el uso de IA. Si la borras, lo haces bajo tu responsabilidad.'
export const INICIO_DECLARACION = '% AEMCICD-IA-DECLARACION-INICIO'
export const FIN_DECLARACION = '% AEMCICD-IA-DECLARACION-FIN'
const escaparLatex = t =>
  String(t).replace(
    /[\\{}%&#_$~^]/g,
    c =>
      ({
        '\\': '\\textbackslash{}',
        '{': '\\{',
        '}': '\\}',
        '%': '\\%',
        '&': '\\&',
        '#': '\\#',
        _: '\\_',
        $: '\\$',
        '~': '\\textasciitilde{}',
        '^': '\\textasciicircum{}',
      })[c]
  )

// No consume IA: describe el registro sin confundir envío a revisión con aceptación final.
export function prepararDeclaracion(doc, registro, retirar = false) {
  const inicio = doc.texto.indexOf(INICIO_DECLARACION)
  const fin = doc.texto.indexOf(FIN_DECLARACION)
  if (
    inicio >= 0 !== fin >= 0 ||
    (inicio >= 0 && fin < inicio) ||
    doc.texto.indexOf(INICIO_DECLARACION, inicio + 1) >= 0 ||
    doc.texto.indexOf(FIN_DECLARACION, fin + 1) >= 0
  )
    throw new ErrorEntrada(
      'Revisa los delimitadores de la declaración existente antes de continuar.'
    )
  const anterior =
    inicio >= 0 ? doc.texto.slice(inicio, fin + FIN_DECLARACION.length) : null
  if (retirar && !anterior)
    throw new ErrorEntrada(
      'El documento no contiene una declaración generada por el asistente.'
    )
  if (!retirar && !registro.length)
    throw new ErrorEntrada(
      'Todavía no hay acciones registradas en el proyecto.'
    )
  const funciones = [...new Set(registro.map(r => r.funcion))].map(escaparLatex)
  const bloque = `${INICIO_DECLARACION}\n\\section*{Declaración de uso de inteligencia artificial}\nSe utilizó el Asistente de IA del Programa AEMCiCD LaTeX como apoyo en las siguientes funciones registradas: ${funciones.join(', ')}. El registro incluye propuestas enviadas a revisión, observaciones publicadas y scripts guardados; no certifica su aceptación final ni su presencia en esta versión. La revisión final, la verificación de resultados y la responsabilidad sobre su contenido corresponden a sus autores. Esta declaración debe ajustarse a los usos efectivamente incorporados y no permite descartar otros usos de IA.\n${FIN_DECLARACION}`
  const ancla = anterior ?? '\\end{document}'
  const desde = doc.texto.indexOf(ancla)
  if (desde < 0 || doc.texto.indexOf(ancla, desde + 1) >= 0)
    throw new ErrorEntrada(
      'Abre el documento principal con un único \\end{document} para insertar la declaración.'
    )
  return {
    archivo: doc.ruta,
    docId: doc.id,
    antes: ancla,
    despues: retirar ? '' : anterior ? bloque : bloque + '\n\n' + ancla,
    desde,
    hasta: desde + ancla.length,
    huella: doc.huella,
  }
}
