// Ejecuta los métodos reales del contenedor sin arrancar Socket.IO ni el editor completo.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
const require = createRequire(
  resolve(process.env.AEMCICD_IA_DEPS || '.', 'package.json')
)
const ts = require('typescript')
const fuente = await readFile(
  new URL(
    '../../../../frontend/js/features/ide-react/editor/document-container.ts',
    import.meta.url
  ),
  'utf8'
)
const arbol = ts.createSourceFile(
  'document-container.ts',
  fuente,
  ts.ScriptTarget.Latest,
  true
)
const metodos = []
function recorrer(nodo) {
  if (
    ts.isMethodDeclaration(nodo) &&
    ['setTrackChangesUserId', 'withTrackedChanges'].includes(
      nodo.name.getText(arbol)
    )
  )
    metodos.push(nodo.getText(arbol))
  ts.forEachChild(nodo, recorrer)
}
recorrer(arbol)
assert.equal(metodos.length, 2)
const js = ts.transpile(
  `class Contenedor { ${metodos.join('\n')} }; return Contenedor`,
  { target: ts.ScriptTarget.ES2022 }
)
const Contenedor = new Function(js)()
function crear() {
  const c = new Contenedor()
  c.track_changes_as = null
  c.trackedAction = null
  c.trackChangesPinnedForRecovery = false
  c.doc = {
    setTrackChangesUserId: id => {
      c.autorOT = id
    },
  }
  c.cm6 = {
    setTrackChangesUserId: id => {
      c.autorEditor = id
    },
  }
  return c
}
test('la propuesta conserva el autor nativo hasta sincronizar y restaura la última elección del usuario', async () => {
  const c = crear()
  let terminar
  const pendiente = new Promise(r => {
    terminar = r
  })
  const accion = c.withTrackedChanges('estudiante', async () => {
    await pendiente
    return 42
  })
  assert.equal(c.autorOT, 'estudiante')
  assert.equal(c.autorEditor, 'estudiante')
  c.setTrackChangesUserId('otra-eleccion')
  assert.equal(c.autorOT, 'estudiante')
  assert.equal(c.track_changes_as, 'estudiante')
  await assert.rejects(
    c.withTrackedChanges('estudiante', async () => {}),
    /pendiente/
  )
  terminar()
  assert.equal(await accion, 42)
  assert.equal(c.track_changes_as, 'otra-eleccion')
  assert.equal(c.autorOT, 'otra-eleccion')
  assert.equal(c.autorEditor, 'otra-eleccion')
})
test('un fallo restaura el estado y la recuperación de una copia local impide comenzar una propuesta', async () => {
  const c = crear()
  await assert.rejects(
    c.withTrackedChanges('estudiante', async () => {
      throw new Error('sin conexión')
    }),
    /sin conexión/
  )
  assert.equal(c.track_changes_as, null)
  assert.equal(c.autorOT, null)
  c.trackChangesPinnedForRecovery = true
  let ejecutada = false
  await assert.rejects(
    c.withTrackedChanges('estudiante', async () => {
      ejecutada = true
    }),
    /pendiente/
  )
  assert.equal(ejecutada, false)
})
