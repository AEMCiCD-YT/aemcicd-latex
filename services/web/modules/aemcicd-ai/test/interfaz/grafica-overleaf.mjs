// Pyodide y subida de PDF reales; solo la propuesta de script se simula con un fixture revisado.
import { createRequire } from 'node:module'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import assert from 'node:assert/strict'
import { validarGrafica } from '../../app/src/fase2.mjs'
const { chromium } = createRequire(
  resolve(
    process.env.AEMCICD_IA_DEPS || '/tmp/aemcicd-ia-pruebas',
    'package.json'
  )
)('playwright')
const ids = JSON.parse(await readFile('/tmp/ia-overleaf-ids.json', 'utf8'))
const eventoId = '000000000000000000000203'
const { grafica, explicacion } = validarGrafica(
  JSON.stringify({
    explicacion: 'Gráfica sintética para probar el ejecutor real.',
    script:
      "import io\nimport numpy as np\nx, y = np.loadtxt(io.StringIO(datos_csv), delimiter=',', skiprows=1, unpack=True)\nplt.plot(x, y, 'o-', label='Mediciones sintéticas')\nplt.xlabel('Tiempo (s)')\nplt.ylabel('Distancia (m)')\nplt.legend()\nplt.savefig(ruta_pdf, format='pdf', bbox_inches='tight')\nprint('PDF de prueba generado')",
  }),
  'x,y\n0,1\n1,3\n2,5',
  eventoId
)
const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome',
  args: ['--no-sandbox'],
})
const context = await browser.newContext({
  storageState: '/tmp/ia-overleaf-sesion.json',
  viewport: { width: 1600, height: 1100 },
})
const page = await context.newPage()
const capturas =
  process.env.AEMCICD_IA_CAPTURAS || '/tmp/aemcicd-ia-overleaf-capturas'
await mkdir(capturas, { recursive: true })
page.setDefaultTimeout(30000)
const errores = []
page.on('pageerror', e => errores.push(e.message))
await page.route('**/aemcicd-ai/consulta', route =>
  route.fulfill({
    contentType: 'application/x-ndjson',
    body:
      JSON.stringify({
        tipo: 'fin',
        eventoId,
        modelo: 'modelo-simulado',
        proveedor: 'openai',
        costo: 0,
        saldo: {
          credito: 1,
          gastado: 0,
          disponible: 1,
          renuevaEl: '2026-12-01T00:00:00Z',
        },
        explicacion,
        grafica,
      }) + '\n',
  })
)
async function archivos() {
  return (
    await (
      await page.request.get(
        `http://localhost:18182/project/${ids.projectId}/entities`
      )
    ).json()
  ).entities
}
try {
  await page.goto(`http://localhost:18182/project/${ids.projectId}`)
  await page.locator('.cm-content').first().waitFor()
  await page.getByRole('tab', { name: 'Asistente de IA', exact: true }).click()
  await page.getByText('Gráfica desde datos', { exact: true }).click()
  await page
    .getByLabel('Datos de Excel o CSV', { exact: true })
    .fill('x,y\n0,1\n1,3\n2,5')
  await page
    .getByRole('button', { name: 'Proponer gráfica', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Guardar script en el proyecto', exact: true })
    .click()
  const ejecutar = page.getByRole('button', {
    name: 'Ejecutar Python',
    exact: true,
  })
  await ejecutar.waitFor()
  assert.equal(
    (await archivos()).some(e =>
      e.path.endsWith(grafica.archivo.replace(/\.py$/, '.pdf'))
    ),
    false,
    'guardar no produce el PDF'
  )
  await page.screenshot({
    path: join(capturas, 'grafica-antes-de-ejecutar.png'),
  })
  await ejecutar.click({ timeout: 120000 })
  await page
    .getByText(
      'Ejecución terminada. Revisa el PDF y los resultados en el proyecto.',
      { exact: true }
    )
    .waitFor({ timeout: 180000 })
  const limite = Date.now() + 30000
  let listado
  do {
    listado = await archivos()
    if (
      listado.some(e =>
        e.path.endsWith(grafica.archivo.replace(/\.py$/, '.pdf'))
      )
    )
      break
    await new Promise(r => setTimeout(r, 300))
  } while (Date.now() < limite)
  assert.ok(
    listado.some(e =>
      e.path.endsWith(grafica.archivo.replace(/\.py$/, '.pdf'))
    ),
    'el PDF se subió al proyecto'
  )
  assert.deepEqual(errores, [])
  await page.screenshot({ path: join(capturas, 'grafica-pdf-subido.png') })
  await writeFile(
    join(capturas, 'grafica-resultado.json'),
    JSON.stringify(
      {
        pyodideReal: true,
        pdfEnProyecto: true,
        ejecucionExplicita: true,
        modeloSimulado: true,
      },
      null,
      2
    )
  )
  console.log(
    'Overleaf real: script guardado por EditorController, ejecución explícita en Pyodide y PDF subido al proyecto: correctos.'
  )
} catch (error) {
  await page.screenshot({ path: join(capturas, 'grafica-fallo.png') })
  await writeFile(
    join(capturas, 'grafica-fallo.txt'),
    await page.locator('body').innerText()
  )
  throw error
} finally {
  await browser.close()
}
