// Guarda el crédito por estudiante, los topes y los días de ciclo que fija la plataforma.
//   node modules/aemcicd-ai/scripts/ajustes.mjs '<json>'
// Lo ejecuta el conector latex-sync cuando la plataforma los cambia. El módulo los relee cada
// minuto. Imprime una sola línea JSON con la huella aplicada; nunca recibe claves.
import {
  connectionPromise,
  getCollectionInternal,
} from '../../../app/src/infrastructure/mongodb.mjs'
import { guardarAjustes } from '../app/src/ajustes.mjs'

let entrada
try {
  entrada = JSON.parse(process.argv[2] ?? '')
} catch {
  console.error(
    'uso: ajustes.mjs \'{"huella":…,"creditoMensualUsd":…,"topes":{…},"diasInicio":{…}}\''
  )
  process.exit(1)
}
await connectionPromise
try {
  const ajustes = await guardarAjustes(
    { ajustes: await getCollectionInternal('aemcicdAiAjustes') },
    entrada
  )
  console.log(JSON.stringify({ aplicado: true, huella: ajustes.huella }))
  process.exit(0)
} catch (err) {
  console.error(err.message)
  process.exit(1)
}
