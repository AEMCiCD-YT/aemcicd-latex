import { ErrorEntrada } from './entrada.mjs'
import { rutaSegura } from './datos.mjs'

function campos(objeto, nombres) {
  return (
    objeto &&
    typeof objeto === 'object' &&
    !Array.isArray(objeto) &&
    Object.keys(objeto).length === nombres.length &&
    nombres.every(n => Object.hasOwn(objeto, n))
  )
}

// Captura comandos y fórmulas en orden. Para citas/referencias/etiquetas conserva también sus
// argumentos; en los demás comandos permite mejorar el texto del argumento.
function segmentosProtegidos(texto) {
  const salida = []
  const patron =
    /\\begin\{((?:equation|align|alignat|gather|multline|displaymath|math|eqnarray|flalign|IEEEeqnarray|IEEEeqnarraybox|dmath|dgroup)\*?)\}[\s\S]*?\\end\{\1\}|\$\$(?:\\.|(?!\$\$)[\s\S])*?\$\$|\$(?:\\.|[^$\\])*?\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\\(?:[a-zA-Z@]+\*?|[^a-zA-Z@])/g
  let m
  while ((m = patron.exec(texto))) {
    let token = m[0]
    if (
      /^\\(?:[a-zA-Z]*cite[a-zA-Z]*|[a-zA-Z]*ref|label|begin|end)\*?$/i.test(
        token
      )
    ) {
      let pos = patron.lastIndex
      while (/\s/.test(texto[pos] || '') && pos < texto.length) pos++
      while (texto[pos] === '[' || texto[pos] === '{') {
        const abrir = texto[pos],
          cerrar = abrir === '[' ? ']' : '}'
        let nivel = 0
        do {
          const c = texto[pos++]
          if (c === '\\') {
            pos++
            continue
          }
          if (c === abrir) nivel++
          if (c === cerrar) nivel--
        } while (pos < texto.length && nivel)
        if (nivel)
          throw new ErrorEntrada('La selección contiene un comando sin cerrar.')
        token += texto.slice(patron.lastIndex, pos)
        patron.lastIndex = pos
        while (/\s/.test(texto[pos] || '') && pos < texto.length) pos++
      }
    }
    salida.push({ texto: token, desde: m.index, hasta: m.index + token.length })
  }
  return salida
}

export function protegidos(texto) {
  return segmentosProtegidos(texto).map(s => s.texto)
}

export function validarSeleccionProtegida(texto, desde, hasta) {
  if (
    segmentosProtegidos(texto).some(
      s =>
        desde < s.hasta &&
        hasta > s.desde &&
        (desde > s.desde || hasta < s.hasta)
    )
  )
    throw new ErrorEntrada(
      'La selección corta una fórmula, cita o comando. Selecciona el párrafo completo antes de reescribir.'
    )
}

// Los modelos a veces envuelven el JSON en ```json … ``` o añaden una frase antes, aunque se les
// pida que no. Se acepta el primer objeto JSON del texto; el formato se valida igual de estricto.
export function leerJson(texto) {
  const limpio = String(texto)
    .trim()
    .replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/i, '$1')
    .trim()
  try {
    return JSON.parse(limpio)
  } catch {
    const inicio = limpio.indexOf('{')
    const fin = limpio.lastIndexOf('}')
    if (inicio < 0 || fin <= inicio) throw new SyntaxError('sin JSON')
    return JSON.parse(limpio.slice(inicio, fin + 1))
  }
}

const ENTIDADES = /&(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi

// Una entidad HTML en «despues» que no estaba en «antes» es casi siempre un error del modelo
// (&amp; en lugar de &) y rompería el LaTeX del estudiante.
function entidadesNuevas(antes, despues) {
  const previas = new Set(
    (antes.match(ENTIDADES) || []).map(e => e.toLowerCase())
  )
  return (despues.match(ENTIDADES) || []).some(
    e => !previas.has(e.toLowerCase())
  )
}

// Ubica «antes» en el texto actual. Primero en la posición prevista; si el archivo cambió en
// otra parte, por contenido, siempre que aparezca una sola vez. Así seguir escribiendo en otro
// lugar (o un compañero) no invalida la propuesta. Devuelve null si no se puede ubicar.
export function ubicar(texto, antes, desde) {
  if (!antes) return null
  if (
    Number.isInteger(desde) &&
    desde >= 0 &&
    texto.slice(desde, desde + antes.length) === antes
  )
    return { desde, hasta: desde + antes.length }
  const primera = texto.indexOf(antes)
  if (primera < 0 || texto.indexOf(antes, primera + 1) >= 0) return null
  return { desde: primera, hasta: primera + antes.length }
}

export async function validarRespuesta(texto, contexto, sesion, nombre) {
  let respuesta
  try {
    respuesta = leerJson(texto)
  } catch {
    throw new ErrorEntrada(
      'La respuesta no tiene un formato de cambios válido. Vuelve a intentarlo.'
    )
  }
  if (
    !campos(respuesta, ['explicacion', 'cambios']) ||
    typeof respuesta.explicacion !== 'string' ||
    respuesta.explicacion.length > 30000 ||
    !Array.isArray(respuesta.cambios) ||
    respuesta.cambios.length > 8
  )
    throw new ErrorEntrada(
      'La respuesta no tiene un formato de cambios válido.'
    )
  const cambios = []
  for (const cambio of respuesta.cambios) {
    if (
      !campos(cambio, ['archivo', 'antes', 'despues']) ||
      typeof cambio.antes !== 'string' ||
      typeof cambio.despues !== 'string' ||
      cambio.antes.length > 30000 ||
      cambio.despues.length > 30000 ||
      cambio.antes === cambio.despues
    )
      throw new ErrorEntrada('La propuesta contiene un cambio no válido.')
    if (entidadesNuevas(cambio.antes, cambio.despues))
      throw new ErrorEntrada(
        'La propuesta escribió entidades HTML (como &amp;) en lugar de LaTeX. Vuelve a intentarlo.'
      )
    rutaSegura(cambio.archivo)
    const original = contexto.documentos.find(d => d.ruta === cambio.archivo)
    if (!original)
      throw new ErrorEntrada(
        'La propuesta usa un archivo que no se envió a la IA.'
      )
    // El archivo puede haber cambiado mientras respondía la IA (el estudiante sigue escribiendo):
    // el cambio se ubica en el texto actual por su contenido, no por un hash del archivo entero.
    const doc = await sesion.leer(cambio.archivo)
    let desde, hasta
    if (contexto.destino) {
      const d = contexto.destino
      if (
        cambio.archivo !== d.ruta ||
        cambio.antes !== d.seleccion ||
        respuesta.cambios.length !== 1
      )
        throw new ErrorEntrada(
          'La propuesta intenta cambiar texto fuera de la selección.'
        )
      if (d.seleccion) {
        const lugar = ubicar(doc.texto, d.seleccion, d.desde)
        if (!lugar)
          throw new ErrorEntrada(
            'El texto seleccionado cambió mientras respondía la IA. Vuelve a consultar.'
          )
        ;({ desde, hasta } = lugar)
      } else {
        // Inserción en el cursor: sin texto que buscar, la posición solo vale si el archivo
        // no cambió.
        if (doc.huella !== original.huella)
          throw new ErrorEntrada(
            'El archivo cambió mientras respondía la IA. Vuelve a consultar.'
          )
        desde = hasta = d.desde
      }
    } else {
      if (!cambio.antes)
        throw new ErrorEntrada(
          'La propuesta no identifica el texto que hay que reemplazar.'
        )
      const lugar = ubicar(doc.texto, cambio.antes)
      if (!lugar)
        throw new ErrorEntrada(
          'El texto original no existe o aparece varias veces. Vuelve a consultar.'
        )
      ;({ desde, hasta } = lugar)
      if (
        contexto.fragmento &&
        !contexto.fragmento.texto.includes(cambio.antes)
      )
        throw new ErrorEntrada(
          'El cambio queda fuera de las líneas enviadas a la IA.'
        )
    }
    if (
      nombre === 'reescribir' &&
      JSON.stringify(protegidos(cambio.antes)) !==
        JSON.stringify(protegidos(cambio.despues))
    )
      throw new ErrorEntrada(
        'La propuesta alteró un comando, una cita o una fórmula. No se puede aplicar; vuelve a intentarlo.'
      )
    if (
      cambios.some(
        c => c.archivo === cambio.archivo && c.desde < hasta && desde < c.hasta
      )
    )
      throw new ErrorEntrada('La propuesta contiene cambios superpuestos.')
    cambios.push({ ...cambio, docId: doc.id, desde, hasta, huella: doc.huella })
  }
  // Los cambios del mismo archivo se ofrecen como una propuesta atómica. Aplicar el primero
  // por separado invalidaría la huella de los demás, y dejaría correcciones incompletas.
  const agrupados = []
  for (const archivo of new Set(cambios.map(c => c.archivo))) {
    const partes = cambios
      .filter(c => c.archivo === archivo)
      .sort((a, b) => a.desde - b.desde)
    if (partes.length === 1) {
      agrupados.push(partes[0])
      continue
    }
    const doc = await sesion.leer(archivo)
    const desde = partes[0].desde,
      hasta = partes.at(-1).hasta
    const antes = doc.texto.slice(desde, hasta)
    let despues = antes
    for (const parte of [...partes].reverse())
      despues =
        despues.slice(0, parte.desde - desde) +
        parte.despues +
        despues.slice(parte.hasta - desde)
    agrupados.push({ ...partes[0], desde, hasta, antes, despues })
  }
  return { explicacion: respuesta.explicacion, cambios: agrupados }
}

// Se repite al pulsar Aplicar. Ni Mongo ni document-updater reciben escrituras de propuestas.
export async function verificarCambio(cambio, sesion) {
  if (
    !campos(cambio, [
      'archivo',
      'antes',
      'despues',
      'docId',
      'desde',
      'hasta',
      'huella',
    ]) ||
    typeof cambio.antes !== 'string' ||
    typeof cambio.despues !== 'string' ||
    cambio.despues.length > 30000 ||
    !Number.isInteger(cambio.desde) ||
    !Number.isInteger(cambio.hasta)
  )
    throw new ErrorEntrada('El cambio no es válido.')
  const doc = await sesion.leer(rutaSegura(cambio.archivo))
  if (doc.id !== cambio.docId)
    throw new ErrorEntrada('El cambio no corresponde a este archivo.')
  // Con texto que reemplazar, se ubica por contenido (ver ubicar). Una inserción pura no tiene
  // texto que buscar: su posición solo vale si el archivo no cambió.
  const lugar = cambio.antes
    ? ubicar(doc.texto, cambio.antes, cambio.desde)
    : doc.huella === cambio.huella &&
        cambio.desde === cambio.hasta &&
        cambio.desde >= 0 &&
        cambio.desde <= doc.texto.length
      ? { desde: cambio.desde, hasta: cambio.hasta }
      : null
  if (!lugar)
    throw new ErrorEntrada(
      'El texto que había que cambiar ya no está igual. Vuelve a consultar antes de aplicar.'
    )
  return { ...cambio, ...lugar }
}
