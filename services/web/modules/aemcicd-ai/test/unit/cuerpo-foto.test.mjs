import { test } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { cuerpoFoto } from '../../app/src/cuerpo-foto.mjs'

test('solo la ruta de foto admite el cuerpo ampliado; rechaza JSON mal formado y exceso', async () => {
  const app = express()
  cuerpoFoto(app)
  app.use(express.json({ limit: '100kb' }))
  app.post('/project/:id/aemcicd-ai/:accion', (req, res) =>
    res.json({ longitud: req.body.imagen?.length || 0 })
  )
  app.use((err, req, res, next) => res.sendStatus(err.status || 500))
  const servidor = app.listen(0, '127.0.0.1')
  await new Promise(resolve => servidor.once('listening', resolve))
  const base = `http://127.0.0.1:${servidor.address().port}/project/0123456789abcdef01234567/aemcicd-ai/`
  const enviar = (accion, body) =>
    fetch(base + accion, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
  try {
    const body = JSON.stringify({ imagen: 'a'.repeat(150000) })
    assert.equal((await enviar('foto', body)).status, 200)
    assert.equal((await enviar('consulta', body)).status, 413)
    assert.equal((await enviar('foto', '{invalido')).status, 400)
    assert.equal(
      (
        await enviar(
          'foto',
          JSON.stringify({ imagen: 'a'.repeat(7 * 1024 * 1024) })
        )
      ).status,
      413
    )
  } finally {
    await new Promise(resolve => servidor.close(resolve))
  }
})
