// Resumen agregado del uso de la IA en el mes (o en el mes de la fecha dada).
//   node modules/aemcicd-ai/scripts/resumen.mjs [AAAA-MM-DD]
// Desde la laptop: bash servidor/remoto.sh ia-resumen
import {
  connectionPromise,
  getCollectionInternal,
} from '../../../app/src/infrastructure/mongodb.mjs'
import { NOMBRES } from '../app/src/almacen.mjs'
import { leerConfig } from '../app/src/config.mjs'
import { resumenMensual } from '../app/src/resumen.mjs'

const fecha = process.argv[2]
  ? new Date(`${process.argv[2]}T12:00:00-05:00`)
  : new Date()
if (Number.isNaN(fecha.getTime())) {
  console.error('uso: resumen.mjs [AAAA-MM-DD]')
  process.exit(1)
}
await connectionPromise
const c = Object.fromEntries(
  await Promise.all(
    Object.entries(NOMBRES).map(async ([k, n]) => [
      k,
      await getCollectionInternal(n),
    ])
  )
)
console.log(
  JSON.stringify(
    await resumenMensual(c, leerConfig(process.env), fecha),
    null,
    2
  )
)
process.exit(0)
