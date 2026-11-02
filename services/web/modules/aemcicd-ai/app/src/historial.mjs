import { ErrorEntrada } from './entrada.mjs'
import { dato, rutaSegura } from './datos.mjs'

export function intervaloHistorial(entrada) {
  const { desdeVersion: desde, hastaVersion: hasta } = entrada || {}
  if (
    !Number.isSafeInteger(desde) ||
    !Number.isSafeInteger(hasta) ||
    desde < 0 ||
    hasta <= desde ||
    hasta - desde > 500
  )
    throw new ErrorEntrada(
      'Elige dos versiones del Historial, separadas por no más de 500 cambios.'
    )
  return { desde, hasta }
}

// Se eliminan meta, autores, correos e identificadores antes de formar el contexto.
export async function leerHistorial(
  projectId,
  entrada,
  consultar,
  limiteCaracteres = 200000
) {
  const { desde, hasta } = intervaloHistorial(entrada)
  const arbol = await consultar(projectId, 'filetree/diff', {
    from: desde,
    to: hasta,
  })
  if (!Array.isArray(arbol?.diff))
    throw new ErrorEntrada('No se pudo leer ese intervalo del Historial.')
  const cambios = arbol.diff.filter(d => d.operation)
  if (cambios.length > 20)
    throw new ErrorEntrada(
      'El intervalo afecta a más de 20 archivos. Elige uno menor; no se recortó el historial.'
    )
  const resultado = []
  let longitud = 0
  for (const cambio of cambios) {
    const ruta = rutaSegura(cambio.pathname)
    const limpio = { archivo: ruta, operacion: cambio.operation }
    if (cambio.newPathname) limpio.nuevaRuta = rutaSegura(cambio.newPathname)
    if (
      cambio.editable !== false &&
      /\.(tex|bib|cls|sty|md|txt|py|c|h)$/i.test(ruta) &&
      cambio.operation !== 'removed'
    ) {
      const r = await consultar(projectId, 'diff', {
        from: desde,
        to: hasta,
        pathname: ruta,
      })
      if (!Array.isArray(r?.diff))
        throw new ErrorEntrada(
          'No se pudo obtener el texto de una diferencia. No se resumió un historial incompleto.'
        )
      limpio.diferencias = r.diff.map(d =>
        Object.fromEntries(
          ['i', 'd', 'u']
            .filter(k => typeof d[k] === 'string')
            .map(k => [k, d[k]])
        )
      )
    }
    longitud += JSON.stringify(limpio).length
    if (longitud > limiteCaracteres)
      throw new ErrorEntrada(
        'El historial supera el límite. Elige un intervalo menor; no se envió un fragmento parcial.'
      )
    resultado.push(limpio)
  }
  return dato('historial', JSON.stringify({ desde, hasta, cambios: resultado }))
}
