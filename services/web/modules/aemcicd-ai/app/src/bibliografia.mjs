import { createHash } from 'node:crypto'
import { ErrorEntrada } from './entrada.mjs'

export function normalizarDoi(valor) {
  if (typeof valor !== 'string') throw new ErrorEntrada('Indica un DOI válido.')
  const doi = valor
    .trim()
    .replace(/^https:\/\/(?:dx\.)?doi\.org\//i, '')
    .toLowerCase()
  if (doi.length > 200 || !/^10\.\d{4,9}\/[-a-z0-9._;()/:+]+$/.test(doi))
    throw new ErrorEntrada(
      'Indica un DOI válido, sin parámetros ni direcciones externas.'
    )
  return doi
}

function campo(valor) {
  return String(valor ?? '')
    .slice(0, 1500)
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(
      /[\\{}%$&#_^~]/g,
      c =>
        ({
          '\\': '\\textbackslash{}',
          '{': '\\{',
          '}': '\\}',
          '%': '\\%',
          $: '\\$',
          '&': '\\&',
          '#': '\\#',
          _: '\\_',
          '^': '\\textasciicircum{}',
          '~': '\\textasciitilde{}',
        })[c]
    )
}

export function referenciaCrossref(mensaje, esperado) {
  const doi = normalizarDoi(mensaje?.DOI)
  if (esperado && doi !== normalizarDoi(esperado))
    throw new ErrorEntrada('Crossref devolvió un DOI distinto.')
  if (
    !Array.isArray(mensaje.title) ||
    typeof mensaje.title[0] !== 'string' ||
    !mensaje.title[0].trim()
  )
    throw new ErrorEntrada('El DOI no tiene un título comprobable en Crossref.')
  const clave =
    'aemcicd' + createHash('sha256').update(doi).digest('hex').slice(0, 16)
  const titulo = mensaje.title[0].slice(0, 1500)
  const autores = (Array.isArray(mensaje.author) ? mensaje.author : [])
    .slice(0, 100)
    .map(a =>
      [a.family, a.given]
        .filter(v => typeof v === 'string')
        .map(campo)
        .join(', ')
    )
    .filter(Boolean)
    .join(' and ')
  const anio = mensaje.published?.['date-parts']?.[0]?.[0]
  const campos = [
    ['title', campo(titulo)],
    ['author', autores],
    [
      'year',
      Number.isInteger(anio) && anio >= 1000 && anio <= 2200
        ? String(anio)
        : '',
    ],
    ['journal', campo(mensaje['container-title']?.[0])],
    ['doi', doi],
    ['url', `https://doi.org/${doi}`],
  ].filter(([, v]) => v)
  const tipo = mensaje.type === 'journal-article' ? 'article' : 'misc'
  return {
    doi,
    clave,
    titulo,
    fuente: `https://doi.org/${doi}`,
    bibtex: `@${tipo}{${clave},\n${campos.map(([k, v]) => `  ${k} = {${v}}`).join(',\n')}\n}`,
  }
}

// Solo metadatos públicos: nunca se envían documentos, identificadores o claves a Crossref.
// Dirección fija, sin redirecciones, respuesta acotada y tiempo máximo. No se sigue doi.org.
export function crearBibliografia({
  fetch: consultar = globalThis.fetch,
} = {}) {
  async function leer(url) {
    let respuesta
    try {
      respuesta = await consultar(url, {
        redirect: 'error',
        signal: AbortSignal.timeout(8000),
        headers: {
          Accept: 'application/json',
          'User-Agent': 'AEMCiCD-LaTeX/1.0 (mailto:asoemc@yachaytech.edu.ec)',
        },
      })
      if (!respuesta.ok)
        throw new ErrorEntrada(
          respuesta.status === 404
            ? 'No se encontró ese DOI en Crossref; no se añadirá una referencia inventada.'
            : 'Crossref no está disponible. Inténtalo más tarde.'
        )
      const partes = []
      let bytes = 0
      for await (const parte of respuesta.body) {
        bytes += parte.length
        if (bytes > 300000)
          throw new ErrorEntrada(
            'La respuesta bibliográfica supera el tamaño permitido.'
          )
        partes.push(parte)
      }
      return JSON.parse(Buffer.concat(partes).toString('utf8')).message
    } catch (err) {
      await respuesta?.body?.cancel().catch(() => {})
      if (err instanceof ErrorEntrada) throw err
      throw new ErrorEntrada(
        'No se pudo verificar la referencia en Crossref. No se añadió ninguna entrada.'
      )
    }
  }
  return async entrada => {
    if (
      !entrada ||
      typeof entrada.pregunta !== 'string' ||
      !entrada.pregunta.trim() ||
      entrada.pregunta.length > 1000
    )
      throw new ErrorEntrada(
        'Escribe hasta 1000 caracteres para buscar bibliografía.'
      )
    if (!Array.isArray(entrada.dois) || entrada.dois.length > 5)
      throw new ErrorEntrada(
        'Indica hasta cinco DOI o deja la lista vacía para buscar por tema.'
      )
    if (entrada.dois.length) {
      const referencias = []
      for (const doi of [...new Set(entrada.dois.map(normalizarDoi))])
        referencias.push(
          referenciaCrossref(
            await leer(
              `https://api.crossref.org/works/${encodeURIComponent(doi)}`
            ),
            doi
          )
        )
      return referencias
    }
    const url = new URL('https://api.crossref.org/works')
    url.searchParams.set('query.bibliographic', entrada.pregunta)
    url.searchParams.set('rows', '5')
    const respuesta = await leer(url)
    if (!Array.isArray(respuesta?.items))
      throw new ErrorEntrada('La búsqueda no tiene un formato válido.')
    const referencias = []
    for (const item of respuesta.items.slice(0, 5)) {
      try {
        referencias.push(referenciaCrossref(item))
      } catch {
        /* Un resultado incompleto nunca se anuncia como verificado. */
      }
    }
    if (!referencias.length)
      throw new ErrorEntrada(
        'No hay referencias verificables para esa búsqueda. Prueba con un DOI.'
      )
    return referencias
  }
}
