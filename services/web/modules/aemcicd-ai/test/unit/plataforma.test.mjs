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

test('CORS de soporte: el propio editor (mismo sitio) también puede usar las rutas', async () => {
  const app = express()
  corsPlataforma(app, 'https://latex.aemcicd.org')
  app.use((req, res) => res.json({ ok: true }))
  const server = app.listen(0, '127.0.0.1')
  await new Promise(r => server.once('listening', r))
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    const r = await fetch(base + '/aemcicd-ai/soporte', {
      method: 'POST',
      headers: { Origin: 'https://latex.aemcicd.org' },
    })
    assert.equal(r.status, 200)
    assert.equal(r.headers.get('access-control-allow-origin'), null)
  } finally {
    server.close()
  }
})

test('token de soporte: solo del mismo usuario, firmado y con vencimiento', async () => {
  const { crearFirmador } = await import('../../app/src/token-soporte.mjs')
  const f = crearFirmador('secreto-de-prueba')
  const ahora = Date.now()
  const t = f.crear('u1', ahora)
  assert.equal(f.valido('u1', t, ahora + 1000), true)
  assert.equal(f.valido('u2', t, ahora + 1000), false)
  assert.equal(f.valido('u1', t, ahora + 31 * 60 * 1000), false)
  assert.equal(crearFirmador('otro').valido('u1', t, ahora), false)
  for (const malo of [
    undefined,
    '',
    'x',
    t + 'a',
    t.replace(/\.\w/, '.Z'),
    '9'.repeat(300),
  ])
    assert.equal(f.valido('u1', malo, ahora), false)
})
