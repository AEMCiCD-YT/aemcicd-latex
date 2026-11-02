import { test } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { corsPlataforma, ORIGEN_PLATAFORMA } from '../../app/src/plataforma.mjs'

test('CORS de soporte: solo plataforma propia, con credenciales y CSRF; no habilita documentos', async () => {
  const app = express()
  corsPlataforma(app)
  app.use((req, res) => res.json({ ok: true }))
  const server = app.listen(0, '127.0.0.1')
  await new Promise(r => server.once('listening', r))
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    const opciones = await fetch(base + '/aemcicd-ai/soporte', {
      method: 'OPTIONS',
      headers: { Origin: ORIGEN_PLATAFORMA },
    })
    assert.equal(opciones.status, 204)
    assert.equal(
      opciones.headers.get('access-control-allow-origin'),
      ORIGEN_PLATAFORMA
    )
    assert.equal(
      opciones.headers.get('access-control-allow-credentials'),
      'true'
    )
    assert.match(
      opciones.headers.get('access-control-allow-headers'),
      /X-Csrf-Token/
    )
    assert.equal(
      (
        await fetch(base + '/aemcicd-ai/soporte', {
          headers: { Origin: 'https://ajeno.example' },
        })
      ).status,
      403
    )
    assert.equal(
      (
        await fetch(base + '/project/p/doc/d', {
          headers: { Origin: ORIGEN_PLATAFORMA },
        })
      ).headers.get('access-control-allow-origin'),
      null
    )
  } finally {
    await new Promise(r => server.close(r))
  }
})
