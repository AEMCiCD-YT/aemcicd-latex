import { ErrorEntrada } from './entrada.mjs'
import { dato } from './datos.mjs'
import { leerJson, ubicar } from './cambios.mjs'

export const ESQUEMA_COMENTARIOS = {
  type: 'object',
  additionalProperties: false,
  required: ['explicacion', 'comentarios'],
  properties: {
    explicacion: { type: 'string' },
    comentarios: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['archivo', 'cita', 'comentario'],
        properties: {
          archivo: { type: 'string' },
          cita: { type: 'string' },
          comentario: { type: 'string' },
        },
      },
    },
  },
}
export const ESQUEMA_GRAFICA = {
  type: 'object',
  additionalProperties: false,
  required: ['explicacion', 'script'],
  properties: { explicacion: { type: 'string' }, script: { type: 'string' } },
}

export function textoFase2(valor, maximo, nombre) {
  if (typeof valor !== 'string' || !valor.trim() || valor.length > maximo)
    throw new ErrorEntrada(
      `${nombre} debe tener entre 1 y ${maximo} caracteres.`
    )
  return valor
}

export const SOPORTE = `Base de ayuda del Programa AEMCiCD LaTeX:
- Las cuentas se solicitan y los comprobantes se entregan en https://plataforma.aemcicd.org/latex.
- Consulta precios, fechas, plazos y condiciones vigentes en esa página. No inventes importes.
- El usuario es el correo institucional. Si olvidó la contraseña, usa la recuperación de acceso del servidor.
- Si la cuenta está suspendida, revisa los pagos y contacta asoemc@yachaytech.edu.ec; no afirmes que puedes reactivarla ni comprobar pagos.
- La IA se activa voluntariamente en el panel Asistente de IA. Tiene crédito mensual y puede pausarse por presupuesto; la barra muestra el saldo y la renovación.
- Los errores de compilación se ven en Logs. «Corregir con IA» propone cambios que tú revisas.
- Importa Word (.docx) o un ZIP exportado desde Prism desde Nuevo proyecto. Conserva una copia y revisa el resultado.
- Las gráficas se ejecutan con Python en tu navegador, solo cuando lo pides; revisa el script antes.
- No solicites contraseñas, claves, documentos, comprobantes ni datos de otros estudiantes.
- No tienes acceso a pagos, inscripciones, cuentas ni soporte humano. Si hace falta revisar un caso, deriva al correo institucional.
- Los términos oficiales están en https://plataforma.aemcicd.org/latex/terminos.`

export function funcionesFase2(sistema) {
  function delProyecto(nivel, resumen, instruccion, extra = {}) {
    return {
      nivel,
      maxSalida: 8000,
      minSalida: 500,
      usaProyecto: true,
      resumen: () => resumen,
      ...extra,
      preparar(entrada, contexto = {}) {
        const pregunta = textoFase2(entrada?.pregunta, 4000, 'La solicitud')
        if (!contexto.bloqueProyecto)
          throw new ErrorEntrada(
            'El proyecto no contiene archivos de texto compatibles.'
          )
        return {
          sistema: sistema + '\n\n' + instruccion,
          mensajes: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: contexto.bloqueProyecto,
                  providerOptions: {
                    anthropic: { cacheControl: { type: 'ephemeral' } },
                  },
                },
                {
                  type: 'text',
                  text: [
                    contexto.instrucciones
                      ? dato(
                          'instrucciones_del_estudiante',
                          contexto.instrucciones
                        )
                      : '',
                    pregunta,
                  ]
                    .filter(Boolean)
                    .join('\n\n'),
                },
              ],
            },
          ],
        }
      },
    }
  }
  return {
    revisor_jurado: delProyecto(
      'proyecto',
      'añadió observaciones de revisión académica',
      `Actúa como revisor académico: examina claridad, método, evidencia, estructura y limitaciones. No inventes resultados, fuentes ni exigencias institucionales. Separa observaciones de afirmaciones verificadas. Responde JSON {"explicacion":"Resumen breve","comentarios":[{"archivo":"ruta","cita":"texto literal y único del documento","comentario":"observación concreta y accionable"}]}. Máximo 12 comentarios; el estudiante decide cuáles publicar en el margen.`,
      { respuesta: 'comentarios', esquema: ESQUEMA_COMENTARIOS }
    ),
    revisar_entrega: delProyecto(
      'rapido',
      'corrigió ortografía antes de entregar',
      `Revisa ortografía y gramática en español e inglés con contexto técnico y prepara una lista de chequeo antes de entregar: secciones incompletas, marcadores TODO, referencias y citas no resueltas, figuras/tablas sin descripción, unidades y requisitos que no puedan comprobarse. No declares que compila ni que cumple una norma que no conoces. Conserva intactos comandos, fórmulas, etiquetas y claves bibliográficas. Responde JSON {"explicacion":"Lista de chequeo en Markdown con asuntos comprobados y por verificar","cambios":[{"archivo":"ruta","antes":"texto exacto y único","despues":"corrección"}]}. Máximo 8 cambios mínimos, sin campos extra.`,
      { propuesta: true }
    ),
    revisar_importacion: delProyecto(
      'proyecto',
      'revisó un documento importado',
      `Revisa el documento importado desde Word o Prism: estructura LaTeX, comandos mal convertidos, paquetes faltantes, bibliografía y recursos. No inventes imágenes, referencias ni resultados. No afirmes que compiló: pide revisar los Logs cuando no puedas comprobarlo. Responde JSON {"explicacion":"Qué revisar al compilar","cambios":[{"archivo":"ruta","antes":"texto exacto y único","despues":"arreglo mínimo"}]}. Máximo 8 cambios, sin campos extra.`,
      { propuesta: true }
    ),
    grafica_datos: {
      nivel: 'escritura',
      maxSalida: 8000,
      minSalida: 500,
      respuesta: 'grafica',
      esquema: ESQUEMA_GRAFICA,
      resumen: () => 'creó una gráfica desde datos',
      preparar(entrada, contexto = {}) {
        const pregunta = textoFase2(
          entrada?.pregunta,
          4000,
          'La descripción de la gráfica'
        )
        const datos = textoFase2(
          contexto.datosGrafica ?? entrada?.seleccion,
          50000,
          'Los datos'
        )
        return {
          sistema:
            sistema +
            `\nGenera un script Python revisable para Pyodide, no lo ejecutes. Responde JSON {"explicacion":"Qué hace el ajuste y qué debe revisar el estudiante","script":"código Python"}. El servidor antepone datos_csv con los datos originales y el estilo AEMCiCD-Origin (matplotlib, sin LaTeX externo). Usa csv/io para leer datos_csv, numpy y scipy para analizar. Conserva los datos; nunca inventes mediciones ni sustituyas datos_csv. Soporta según la solicitud: recta y R², exponencial, gaussiana, lorentziana, Michaelis-Menten o función personalizada con scipy.optimize.curve_fit; calibración, titulación, UV-Vis, IR (eje invertido), DRX, cinética, Arrhenius, picos, corrección de línea base, doble eje Y y barras de error. Expón parámetros ajustados, incertidumbres y supuestos; falla con un mensaje claro si faltan columnas o puntos. No evalúes cadenas con eval/exec ni descargues paquetes. Guarda las figuras vectoriales usando exactamente ruta_pdf (ya definida), con plt.savefig(ruta_pdf, format='pdf', bbox_inches='tight'); no uses plt.show(). No ejecutes procesos ni operaciones de red.`,
          mensajes: [
            {
              role: 'user',
              content: [
                contexto.instrucciones
                  ? dato('instrucciones_del_estudiante', contexto.instrucciones)
                  : '',
                dato('seleccion', datos),
                pregunta,
              ]
                .filter(Boolean)
                .join('\n\n'),
            },
          ],
        }
      },
    },
    soporte: {
      nivel: 'rapido',
      maxSalida: 3000,
      minSalida: 200,
      resumen: () => 'consultó la ayuda del programa',
      preparar(entrada) {
        return {
          sistema:
            sistema +
            '\n\nResponde solo sobre soporte del programa y del editor a partir de esta base. No simules acceso a cuentas ni prometas intervenciones.\n' +
            SOPORTE,
          mensajes: [
            {
              role: 'user',
              content: dato(
                'seleccion',
                textoFase2(entrada?.pregunta, 4000, 'La pregunta de soporte')
              ),
            },
          ],
        }
      },
    },
  }
}

export async function validarComentarios(texto, contexto, sesion) {
  const r = leerJson(texto)
  if (
    !r ||
    Object.keys(r).sort().join(',') !== 'comentarios,explicacion' ||
    typeof r.explicacion !== 'string' ||
    r.explicacion.length > 30000 ||
    !Array.isArray(r.comentarios) ||
    r.comentarios.length > 12
  )
    throw new ErrorEntrada('La revisión no tiene un formato válido.')
  const comentarios = []
  for (const c of r.comentarios) {
    if (!c || Object.keys(c).sort().join(',') !== 'archivo,cita,comentario')
      throw new ErrorEntrada('La observación no tiene un formato válido.')
    textoFase2(c.cita, 3000, 'La cita')
    textoFase2(c.comentario, 2000, 'La observación')
    if (!contexto.documentos.some(d => d.ruta === c.archivo))
      throw new ErrorEntrada('La observación usa un archivo ajeno al contexto.')
    const doc = await sesion.leer(c.archivo)
    const lugar = ubicar(doc.texto, c.cita)
    if (!lugar)
      throw new ErrorEntrada(
        'El fragmento de la observación cambió o aparece varias veces.'
      )
    comentarios.push({ ...c, docId: doc.id, ...lugar })
  }
  return { explicacion: r.explicacion, comentarios }
}

export function validarGrafica(texto, datos, eventoId) {
  const r = leerJson(texto)
  if (
    !r ||
    Object.keys(r).sort().join(',') !== 'explicacion,script' ||
    typeof r.explicacion !== 'string' ||
    r.explicacion.length > 30000
  )
    throw new ErrorEntrada('La gráfica no tiene un formato válido.')
  textoFase2(r.script, 30000, 'El script')
  if (
    !/\bruta_pdf\b/.test(r.script) ||
    /\b(?:eval|exec|__import__)\s*\(|\b(?:requests|urllib|socket|subprocess)\b/.test(
      r.script
    )
  )
    throw new ErrorEntrada(
      'Revisa la solicitud: el script debe producir un PDF local sin red ni ejecución dinámica.'
    )
  const archivo = `graficas/grafica-${eventoId}.py`
  const prefijo = `# Generado por IA: revisa datos, ajuste y supuestos antes de ejecutar.\nimport matplotlib\nmatplotlib.use('Agg')\nimport matplotlib.pyplot as plt\nplt.rcParams.update({'xtick.direction':'in', 'ytick.direction':'in', 'xtick.top':True, 'ytick.right':True, 'axes.linewidth':1.2, 'font.size':11, 'figure.figsize':(6,4), 'savefig.format':'pdf', 'text.usetex':False})\ndatos_csv = ${JSON.stringify(datos)}\nruta_pdf = ${JSON.stringify(archivo.replace(/\.py$/, '.pdf'))}\n\n`
  return {
    explicacion: r.explicacion,
    grafica: { archivo, script: prefijo + r.script },
  }
}
