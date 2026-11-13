import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  aplicarAjustes,
  guardarAjustes,
  validarAjustes,
} from '../../app/src/ajustes.mjs'
import { leerConfig } from '../../app/src/config.mjs'
import { aMicro } from '../../app/src/precios.mjs'

const ajustes = {
  huella: '500|45000|39240|1|6',
  creditoMensualUsd: 5,
  topes: { anthropic: 450, openai: 392.4 },
  diasInicio: { anthropic: 1, openai: 6 },
}
const env = {
  AEMCICD_AI_ENABLED: 'true',
  ANTHROPIC_API_KEY: 'x',
  OPENAI_API_KEY: 'y',
}

test('los ajustes de la plataforma reemplazan crédito, topes y ciclos del entorno', () => {
  const config = leerConfig(env)
  assert.equal(config.creditoMensualMicro, aMicro(1))
  assert.equal(aplicarAjustes(config, ajustes), true)
  assert.equal(config.creditoMensualMicro, aMicro(5))
  assert.equal(config.presupuestos.openai.topeMicro, aMicro(392.4))
  assert.equal(config.presupuestos.anthropic.diaInicio, 1)
  assert.equal(config.ajustesHuella, ajustes.huella)
})

test('un documento inválido no cambia nada', () => {
  const config = leerConfig(env)
  assert.equal(
    aplicarAjustes(config, { ...ajustes, creditoMensualUsd: -1 }),
    false
  )
  assert.equal(aplicarAjustes(config, null), false)
  assert.equal(config.creditoMensualMicro, aMicro(1))
  assert.throws(
    () =>
      validarAjustes({ ...ajustes, diasInicio: { anthropic: 31, openai: 6 } }),
    /día entre 1 y 28/
  )
  assert.throws(
    () => validarAjustes({ ...ajustes, huella: 'x; rm -rf /' }),
    /huella/
  )
})

test('guarda un solo documento con los campos validados', async () => {
  let guardado
  const c = {
    ajustes: {
      replaceOne: async (filtro, doc, opciones) => {
        guardado = { filtro, doc, opciones }
      },
    },
  }
  await guardarAjustes(
    c,
    { ...ajustes, clave: 'no-se-guarda' },
    new Date('2026-11-13T00:00:00Z')
  )
  assert.deepEqual(guardado.filtro, { _id: 'plataforma' })
  assert.equal(guardado.doc.clave, undefined)
  assert.equal(guardado.doc.creditoMensualUsd, 5)
  assert.equal(guardado.opciones.upsert, true)
})
