// Prueba de integración sobre una instancia LOCAL desechable: OT, comentarios y CLSI reales.
// Solo la respuesta del modelo se simula. Los eventos sintéticos se crean en su Mongo temporal.
import { createRequire } from 'node:module'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
const require = createRequire(
  resolve(
    process.env.AEMCICD_IA_DEPS || '/tmp/aemcicd-ia-pruebas',
    'package.json'
  )
)
const { chromium } = require('playwright')
const url = process.env.AEMCICD_IA_URL || 'http://localhost:18182'
assert.match(
  url,
  /^http:\/\/(localhost|127\.0\.0\.1):18182$/,
  'Esta prueba solo admite la instancia local desechable'
)
const ids = JSON.parse(await readFile('/tmp/ia-overleaf-ids.json', 'utf8'))
for (const id of Object.values(ids)) assert.match(id, /^[a-f\d]{24}$/)
const evento = '000000000000000000000201'
const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome',
  args: ['--no-sandbox'],
  timeout: 45000,
})
const context = await browser.newContext({
  storageState: '/tmp/ia-overleaf-sesion.json',
  locale: 'es-EC',
  viewport: { width: 1600, height: 1100 },
})
const page = await context.newPage()
page.setDefaultTimeout(20000)
const capturas =
  process.env.AEMCICD_IA_CAPTURAS || '/tmp/aemcicd-ia-overleaf-capturas'
await mkdir(capturas, { recursive: true })
const errores = []
page.on('pageerror', e => errores.push(e.message))
const vista = () => page.locator('.cm-content').first()
async function texto() {
  return vista().evaluate(e => e.cmView.view.state.doc.toString())
}
async function escribir(valor) {
  await vista().evaluate((e, s) => {
    const v = e.cmView.view
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: s } })
  }, valor)
}
async function abrirIA() {
  const tab = page.getByRole('tab', { name: 'Asistente de IA', exact: true })
  if (!(await tab.getAttribute('class')).includes('open-rail'))
    await tab.click()
  const activar = page.getByRole('button', {
    name: 'Activar la IA',
    exact: true,
  })
  if (await activar.isVisible()) await activar.click()
  await page.getByRole('tab', { name: 'Conversación', exact: true }).waitFor()
}
let ultima
await page.route('**/aemcicd-ai/consulta', async route => {
  const b = route.request().postDataJSON()
  const original = await texto()
  ultima = b.funcion
  const comun = {
    tipo: 'fin',
    eventoId:
      b.funcion === 'revisor_jurado' ? '000000000000000000000202' : evento,
    proveedor: 'openai',
    modelo: 'modelo-simulado',
    costo: 0,
    saldo: {
      credito: 1,
      gastado: 0,
      reservado: 0,
      disponible: 1,
      renuevaEl: '2026-12-01T00:00:00Z',
    },
    explicacion: 'Respuesta simulada para verificar la integración local.',
  }
  const desde = original.indexOf('v_0 = 3')
  let extra
  if (b.funcion === 'revisor_jurado')
    extra = {
      comentarios: [
        {
          archivo: 'main.tex',
          docId: ids.docId,
          cita: 'La velocidad es $v_0 = 3$ m/s.',
          comentario: 'Describe el método de medición y las unidades.',
          desde: original.indexOf('La velocidad'),
          hasta: original.indexOf('La velocidad') + 29,
        },
      ],
    }
  else
    extra = {
      cambios: [
        {
          archivo: 'main.tex',
          docId: ids.docId,
          antes: 'v_0 = 3',
          despues: '$v_0 = 3$',
          desde,
          hasta: desde + 7,
          huella: createHash('sha256').update(original).digest('hex'),
        },
      ],
    }
  await route.fulfill({
    contentType: 'application/x-ndjson',
    body: JSON.stringify({ ...comun, ...extra }) + '\n',
  })
})
try {
  const limiteArranque = Date.now() + 90000
  while (true) {
    try {
      const r = await page.request.get(url + '/login')
      if (r.status() === 200 && (await r.text()).includes('ol-csrfToken')) break
    } catch {}
    if (Date.now() > limiteArranque)
      throw new Error('Overleaf no terminó de arrancar')
    await new Promise(r => setTimeout(r, 500))
  }
  await page.goto(url + '/project/' + ids.projectId)
  if (new URL(page.url()).pathname === '/login') {
    assert.ok(
      process.env.AEMCICD_IA_PASSWORD,
      'Indica la contraseña de la cuenta ficticia en AEMCICD_IA_PASSWORD'
    )
    await page.locator('input[name=email]').fill('admin@example.test')
    await page
      .locator('input[name=password]')
      .fill(process.env.AEMCICD_IA_PASSWORD)
    await page.locator('button[type=submit]').click()
    await page.waitForURL(/\/project(?:\/|$)/)
    await context.storageState({ path: '/tmp/ia-overleaf-sesion.json' })
    await page.goto(url + '/project/' + ids.projectId)
  }

  await vista().waitFor()
  console.log('Editor real listo')
  await escribir(
    '\\documentclass{article}\n\\begin{document}\nLa velocidad es v_0 = 3 m/s.\n\\end{document}'
  )
  await abrirIA()
  console.log('Panel de IA listo')
  await page.waitForTimeout(1500) // El limitador nativo separa compilaciones por un segundo.
  // Genera un error real y espera la respuesta antes de abrir el registro.
  const compilacion = page.waitForResponse(
    r =>
      new URL(r.url()).pathname === `/project/${ids.projectId}/compile` &&
      r.request().method() === 'POST'
  )
  await page
    .getByRole('button', { name: /^Recompile$|^Recompilar$/ })
    .first()
    .click()
  await compilacion
  await page.waitForTimeout(500)
  const logs = page.getByRole('button', { name: /^View logs$|^Ver registros$/ })
  if ((await logs.isVisible()) && (await logs.isEnabled())) await logs.click()
  await page
    .getByRole('button', { name: 'Corregir con IA', exact: true })
    .first()
    .waitFor({ timeout: 45000 })
  console.log('Error de compilación y botón IA visibles')
  await page.screenshot({ path: join(capturas, 'log-real.png') })
  await page
    .getByRole('button', { name: 'Corregir con IA', exact: true })
    .first()
    .click()
  await page
    .getByRole('button', { name: 'Enviar a revisión', exact: true })
    .first()
    .waitFor()
  await page.getByText('Ver diferencias', { exact: true }).first().click()
  await page.screenshot({ path: join(capturas, 'propuesta-real.png') })
  await page
    .getByRole('button', { name: 'Enviar a revisión', exact: true })
    .first()
    .click()
  // El panel se abre con cambios pendientes y su comentario de procedencia.
  await page
    .locator('.review-panel-comment-body:visible')
    .filter({ hasText: 'IA, pedido por' })
    .first()
    .waitFor()
  await page
    .getByRole('button', { name: /^Accept change$|^Aceptar cambio$/ })
    .first()
    .waitFor()
  await page.screenshot({ path: join(capturas, 'revision-real.png') })
  assert.ok((await texto()).includes('$v_0 = 3$'))
  const otra = await context.newPage()
  await otra.goto(url + '/project/' + ids.projectId)
  await otra.locator('.cm-content').first().waitFor()
  await otra
    .locator('.cm-content')
    .first()
    .evaluate(e => {
      const v = e.cmView.view
      v.dispatch({
        selection: { anchor: v.state.doc.toString().indexOf('La velocidad') },
      })
    })
  const revisionOtra = otra.getByRole('tab', {
    name: /^Review panel$|^Panel de revisión$/,
  })
  if (!(await revisionOtra.getAttribute('class')).includes('open-rail'))
    await revisionOtra.click()
  await otra
    .locator('.review-panel-comment-body')
    .filter({ hasText: 'IA, pedido por' })
    .first()
    .waitFor({ state: 'attached' }) // Los hilos se pliegan según la selección de cada colaborador.

  await otra.screenshot({ path: join(capturas, 'segunda-pestana-real.png') })
  await writeFile(
    join(capturas, 'segunda-pestana.txt'),
    await otra.locator('body').innerText()
  )
  await otra
    .getByRole('button', { name: /^Accept change$|^Aceptar cambio$/ })
    .first()
    .waitFor()
  await otra.close()
  // Aceptar por la vía nativa, para dejar una cita sin eliminaciones pendientes.
  while (
    await page
      .getByRole('button', { name: /^Accept change$|^Aceptar cambio$/ })
      .count()
  ) {
    await page
      .getByRole('button', { name: /^Accept change$|^Aceptar cambio$/ })
      .first()
      .click()
    await page.waitForTimeout(350)
  }
  await abrirIA()
  await page.getByRole('tab', { name: 'Herramientas', exact: true }).click()
  await page.getByText('Revisión y entrega', { exact: true }).click()
  await page
    .getByRole('button', { name: 'Revisor tipo jurado', exact: true })
    .click()
  await page.getByRole('button', { name: 'Consultar con este costo' }).click()
  await page
    .getByRole('button', { name: 'Añadir al margen', exact: true })
    .click()
  await page
    .locator('.review-panel-comment-body:visible')
    .filter({ hasText: 'Describe el método de medición y las unidades.' })
    .first()
    .waitFor()
  assert.equal(ultima, 'revisor_jurado')
  await page.screenshot({ path: join(capturas, 'jurado-real.png') })
  assert.deepEqual(errores, [])
  await writeFile(
    join(capturas, 'resultado.json'),
    JSON.stringify(
      {
        editorReal: true,
        modeloSimulado: true,
        revisionColaborativa: true,
        comentariosNativos: true,
        errores,
      },
      null,
      2
    )
  )
  console.log(
    'Overleaf real: botón del log, validación del servidor, propuesta con seguimiento, comentario de procedencia, visibilidad en otra pestaña y jurado: correctos.'
  )
} catch (error) {
  await page.screenshot({ path: join(capturas, 'fallo.png') })
  await writeFile(
    join(capturas, 'fallo.txt'),
    (await page.locator('body').innerText()).slice(0, 12000)
  )
  throw error
} finally {
  await browser.close()
}
