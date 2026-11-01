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

export async function validarRespuesta(texto, contexto, sesion, nombre) {
  let respuesta
  try {
    respuesta = JSON.parse(texto)
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
    rutaSegura(cambio.archivo)
    const original = contexto.documentos.find(d => d.ruta === cambio.archivo)
    if (!original)
      throw new ErrorEntrada(
        'La propuesta usa un archivo que no se envió a la IA.'
      )
    const doc = await sesion.leer(cambio.archivo)
    if (doc.huella !== original.huella)
      throw new ErrorEntrada(
        'El archivo cambió mientras respondía la IA. Vuelve a consultar.'
      )
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
      desde = d.desde
      hasta = d.hasta
    } else {
      if (!cambio.antes)
        throw new ErrorEntrada(
          'La propuesta no identifica el texto que hay que reemplazar.'
        )
      desde = doc.texto.indexOf(cambio.antes)
      if (desde < 0 || doc.texto.indexOf(cambio.antes, desde + 1) >= 0)
        throw new ErrorEntrada(
          'El texto original no existe o aparece varias veces. Vuelve a consultar.'
        )
      hasta = desde + cambio.antes.length
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
  if (
    doc.id !== cambio.docId ||
    doc.huella !== cambio.huella ||
    cambio.desde < 0 ||
    cambio.hasta < cambio.desde ||
    cambio.hasta > doc.texto.length ||
    doc.texto.slice(cambio.desde, cambio.hasta) !== cambio.antes
  )
    throw new ErrorEntrada(
      'El archivo cambió. Vuelve a consultar antes de aplicar.'
    )
  return cambio
}
