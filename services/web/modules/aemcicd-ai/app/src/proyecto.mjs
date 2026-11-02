import { createHash } from 'node:crypto'
import { documentoComoDatos, rutaSegura } from './datos.mjs'
import { ErrorEntrada, funcion } from './funciones.mjs'
import { estimarTokens } from './precios.mjs'
import { validarSeleccionProtegida } from './cambios.mjs'
import { extraerPdf } from './pdf-proyecto.mjs'
import { textoFase2 } from './fase2.mjs'
import { intervaloHistorial } from './historial.mjs'

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
    if (nombre === 'chat_proyecto' || def.usaProyecto) {
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
    return contexto
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
