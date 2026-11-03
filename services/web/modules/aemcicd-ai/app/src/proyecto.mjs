import { createHash } from 'node:crypto'
import { documentoComoDatos, rutaSegura } from './datos.mjs'
import { ErrorEntrada, funcion } from './funciones.mjs'
import { estimarTokens } from './precios.mjs'
import { validarSeleccionProtegida } from './cambios.mjs'
import { extraerPdf } from './pdf-proyecto.mjs'
import { textoFase2 } from './fase2.mjs'
import { intervaloHistorial } from './historial.mjs'

// Un archivo abierto de hasta este tamaño se envía completo; si es más grande, la zona del cursor.
export const MAX_ARCHIVO_ABIERTO = 60000

function normalizarRuta(ruta) {
  if (typeof ruta !== 'string') return null
  const limpia = ruta.replace(/^\.\//, '').trim()
  try {
    return rutaSegura(limpia)
  } catch {
    return null
  }
}

// Errores del log de la última compilación, tal como los muestra el editor (máximo 10).
export function normalizarErrores(errores) {
  if (!Array.isArray(errores)) return []
  return errores
    .filter(e => e && typeof e === 'object' && typeof e.mensaje === 'string')
    .slice(0, 10)
    .flatMap(e => {
      return [
        {
          nivel:
            e.nivel === 'warning' || e.nivel === 'advertencia'
              ? 'advertencia'
              : 'error',
          mensaje: e.mensaje.slice(0, 500),
          archivo: normalizarRuta(e.archivo),
          linea: Number.isInteger(e.linea) && e.linea > 0 ? e.linea : null,
          detalle:
            typeof e.detalle === 'string' ? e.detalle.slice(0, 1500) : '',
        },
      ]
    })
}

// Últimos turnos de la conversación (no se guardan en el servidor). Alterna estudiante/asistente
// y empieza por el estudiante, como exigen los API.
export function normalizarHistorial(historial) {
  if (!Array.isArray(historial)) return []
  let total = 0
  const turnos = []
  for (const t of historial.slice(-8)) {
    if (!t || typeof t.texto !== 'string' || !t.texto.trim()) continue
    const rol = t.rol === 'asistente' ? 'assistant' : 'user'
    const texto = t.texto.slice(0, 4000)
    total += texto.length
    if (turnos.length && turnos.at(-1).role === rol)
      turnos.at(-1).content += '\n\n' + texto
    else turnos.push({ role: rol, content: texto })
  }
  while (turnos.length && turnos[0].role !== 'user') turnos.shift()
  while (total > 16000 && turnos.length > 2)
    total -= turnos.shift().content.length
  while (turnos.length && turnos[0].role !== 'user') turnos.shift()
  return turnos
}

export const NOMBRE_INSTRUCCIONES = 'ia-instrucciones.md'
export const PLANTILLA_INSTRUCCIONES =
  '# Instrucciones del proyecto\n\nDescribe el tipo de documento, el idioma y las normas de formato que necesitas.\n'
const TEXTO = /\.(tex|bib|cls|sty|md|txt)$/i
export const huella = texto => createHash('sha256').update(texto).digest('hex')

// Solo recibe adaptadores de Overleaf: las pruebas usan documentos simulados, nunca el navegador.
export function crearLectorProyecto({
  obtenerProyecto,
  obtenerDocumento,
  crearDocumento,
  obtenerArchivo,
  obtenerArchivoBinario,
  obtenerHistorial,
  buscarBibliografia,
  extraerTextoPdf = extraerPdf,
}) {
  async function abrir(projectId) {
    const proyecto = await obtenerProyecto(projectId)
    if (!proyecto) throw new ErrorEntrada('No se encontró el proyecto.')
    const documentos = new Map()
    const archivos = new Map()
    function recorrer(carpeta, prefijo = '') {
      for (const file of carpeta.fileRefs || []) {
        const ruta = rutaSegura(prefijo + file.name)
        archivos.set(ruta, { ...file, ruta })
      }
      for (const doc of carpeta.docs || []) {
        const ruta = rutaSegura(prefijo + doc.name)
        documentos.set(ruta, { ruta, id: String(doc._id) })
      }
      for (const hija of carpeta.folders || [])
        recorrer(hija, prefijo + hija.name + '/')
    }
    recorrer(proyecto.rootFolder[0])
    const cache = new Map()
    async function leer(ruta) {
      rutaSegura(ruta)
      const doc = documentos.get(ruta)
      if (!doc)
        throw new ErrorEntrada('El archivo no pertenece a este proyecto.')
      if (!cache.has(ruta)) {
        const actual = await obtenerDocumento(projectId, doc.id)
        const texto = actual.lines.join('\n')
        cache.set(ruta, {
          ...doc,
          texto,
          version: actual.version,
          huella: huella(texto),
        })
      }
      return cache.get(ruta)
    }
    async function leerDatos(ruta) {
      rutaSegura(ruta)
      if (documentos.has(ruta)) return (await leer(ruta)).texto
      const archivo = archivos.get(ruta)
      if (!archivo || !obtenerArchivo)
        throw new ErrorEntrada(
          'El archivo de datos no pertenece a este proyecto.'
        )
      return obtenerArchivo(projectId, archivo)
    }
    return { proyecto, documentos, archivos, leer, leerDatos }
  }

  async function preambulo(sesion, doc) {
    let fuente = doc
    if (!/\\begin\{document\}/.test(doc.texto)) {
      const raiz = [...sesion.documentos.values()].find(
        d => d.id === String(sesion.proyecto.rootDoc_id)
      )
      if (!raiz || raiz.ruta === doc.ruta) return null
      fuente = await sesion.leer(raiz.ruta)
    }
    const lineas = fuente.texto.split('\n')
    const fin = lineas.findIndex(l => /\\begin\{document\}/.test(l))
    if (fin <= 0) return null
    return {
      ...fuente,
      texto: lineas.slice(0, Math.min(fin, 150)).join('\n'),
      primeraLinea: 1,
    }
  }

  async function preparar(projectId, nombre, entrada, limiteTokens) {
    const def = funcion(nombre)
    const sesion = await abrir(projectId)
    const contexto = { documentos: [], instrucciones: '', destino: null }
    if (def.usaPdf || def.usaHistorial || def.usaBibliografia)
      textoFase2(entrada?.pregunta, def.maxPregunta || 4000, 'La solicitud')
    if (def.usaPdf) {
      if (
        !Array.isArray(entrada.pdfs) ||
        !entrada.pdfs.length ||
        entrada.pdfs.length > 3
      )
        throw new ErrorEntrada('Elige entre uno y tres PDF del proyecto.')
      const partes = []
      for (const ruta of [...new Set(entrada.pdfs)]) {
        rutaSegura(ruta)
        const archivo = sesion.archivos.get(ruta)
        if (!/\.pdf$/i.test(ruta) || !archivo || !obtenerArchivoBinario)
          throw new ErrorEntrada('El PDF no pertenece a este proyecto.')
        partes.push(
          await extraerTextoPdf(
            await obtenerArchivoBinario(projectId, archivo),
            ruta
          )
        )
        if (estimarTokens(partes.join('\n')) > limiteTokens)
          throw new ErrorEntrada(
            'Los PDF superan el límite de contexto; no se envió un fragmento parcial.'
          )
      }
      contexto.bloquePdf = partes.join('\n\n')
    }
    if (def.usaHistorial) {
      intervaloHistorial(entrada)
      if (!obtenerHistorial)
        throw new ErrorEntrada('El Historial no está disponible.')
      contexto.bloqueHistorial = await obtenerHistorial(projectId, entrada)
      if (estimarTokens(contexto.bloqueHistorial) > limiteTokens)
        throw new ErrorEntrada('El Historial supera el límite de contexto.')
    }
    if (def.usaBibliografia) {
      const ruta = rutaSegura(entrada?.archivoBib)
      if (!/\.bib$/i.test(ruta) || !buscarBibliografia)
        throw new ErrorEntrada('Elige el archivo .bib del proyecto.')
      const doc = await sesion.leer(ruta)
      if (doc.texto.length > 500000)
        throw new ErrorEntrada(
          'El archivo de bibliografía es demasiado grande.'
        )
      contexto.archivoBib = ruta
      contexto.documentos.push(doc)
      contexto.referencias = await buscarBibliografia(entrada)
    }
    if (sesion.documentos.has(NOMBRE_INSTRUCCIONES)) {
      contexto.instrucciones = (await sesion.leer(NOMBRE_INSTRUCCIONES)).texto
      if (contexto.instrucciones.length > 2000)
        throw new ErrorEntrada(
          'Reduce ia-instrucciones.md a 2000 caracteres antes de consultar.'
        )
    }
    // El cliente solo elige una ruta y posiciones. El texto de referencia lo lee el servidor.
    if (nombre === 'grafica_datos' && entrada?.archivoDatos) {
      if (!/\.(csv|txt|tsv)$/i.test(entrada.archivoDatos))
        throw new ErrorEntrada('Elige un archivo CSV, TSV o TXT.')
      contexto.datosGrafica = await sesion.leerDatos(entrada.archivoDatos)
    }
    if (nombre === 'agente') {
      await contextoAgente(sesion, contexto, entrada, limiteTokens)
      return contexto
    }
    if (entrada?.archivo && !def.usaProyecto) {
      const doc = await sesion.leer(entrada.archivo)
      contexto.documentos.push(doc)
      if (nombre.startsWith('corregir_')) {
        const lineas = doc.texto.split('\n')
        const linea = entrada.linea
        if (!Number.isInteger(linea) || linea < 1 || linea > lineas.length)
          throw new ErrorEntrada(
            'La línea del log no corresponde al archivo actual.'
          )
        const inicio = Math.max(0, linea - 16)
        contexto.fragmento = {
          ...doc,
          texto: lineas.slice(inicio, linea + 15).join('\n'),
          primeraLinea: inicio + 1,
        }
        // La corrección más común es añadir un paquete: sin el preámbulo, el modelo no puede
        // proponerlo como cambio. Se toma del mismo archivo o, si es un capítulo (\input), del
        // documento principal. Máximo 150 líneas.
        contexto.preambulo = await preambulo(sesion, doc)
        if (
          contexto.preambulo &&
          !contexto.documentos.some(d => d.ruta === contexto.preambulo.ruta)
        )
          contexto.documentos.push(await sesion.leer(contexto.preambulo.ruta))
      } else {
        const { desde, hasta } = entrada
        if (
          !Number.isInteger(desde) ||
          !Number.isInteger(hasta) ||
          desde < 0 ||
          hasta < desde ||
          hasta > doc.texto.length
        )
          throw new ErrorEntrada('Vuelve a seleccionar el texto en el editor.')
        const seleccion = entrada.seleccion ?? ''
        if (
          typeof seleccion !== 'string' ||
          doc.texto.slice(desde, hasta) !== seleccion
        )
          throw new ErrorEntrada('El texto cambió. Vuelve a seleccionarlo.')
        contexto.destino = { ...doc, desde, hasta, seleccion }
        if (nombre === 'reescribir')
          validarSeleccionProtegida(doc.texto, desde, hasta)
      }
    }
    if ((nombre === 'reescribir' || def.usaSeleccion) && !contexto.destino)
      throw new ErrorEntrada('Selecciona el texto que quieres reescribir.')
    if (nombre === 'chat_proyecto' || def.usaProyecto)
      await cargarProyecto(sesion, contexto, limiteTokens)
    return contexto
  }

  // Todos los archivos de texto del proyecto, con el principal primero, o error si no caben.
  async function cargarProyecto(sesion, contexto, limiteTokens) {
    {
      contexto.documentos = []
      let tokens = 0
      const docs = [...sesion.documentos.values()].filter(d =>
        TEXTO.test(d.ruta)
      )
      docs.sort(
        (a, b) =>
          Number(b.id === String(sesion.proyecto.rootDoc_id)) -
            Number(a.id === String(sesion.proyecto.rootDoc_id)) ||
          a.ruta.localeCompare(b.ruta)
      )
      for (const { ruta } of docs) {
        const doc = await sesion.leer(ruta)
        tokens += estimarTokens(documentoComoDatos(doc))
        if (tokens > limiteTokens)
          throw new ErrorEntrada(
            `El proyecto supera el límite de ${limiteTokens} tokens estimados. Consulta sobre una selección o reduce el proyecto; no se envió ningún archivo a la IA.`
          )
        contexto.documentos.push(doc)
      }
      contexto.bloqueProyecto = contexto.documentos
        .map(documentoComoDatos)
        .join('\n\n')
    }
  }

  // Agente del documento: lo que ve el estudiante en el editor. El servidor lee el texto; el
  // navegador solo indica qué archivo está abierto, dónde está el cursor, qué hay seleccionado,
  // qué errores dio la última compilación y los últimos turnos de la conversación.
  async function contextoAgente(sesion, contexto, entrada, limiteTokens) {
    contexto.archivos = [...sesion.documentos.keys()].sort().slice(0, 300)
    contexto.errores = normalizarErrores(entrada?.errores)
    contexto.historial = normalizarHistorial(entrada?.historial)
    contexto.vistas = []
    const ver = (doc, desdeLinea, hastaLinea) => {
      const lineas = doc.texto.split('\n')
      const ya = contexto.vistas.find(v => v.ruta === doc.ruta)
      if (ya?.completo) return
      const completo = desdeLinea <= 1 && hastaLinea >= lineas.length
      const vista = {
        ruta: doc.ruta,
        completo,
        primeraLinea: Math.max(1, desdeLinea),
        texto: completo
          ? doc.texto
          : lineas.slice(Math.max(0, desdeLinea - 1), hastaLinea).join('\n'),
      }
      if (completo && ya) contexto.vistas.splice(contexto.vistas.indexOf(ya), 1)
      contexto.vistas.push(vista)
      if (!contexto.documentos.some(d => d.ruta === doc.ruta))
        contexto.documentos.push(doc)
    }
    if (entrada?.usarProyecto === true) {
      await cargarProyecto(sesion, contexto, limiteTokens)
      for (const doc of contexto.documentos)
        contexto.vistas.push({
          ruta: doc.ruta,
          completo: true,
          primeraLinea: 1,
          texto: doc.texto,
        })
      contexto.usaProyecto = true
    }
    let abierto = null
    if (entrada?.archivo) {
      abierto = await sesion.leer(entrada.archivo)
      contexto.abierto = abierto.ruta
      const lineas = abierto.texto.split('\n')
      const cursor =
        Number.isInteger(entrada.cursor) &&
        entrada.cursor >= 0 &&
        entrada.cursor <= abierto.texto.length
          ? entrada.cursor
          : null
      if (abierto.texto.length <= MAX_ARCHIVO_ABIERTO)
        ver(abierto, 1, lineas.length)
      else {
        // Archivo grande: alrededor del cursor (o del inicio).
        const linea =
          cursor === null
            ? 1
            : abierto.texto.slice(0, cursor).split('\n').length
        ver(abierto, linea - 150, linea + 150)
      }
      if (cursor !== null) {
        contexto.cursor = {
          ruta: abierto.ruta,
          posicion: cursor,
          linea: abierto.texto.slice(0, cursor).split('\n').length,
          huella: abierto.huella,
        }
      }
      const { desde, hasta } = entrada
      if (
        Number.isInteger(desde) &&
        Number.isInteger(hasta) &&
        desde >= 0 &&
        hasta > desde &&
        hasta <= abierto.texto.length
      )
        contexto.seleccionAgente = {
          ruta: abierto.ruta,
          texto: abierto.texto.slice(desde, hasta).slice(0, 20000),
        }
    }
    // Errores en otros archivos (capítulos): unas líneas alrededor de cada uno.
    for (const e of contexto.errores) {
      const ruta = e.archivo
      if (!ruta || !sesion.documentos.has(ruta)) continue
      const doc = await sesion.leer(ruta)
      if (contexto.vistas.some(v => v.ruta === ruta && v.completo)) continue
      if (doc.texto.length <= MAX_ARCHIVO_ABIERTO / 2)
        ver(doc, 1, doc.texto.split('\n').length)
      else if (Number.isInteger(e.linea)) ver(doc, e.linea - 25, e.linea + 25)
    }
    // El preámbulo, para poder añadir paquetes (\usepackage, \usetikzlibrary).
    const base =
      abierto ||
      (contexto.errores[0]?.archivo &&
      sesion.documentos.has(contexto.errores[0].archivo)
        ? await sesion.leer(contexto.errores[0].archivo)
        : null)
    if (base) {
      const pre = await preambulo(sesion, base)
      if (pre && !contexto.vistas.some(v => v.ruta === pre.ruta && v.completo))
        ver(await sesion.leer(pre.ruta), 1, pre.texto.split('\n').length)
    }
    const tokens = contexto.vistas.reduce(
      (s, v) => s + estimarTokens(v.texto),
      0
    )
    if (tokens > limiteTokens)
      throw new ErrorEntrada(
        `El contexto supera el límite de ${limiteTokens} tokens estimados. Desmarca «Todo el proyecto» o consulta sobre una selección.`
      )
  }

  async function instrucciones(projectId) {
    const s = await abrir(projectId)
    return { existe: s.documentos.has(NOMBRE_INSTRUCCIONES) }
  }

  async function crearInstrucciones(projectId, userId) {
    const s = await abrir(projectId)
    if (s.documentos.has(NOMBRE_INSTRUCCIONES))
      return { id: s.documentos.get(NOMBRE_INSTRUCCIONES).id }
    const doc = await crearDocumento(
      projectId,
      s.proyecto.rootFolder[0]._id,
      NOMBRE_INSTRUCCIONES,
      PLANTILLA_INSTRUCCIONES.split('\n'),
      userId
    )
    return { id: String(doc._id) }
  }

  return { abrir, preparar, instrucciones, crearInstrucciones }
}
