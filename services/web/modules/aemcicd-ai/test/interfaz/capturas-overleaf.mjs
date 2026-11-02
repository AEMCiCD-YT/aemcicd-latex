// Capturas del editor real. No consulta modelos ni modifica el documento.
import { createRequire } from 'node:module'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
const { chromium } = createRequire(
  resolve(
    process.env.AEMCICD_IA_DEPS || '/tmp/aemcicd-ia-pruebas',
    'package.json'
  )
)('playwright')
const ids = JSON.parse(await readFile('/tmp/ia-overleaf-ids.json', 'utf8'))
const salida =
  process.env.AEMCICD_IA_CAPTURAS || '/tmp/aemcicd-ia-overleaf-capturas'
await mkdir(salida, { recursive: true })
const b = await chromium.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome',
  args: ['--no-sandbox'],
})
try {
  for (const tema of ['light', 'dark']) {
    const c = await b.newContext({
      storageState: '/tmp/ia-overleaf-sesion.json',
      colorScheme: tema,
      viewport: { width: 1600, height: 1100 },
    })
    const p = await c.newPage()
    await p.goto(`http://localhost:18182/project/${ids.projectId}`)
    await p.locator('.cm-content').first().waitFor()
    const tab = p.getByRole('tab', { name: 'Asistente de IA', exact: true })
    if (!(await tab.getAttribute('class')).includes('open-rail'))
      await tab.click()
    await p
      .getByRole('button', { name: 'Fórmula desde texto', exact: true })
      .waitFor()
    await p.screenshot({ path: join(salida, `panel-real-${tema}.png`) })
    await p
      .locator('.cm-content')
      .first()
      .evaluate(e => {
        const v = e.cmView.view
        const desde = v.state.doc.toString().indexOf('La velocidad')
        v.dispatch({
          selection: { anchor: desde, head: desde + 28 },
          userEvent: 'select',
        })
        v.focus()
      })
    await p.getByLabel('Reescribir con IA', { exact: true }).click()
    await p
      .getByRole('button', { name: 'Mejorar redacción', exact: true })
      .waitFor()
    await p.screenshot({ path: join(salida, `seleccion-real-${tema}.png`) })
    await c.close()
  }
  console.log(
    'Capturas del panel y del menú de selección real en claro y oscuro: correctas.'
  )
} finally {
  await b.close()
}
