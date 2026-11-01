import { huella } from '../../app/src/proyecto.mjs'

export const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII='
export const SELECCION =
  'Los resultados de la Sección~\\ref{sec:metodo} muestran $x^2$.'
export const DOCUMENTO = {
  ruta: 'main.tex',
  id: 'doc-main',
  texto: SELECCION,
  huella: huella(SELECCION),
  version: 7,
}
export const CONTEXTO = {
  documentos: [DOCUMENTO],
  destino: {
    ...DOCUMENTO,
    desde: 0,
    hasta: SELECCION.length,
    seleccion: SELECCION,
  },
  fragmento: { ...DOCUMENTO, primeraLinea: 1 },
  instrucciones: 'Informe de prueba sin datos personales.',
  bloqueProyecto: '<documento ruta="main.tex">\nTexto de prueba.\n</documento>',
}
export const ENTRADAS = {
  corregir_error: {
    mensaje: 'Missing $ inserted',
    bruto: '! Missing $ inserted.\nl.1 x_1',
    archivo: 'main.tex',
    linea: 1,
  },
  corregir_advertencia: {
    mensaje: 'Overfull \\hbox',
    bruto: 'Overfull \\hbox (12pt too wide)',
    archivo: 'main.tex',
    linea: 1,
  },
  formula_texto: { pregunta: 'Integral gaussiana' },
  tabla_excel: { pregunta: 'Muestra\tValor\nA\t1\nB\t2' },
  esqueleto: { pregunta: 'Informe de Física II' },
  reescribir: { seleccion: SELECCION, accion: 'academico' },
  chat_proyecto: { pregunta: '¿Qué falta en la metodología?' },
  foto_latex: {
    pregunta: 'Transcribe esta imagen de prueba.',
    imagen: { base64: PNG },
  },
}
