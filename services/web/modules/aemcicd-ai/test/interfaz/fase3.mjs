// Banco de componentes reales con HTTP adaptado: no sustituye una prueba del servidor completo.
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { basename, resolve, join } from 'node:path'
import assert from 'node:assert/strict'
const require = createRequire(
  resolve(process.env.AEMCICD_IA_DEPS || '.', 'package.json')
)
const { chromium } = require('playwright')
const banco = process.env.AEMCICD_IA_BANCO || '/tmp/aemcicd-ia-banco'
const capturas =
  process.env.AEMCICD_IA_CAPTURAS || '/tmp/aemcicd-ia-fase3-capturas'
await mkdir(capturas, { recursive: true })
const servidor = createServer(async (req, res) => {
  const archivo = basename(req.url.split('?')[0]) || 'index.html'
  if (
    !['index.html', 'app.js', 'modulo.css', 'pdf.worker.mjs'].includes(archivo)
  )
    return res.writeHead(404).end()
  res.setHeader(
    'Content-Type',
    archivo.endsWith('.html')
      ? 'text/html'
      : archivo.endsWith('.css')
        ? 'text/css'
        : 'text/javascript'
  )
  res.end(await readFile(join(banco, archivo)))
})
await new Promise(r => servidor.listen(0, '127.0.0.1', r))
const navegador = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME || '/usr/bin/google-chrome',
  args: ['--no-sandbox'],
})
const page = await navegador.newPage({
  viewport: { width: 1280, height: 1000 },
})
const errores = [],
  consultas = [],
  guardados = []
page.on('pageerror', e => errores.push(e.message))
const saldo = {
  credito: 1,
  gastado: 0.002,
  disponible: 0.998,
  renuevaEl: '2026-12-01T05:00:00Z',
}
const eventoId = 'a'.repeat(24)
await page.route('**/aemcicd-ai/estado', r =>
  r.fulfill({
    json: { habilitada: true, activada: true, saldo, versionAviso: '2026-11' },
  })
)
await page.route('**/aemcicd-ai/plantillas', r =>
  r.fulfill({
    json: { plantillas: [{ id: 'fisica', nombre: 'Física: laboratorio' }] },
  })
)
await page.route('**/aemcicd-ai/plantillas/fisica', r =>
  r.fulfill({ json: { projectId: 'proyecto-nuevo' } })
)
await page.route('**/project/proyecto-nuevo', r =>
  r.fulfill({
    contentType: 'text/html',
    body: '<h1>Proyecto sintético nuevo</h1>',
  })
)
await page.route('**/project/*/aemcicd-ai/*', async r => {
  const accion = r.request().url().split('/').at(-1)
  const body =
    r.request().method() === 'POST' ? r.request().postDataJSON() : null
  if (accion === 'archivos')
    return r.fulfill({
      json: { pdfs: ['estudio.pdf'], bibliografias: ['referencias.bib'] },
    })
  if (accion === 'instrucciones') return r.fulfill({ json: { existe: true } })
  if (accion === 'registro') return r.fulfill({ json: { registro: [] } })
  if (accion === 'estimacion')
    return r.fulfill({
      json: { tokensEntrada: 3000, maximoMicro: 40000, modelos: [] },
    })
  if (accion === 'documento') {
    guardados.push(body)
    return r.fulfill({
      json: {
        id: 'generado',
        archivo: `ia-generados/${body.funcion}-${eventoId}.tex`,
      },
    })
  }
  if (accion === 'consulta') {
    consultas.push(body)
    const documento = ['beamer', 'poster', 'codigo_algoritmo'].includes(
      body.funcion
    )
      ? {
          archivo: `ia-generados/${body.funcion}-${eventoId}.tex`,
          contenido:
            body.funcion === 'codigo_algoritmo'
              ? '\\documentclass{article}\n\\usepackage{algorithm2e}\n\\begin{document}Algoritmo\\end{document}'
              : body.funcion === 'poster'
                ? '\\documentclass{beamer}\n\\usepackage{beamerposter}\n\\begin{document}\\begin{frame}Método\\end{frame}\\end{document}'
                : '\\documentclass{beamer}\n\\begin{document}\\begin{frame}Método\\end{frame}\\end{document}',
        }
      : undefined
    return r.fulfill({
      contentType: 'application/x-ndjson',
      body:
        JSON.stringify({
          tipo: 'fin',
          eventoId,
          proveedor: 'openai',
          modelo: 'gpt-6.1-terra',
          costo: 0.002,
          saldo,
          explicacion:
            'Respuesta simulada: revisa el resultado. Fuente estudio.pdf, página 1.',
          cambios: [],
          ...(documento ? { documento } : {}),
        }) + '\n',
    })
  }
  return r.fulfill({ status: 204 })
})
const base = `http://127.0.0.1:${servidor.address().port}`
async function abrir() {
  await page.goto(base)
  await page
    .getByRole('button', { name: 'Crear presentación Beamer', exact: true })
    .count()
  await page.getByText('Investigación y PDF', { exact: true }).waitFor()
}
async function confirmar() {
  await page
    .getByRole('button', { name: 'Consultar con este costo', exact: true })
    .click()
  await page
    .getByText(
      'Respuesta simulada: revisa el resultado. Fuente estudio.pdf, página 1.',
      { exact: true }
    )
    .last()
    .waitFor()
}
try {
  await abrir()
  await page.getByText('Investigación y PDF', { exact: true }).click()
  await page
    .getByLabel('Pregunta o tema', { exact: true })
    .fill('¿Qué método se usó?')
  await page
    .getByLabel('PDF del proyecto (elige hasta tres)')
    .selectOption(['estudio.pdf'])
  await page
    .getByRole('button', { name: 'Consultar estos PDF', exact: true })
    .click()
  assert.equal(consultas.length, 0, 'No debe consultar antes de aceptar costo')
  await confirmar()
  assert.equal(consultas.at(-1).funcion, 'chat_pdf')
  assert.deepEqual(consultas.at(-1).entrada.pdfs, ['estudio.pdf'])
  assert.deepEqual(Object.keys(consultas.at(-1).entrada).sort(), [
    'pdfs',
    'pregunta',
  ])
  await page
    .getByRole('button', {
      name: 'Buscar y proponer bibliografía',
      exact: true,
    })
    .click()
  await confirmar()
  assert.equal(consultas.at(-1).funcion, 'bibliografia_verificada')
  assert.equal(consultas.at(-1).entrada.archivoBib, 'referencias.bib')
  for (const [seccion, titulo, funcion] of [
    ['Investigación y PDF', 'Revisar citas faltantes', 'citas_faltantes'],
    ['Equipo y notación', 'Revisar el trabajo en equipo', 'revision_equipo'],
    [
      'Equipo y notación',
      'Revisar coherencia de notación',
      'coherencia_notacion',
    ],
    ['Presentar y exportar', 'Crear presentación Beamer', 'beamer'],
    ['Presentar y exportar', 'Crear póster', 'poster'],
  ]) {
    await abrir()
    await page.getByText(seccion, { exact: true }).click()
    const antes = consultas.length
    await page.getByRole('button', { name: titulo, exact: true }).click()
    assert.equal(consultas.length, antes)
    await confirmar()
    assert.equal(consultas.at(-1).funcion, funcion)
    if (funcion === 'beamer') {
      assert.equal(guardados.length, 0, 'No se guarda automáticamente')
      await page
        .getByRole('button', {
          name: 'Guardar como archivo nuevo',
          exact: true,
        })
        .click()
      await page.getByText(/Archivo guardado\./).waitFor()
      assert.equal(guardados[0].eventoId, eventoId)
      assert.equal(
        await page.evaluate(() => window.bancoIA.view.state.doc.toString()),
        'La velocidad es v_0 = 3 m/s.'
      )
    }
    if (funcion === 'poster') {
      await page.getByRole('button', { name: 'Descartar', exact: true }).click()
      assert.equal(guardados.length, 1, 'Descartar no debe crear otro archivo')
    }
  }
  await abrir()
  await page
    .getByRole('button', { name: 'Resumir con IA', exact: true })
    .click()
  await confirmar()
  assert.equal(consultas.at(-1).funcion, 'resumen_cambios')
  assert.equal(consultas.at(-1).entrada.desdeVersion, 1)
  assert.equal(consultas.at(-1).entrada.hastaVersion, 3)
  await abrir()
  await page.getByLabel('Modo de conversación').selectOption('tutor_latex')
  assert.equal(
    await page
      .getByLabel('Usar todo el proyecto', { exact: true })
      .isDisabled(),
    true
  )
  await page
    .getByLabel('Pregunta para la IA', { exact: true })
    .fill('Enséñame label y ref.')
  await page.getByRole('button', { name: 'Preguntar', exact: true }).click()
  await page
    .getByText(
      'Respuesta simulada: revisa el resultado. Fuente estudio.pdf, página 1.',
      { exact: true }
    )
    .waitFor()
  assert.equal(consultas.at(-1).funcion, 'tutor_latex')
  await abrir()
  await page.evaluate(() => {
    const v = window.bancoIA.view
    v.dispatch({ selection: { anchor: 0, head: v.state.doc.length } })
  })
  await page.getByLabel('Reescribir con IA', { exact: true }).click()
  await page
    .getByRole('button', { name: 'Código a algoritmo', exact: true })
    .click()
  await page
    .getByText(
      'Respuesta simulada: revisa el resultado. Fuente estudio.pdf, página 1.',
      { exact: true }
    )
    .waitFor()
  assert.equal(consultas.at(-1).funcion, 'codigo_algoritmo')
  assert.equal(
    await page
      .getByRole('button', { name: 'Guardar como archivo nuevo', exact: true })
      .count(),
    1
  )
  assert.equal(
    await page.evaluate(() => window.bancoIA.view.state.doc.toString()),
    'La velocidad es v_0 = 3 m/s.'
  )
  assert.equal(
    consultas.at(-1).entrada.seleccion,
    'La velocidad es v_0 = 3 m/s.'
  )
  await abrir()
  await page.getByText('Presentar y exportar', { exact: true }).click()
  const antes = consultas.length
  await page
    .getByRole('button', { name: 'Descargar Word', exact: true })
    .click()
  assert.equal(await page.evaluate(() => window.wordSolicitado), true)
  assert.equal(consultas.length, antes, 'Exportar Word no llama a un modelo')
  await page
    .getByRole('button', { name: 'Física: laboratorio', exact: true })
    .click()
  await page.waitForURL('**/project/proyecto-nuevo')
  for (const tema of ['claro', 'oscuro']) {
    await abrir()
    await page.getByText('Investigación y PDF', { exact: true }).click()
    await page.evaluate(
      t => document.documentElement.classList.toggle('oscuro', t === 'oscuro'),
      tema
    )
    await page.screenshot({
      path: join(capturas, `fase3-panel-${tema}.png`),
      fullPage: true,
    })
  }
  await abrir()
  await page
    .getByRole('button', { name: 'Cambiar permiso de edición', exact: true })
    .click()
  await page.getByText('Presentar y exportar', { exact: true }).click()
  await page
    .getByRole('button', { name: 'Crear presentación Beamer', exact: true })
    .click()
  await confirmar()
  assert.equal(
    await page
      .getByRole('button', { name: 'Guardar como archivo nuevo', exact: true })
      .count(),
    0
  )
  assert.deepEqual(errores, [])
  console.log(
    'Fase 3: estimación, selección de PDF/Bib, investigación, tutor, historial, equipo, notación, archivos nuevos, descarte, Word sin modelo, plantillas, claro/oscuro y solo lectura: correctos. Banco con transporte adaptado.'
  )
} finally {
  await navegador.close()
  await new Promise(r => servidor.close(r))
}
