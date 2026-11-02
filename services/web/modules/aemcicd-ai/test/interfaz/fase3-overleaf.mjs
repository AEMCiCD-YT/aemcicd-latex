// Solo localhost y contenedores desechables; no admite producción ni claves reales.
import { createRequire } from 'node:module'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'
import { resolve, join } from 'node:path'
const require = createRequire(
  resolve(
    process.env.AEMCICD_IA_DEPS || '/tmp/aemcicd-ia-pruebas',
    'package.json'
  )
)
const { chromium } = require('playwright')
const base = process.env.AEMCICD_IA_URL || 'http://localhost:18183'
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1):18183$/)
const contenedor = 'aemcicd-ia-fase3-web-1'
const salida = '/tmp/ia-fase3-overleaf'
await mkdir(salida, { recursive: true })
async function nativo(codigo) {
  return new Promise((res, rej) => {
    const p = spawn('docker', [
      'exec',
      '-i',
      contenedor,
      'bash',
      '-lc',
      'source /etc/overleaf/env.sh && cd /overleaf/services/web && node --no-deprecation --input-type=module',
    ])
    let texto = '',
      error = ''
    p.stdout.on('data', d => (texto += d))
    p.stderr.on('data', d => (error += d))
    p.on('error', rej)
    p.on('close', code => {
      if (code !== 0) return rej(new Error(error.slice(-2000)))
      const linea = texto
        .split('\n')
        .find(l => l.startsWith('FASE3_RESULTADO:'))
      if (!linea)
        return rej(new Error('El adaptador nativo no devolvió resultado.'))
      res(JSON.parse(linea.slice('FASE3_RESULTADO:'.length)))
    })
    p.stdin.end(
      `try {\n${codigo}\n} catch(err) { console.error(err.message); process.exit(1) }\nprocess.exit(0)\n`
    )
  })
}
const navegador = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME || '/usr/bin/google-chrome',
  args: ['--no-sandbox'],
})
const contexto = await navegador.newContext({
  viewport: { width: 1600, height: 1100 },
  locale: 'es-EC',
})
const page = await contexto.newPage()
page.setDefaultTimeout(30000)
try {
  await page.goto(`${base}/login`)
  await page.locator('input[name="email"]').fill('admin@example.test')
  await page.locator('input[name="password"]').fill('PruebaLocalFase3!2026')
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL(/\/project(?:\?|$)/)
  const api = contexto.request
  const estado = await (await api.get(`${base}/aemcicd-ai/estado`)).json()
  assert.equal(estado.habilitada, true)
  const sesion = await (
    await api.get(`${base}/aemcicd-ai/soporte/sesion`)
  ).json()
  const headers = { 'X-CSRF-Token': sesion.csrf }
  if (!estado.activada)
    assert.equal(
      (
        await api.post(`${base}/aemcicd-ai/activar`, {
          headers,
          data: { aviso: estado.versionAviso },
        })
      ).status(),
      204
    )
  await contexto.storageState({ path: join(salida, 'sesion.json') })
  await page.goto(`${base}/templates`)
  await page
    .getByRole('button', { name: 'Física: laboratorio', exact: true })
    .waitFor()
  await Promise.all([
    page.waitForURL(/\/project\/[a-f\d]{24}$/),
    page
      .getByRole('button', { name: 'Física: laboratorio', exact: true })
      .click(),
  ])
  const plantilla = {
    projectId: new URL(page.url()).pathname.split('/').at(-1),
  }
  assert.match(plantilla.projectId, /^[a-f\d]{24}$/)
  await page.locator('.cm-content').first().waitFor()
  await page.goto(`${base}/templates`)
  await page.screenshot({
    path: join(salida, 'galeria-real.png'),
    fullPage: true,
  })
  const subida = await api.post(`${base}/project/new/upload`, {
    headers,
    multipart: {
      name: 'Proyecto sintético fase tres.zip',
      qqfile: {
        name: 'Proyecto sintético fase tres.zip',
        mimeType: 'application/zip',
        buffer: await readFile('/tmp/ia-fase3-proyecto.zip'),
      },
    },
  })
  assert.equal(subida.status(), 200, await subida.text())
  const proyecto = (await subida.json()).project_id
  assert.match(proyecto, /^[a-f\d]{24}$/)
  await page.goto(`${base}/project/${proyecto}`)
  await page.locator('.cm-content').first().waitFor()
  const original = await page
    .locator('.cm-content')
    .first()
    .evaluate(e => e.cmView.view.state.doc.toString())
  await page
    .locator('.cm-content')
    .first()
    .evaluate(e => {
      const v = e.cmView.view
      v.dispatch({
        changes: {
          from: v.state.doc.length,
          to: v.state.doc.length,
          insert: '\n% Señal de prueba fase tres\n',
        },
      })
    })
  await page.waitForTimeout(1200)
  await nativo(
    `const {default:H}=await import('./app/src/Features/History/HistoryManager.mjs'); await H.promises.flushProject('${proyecto}'); console.log('FASE3_RESULTADO:'+JSON.stringify({flush:true}))`
  )
  const actualizaciones = await (
    await api.get(`${base}/project/${proyecto}/updates?min_count=10`)
  ).json()
  assert.ok(actualizaciones.updates?.length)
  const desde = Math.min(...actualizaciones.updates.map(u => u.fromV)),
    hasta = Math.max(...actualizaciones.updates.map(u => u.toV))
  assert.ok(hasta > desde)
  const archivos = await (
    await api.get(`${base}/project/${proyecto}/aemcicd-ai/archivos`)
  ).json()
  assert.deepEqual(archivos.pdfs, ['articulos/estudio.pdf'])
  assert.deepEqual(archivos.bibliografias, ['referencias.bib'])
  for (const [funcion, entrada] of [
    [
      'chat_pdf',
      {
        pregunta: 'Explica el método de este PDF.',
        pdfs: ['articulos/estudio.pdf'],
      },
    ],
    [
      'resumen_cambios',
      {
        pregunta: 'Resume los cambios.',
        desdeVersion: desde,
        hastaVersion: hasta,
      },
    ],
    [
      'bibliografia_verificada',
      {
        pregunta: 'Estructura del ADN.',
        archivoBib: 'referencias.bib',
        dois: ['10.1038/171737a0'],
      },
    ],
  ]) {
    const r = await api.post(
      `${base}/project/${proyecto}/aemcicd-ai/estimacion`,
      { headers, data: { funcion, entrada } }
    )
    assert.equal(r.status(), 200, `${funcion}: ${await r.text()}`)
    assert.ok((await r.json()).tokensEntrada > 0)
  }
  const ajeno = await api.post(
    `${base}/project/${plantilla.projectId}/aemcicd-ai/estimacion`,
    {
      headers,
      data: {
        funcion: 'chat_pdf',
        entrada: {
          pregunta: 'No debe leer el otro proyecto.',
          pdfs: ['articulos/estudio.pdf'],
        },
      },
    }
  )
  assert.equal(ajeno.status(), 400)
  const resultado = await nativo(`
 const {lectorProyecto}=await import('./modules/aemcicd-ai/app/src/overleaf.mjs');
 const {getCollectionInternal,ObjectId}=await import('./app/src/infrastructure/mongodb.mjs');
 const {validarBibliografia}=await import('./modules/aemcicd-ai/app/src/fase3.mjs');
 const p=new ObjectId('${proyecto}');
 const pdf=await lectorProyecto.preparar(p,'chat_pdf',{pregunta:'Método',pdfs:['articulos/estudio.pdf'],texto:'CLIENTE_NO_CONFIABLE'},150000);
 if(!pdf.bloquePdf.includes('Synthetic phase three method') || pdf.bloquePdf.includes('CLIENTE_NO_CONFIABLE'))throw new Error('El PDF no vino del servidor');
 const h=await lectorProyecto.preparar(p,'resumen_cambios',{pregunta:'Cambios',desdeVersion:${desde},hastaVersion:${hasta}},150000);
 if(!h.bloqueHistorial.includes('Señal de prueba fase tres'))throw new Error('Falta el cambio real del historial');
 const b=await lectorProyecto.preparar(p,'bibliografia_verificada',{pregunta:'ADN',dois:['10.1038/171737a0'],archivoBib:'referencias.bib'},150000);
 const propuesta=await validarBibliografia(JSON.stringify({explicacion:'Fixture sin modelo',dois:b.referencias.map(r=>r.doi)}),b,await lectorProyecto.abrir(p));
 const u=await getCollectionInternal('users');const user=await u.findOne({email:'admin@example.test'});
 const eventos=await getCollectionInternal('aemcicdAiEventos');const eventoId=new ObjectId();
 await eventos.insertOne({_id:eventoId,userId:user._id,projectId:p,funcion:'beamer',nivel:'proyecto',proveedor:'openai',modelo:'fixture-sin-modelo',estado:'ok',fecha:new Date(),costoMicro:0,tokensEntrada:0,tokensSalida:0,tokensCache:0,valoracion:null,alternativa:false});
 console.log('FASE3_RESULTADO:'+JSON.stringify({pdf:true,historial:true,bibliografia:propuesta.cambios.length,eventoId:String(eventoId)}));
 `)
  assert.equal(resultado.bibliografia, 1)
  const contenido =
    '\\documentclass{beamer}\n\\begin{document}\n\\begin{frame}Presentación sintética\\end{frame}\n\\end{document}'
  const datos = { eventoId: resultado.eventoId, funcion: 'beamer', contenido }
  const malTipo = await api.post(
    `${base}/project/${proyecto}/aemcicd-ai/documento`,
    { headers, data: { ...datos, funcion: 'poster' } }
  )
  assert.equal(malTipo.status(), 404)
  const malProyecto = await api.post(
    `${base}/project/${plantilla.projectId}/aemcicd-ai/documento`,
    { headers, data: datos }
  )
  assert.equal(malProyecto.status(), 404)
  const guardar = await api.post(
    `${base}/project/${proyecto}/aemcicd-ai/documento`,
    { headers, data: datos }
  )
  assert.equal(guardar.status(), 200, await guardar.text())
  const generado = await guardar.json()
  assert.equal(
    generado.archivo,
    `ia-generados/beamer-${resultado.eventoId}.tex`
  )
  const repetido = await api.post(
    `${base}/project/${proyecto}/aemcicd-ai/documento`,
    { headers, data: datos }
  )
  assert.equal((await repetido.json()).id, generado.id)
  const integridad = await nativo(`
 const {lectorProyecto}=await import('./modules/aemcicd-ai/app/src/overleaf.mjs');const s=await lectorProyecto.abrir('${proyecto}');
 const principal=await s.leer('main.tex');const nuevo=await s.leer('${generado.archivo}');
 const {getCollectionInternal}=await import('./app/src/infrastructure/mongodb.mjs');const registro=await (await getCollectionInternal('aemcicdAiRegistro')).find({}).toArray();
 if(JSON.stringify(registro).includes('Presentación sintética'))throw new Error('Contenido en registro');
 console.log('FASE3_RESULTADO:'+JSON.stringify({original:principal.texto.includes('Prueba de contexto nativo.'),nuevo:nuevo.texto.includes('Presentación sintética'),registro:registro.length}));`)
  assert.equal(integridad.original, true)
  assert.equal(integridad.nuevo, true)
  assert.ok(integridad.registro > 0)
  const conversion = await api.get(
    `${base}/project/${proyecto}/download/conversion/docx?responseFormat=json&rootResourcePath=main.tex`
  )
  assert.equal(conversion.status(), 200, await conversion.text())
  const descarga = (await conversion.json()).downloadUrl
  assert.ok(descarga)
  const word = await api.get(new URL(descarga, base).href)
  assert.equal(word.status(), 200)
  const binario = await word.body()
  assert.equal(binario.subarray(0, 2).toString(), 'PK')
  await writeFile(join(salida, 'exportado.docx'), binario)
  for (const tema of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: tema })
    await page.goto(`${base}/project/${proyecto}`)
    await page.locator('.cm-content').first().waitFor()
    const tab = page.getByRole('tab', { name: 'Asistente de IA', exact: true })
    if (!(await tab.getAttribute('class')).includes('open-rail'))
      await tab.click()
    await page.getByText('Investigación y PDF', { exact: true }).click()
    await page.getByLabel('Pregunta o tema', { exact: true }).waitFor()
    await page.screenshot({ path: join(salida, `panel-real-${tema}.png`) })
  }
  await writeFile(
    join(salida, 'resultado.json'),
    JSON.stringify(
      {
        proyecto,
        plantilla: plantilla.projectId,
        ...resultado,
        ...integridad,
        word: true,
        originalPrevio: original.length,
      },
      null,
      2
    )
  )
  console.log(
    'Overleaf real: galería, PDF del servidor, DOI real, historial real, estimaciones, pertenencia, guardado nativo idempotente y Word: correctos. Sin modelos; evento de autorización sintético.'
  )
} finally {
  await navegador.close()
}
