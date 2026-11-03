// Escenario del amigo en el editor real: TikZ que no compila → «Arreglar los errores con IA» →
// propuesta (modelo simulado, con el texto real) → Aplicar → recompila → seguimiento.
// Después: PDF de 25 páginas en «Foto o PDF a LaTeX» (rango, estimación) y capturas claro/oscuro.
// Uso: AEMCICD_IA_CORREO=… AEMCICD_IA_PASSWORD=… node agente-overleaf.cjs <carpeta> [claro|oscuro]
// Overleaf en http://localhost:8080, Mongo en el contenedor ol-mongo y TikZ en su TeX Live.
const { chromium } = require('playwright')
const CORREO = process.env.AEMCICD_IA_CORREO,
  CLAVE = process.env.AEMCICD_IA_PASSWORD
if (!CORREO || !CLAVE)
  throw new Error(
    'Indica AEMCICD_IA_CORREO y AEMCICD_IA_PASSWORD (cuenta ficticia).'
  )
const crypto = require('crypto')
const { execSync } = require('child_process')
const OUT = process.argv[2],
  TEMA = process.argv[3] || 'claro'
const mongo = js =>
  execSync(`docker exec ol-mongo mongosh --quiet sharelatex --eval '${js}'`)
    .toString()
    .trim()
const TIKZ = String.raw`\documentclass{article}
\usepackage{tikz}
\begin{document}
\section{Diagrama}
\begin{tikzpicture}[node distance=2cm]
\node (a) [draw] {Entrada};
\node (b) [draw, right=of a] {Proceso};
\draw[-{Stealth}] (a) -- (b);
\end{tikzpicture}
\end{document}
`
;(async () => {
  mongo(
    `db.users.updateOne({email:"${CORREO}"},{$set:{"ace.overallTheme":"${TEMA === 'oscuro' ? '' : 'light-'}"}})`
  )
  const b = await chromium.launch()
  const ctx = await b.newContext({
    viewport: { width: 1366, height: 820 },
    locale: 'es-EC',
  })
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', e => errores.push('pageerror: ' + e.message))
  await p.goto('http://localhost:8080/login')
  await p.fill('input[name=email]', CORREO)
  await p.fill('input[name=password]', CLAVE)
  await p.click('button[type=submit]')
  await p.waitForURL('**/project')
  const href = await p
    .locator('a[href^="/project/"]')
    .first()
    .getAttribute('href')
  const projectId = href.split('/').pop()
  await p.goto('http://localhost:8080' + href)
  await p.waitForSelector('.cm-content', { timeout: 60000 })
  await p.waitForTimeout(2500)
  const vista = 'document.querySelector(".cm-content").cmView.view'
  const textoDoc = () => p.evaluate(v => eval(v).state.doc.toString(), vista)
  const docId = await p.evaluate(() =>
    window.overleaf.unstable.store.get('editor.open_doc_id')
  )
  // Documento con el TikZ roto del amigo (falta \usetikzlibrary{positioning,arrows.meta}).
  await p.evaluate(
    ([v, t]) => {
      const view = eval(v)
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: t },
      })
    },
    [vista, TIKZ]
  )
  await p.waitForTimeout(1500)
  const recompilar = () =>
    p.getByRole('button', { name: 'Recompilar' }).first().click()
  await recompilar()
  await p.waitForTimeout(9000)
  const logs = p
    .locator(
      '[aria-label*="registros" i], [aria-label*="logs" i], button:has-text("Logs")'
    )
    .first()
  if (await logs.count()) {
    await logs.click()
    await p.waitForTimeout(1500)
  }
  const arreglar = p.getByRole('button', { name: /Arreglar .* con IA/ })
  console.log('botón «Arreglar los errores con IA»:', await arreglar.count())
  await p.screenshot({ path: `${OUT}/${TEMA}-a1-log.png` })

  // Respuesta simulada: el primer intento solo añade arrows.meta (queda el error de positioning),
  // el segundo añade positioning. Se comprueba qué envía el navegador en cada consulta.
  const enviados = []
  let intento = 0
  await p.route('**/aemcicd-ai/consulta', async r => {
    const cuerpo = r.request().postDataJSON()
    enviados.push(cuerpo)
    intento++
    const texto = await textoDoc()
    const antes =
      intento === 1 ? '\\usepackage{tikz}\n' : '\\usetikzlibrary{arrows.meta}\n'
    const despues =
      intento === 1
        ? '\\usepackage{tikz}\n\\usetikzlibrary{arrows.meta}\n'
        : '\\usetikzlibrary{arrows.meta,positioning}\n'
    const desde = texto.indexOf(antes)
    const eventoId = mongo(
      `const u=db.users.findOne({email:"${CORREO}"}); print(String(db.aemcicdAiEventos.insertOne({userId:u._id, projectId:ObjectId("${projectId}"), funcion:"agente", estado:"ok", fecha:new Date(), costoMicro:0}).insertedId))`
    )
    const fin = {
      tipo: 'fin',
      eventoId,
      proveedor: 'openai',
      modelo: 'gpt-6.1-terra',
      costo: 0.0011,
      explicacion:
        intento === 1
          ? 'La punta de flecha `Stealth` está en la biblioteca `arrows.meta`; la añado al preámbulo.'
          : 'Falta también `positioning` para `right=of a`.',
      cambios: [
        {
          archivo: 'main.tex',
          antes,
          despues,
          docId,
          desde,
          hasta: desde + antes.length,
          huella: crypto.createHash('sha256').update(texto).digest('hex'),
        },
      ],
      saldo: {
        credito: 1,
        gastado: 0.0011 * intento,
        disponible: 1 - 0.0011 * intento,
        renuevaEl: '2026-12-01T05:00:00.000Z',
      },
    }
    const trozos = fin.explicacion
      .match(/.{1,20}/g)
      .map(t => JSON.stringify({ tipo: 'texto', texto: t }) + '\n')
      .join('')
    await r.fulfill({
      status: 200,
      contentType: 'application/x-ndjson',
      body: trozos + JSON.stringify(fin) + '\n',
    })
  })
  await arreglar.first().click()
  await p.waitForSelector('.aemcicd-ai-propuesta', { timeout: 20000 })
  const e1 = enviados[0]
  console.log(
    '1ª consulta:',
    e1.funcion,
    '| archivo',
    e1.entrada.archivo,
    '| cursor',
    e1.entrada.cursor,
    '| errores',
    e1.entrada.errores?.length,
    '|',
    e1.entrada.errores?.map(e => e.mensaje.slice(0, 50)).join(' / ')
  )
  await p.screenshot({ path: `${OUT}/${TEMA}-a2-propuesta.png` })
  await p
    .getByRole('button', { name: /^(Aplicar|Enviar a revisión)$/ })
    .first()
    .click()
  await p.waitForSelector('.aemcicd-ai-seguimiento', { timeout: 10000 })
  await p.waitForFunction(
    () =>
      /Sigue habiendo|Compila sin errores/.test(
        document.querySelector('.aemcicd-ai-seguimiento')?.innerText || ''
      ),
    null,
    { timeout: 60000 }
  )
  console.log(
    'seguimiento 1:',
    (await p.locator('.aemcicd-ai-seguimiento').innerText()).replace(
      /\n+/g,
      ' | '
    )
  )
  await p.screenshot({ path: `${OUT}/${TEMA}-a3-seguimiento.png` })
  const seguir = p.getByRole('button', { name: 'Seguir arreglando' })
  if (await seguir.count()) {
    await seguir.click()
    await p.waitForFunction(
      () => document.querySelectorAll('.aemcicd-ai-propuesta').length >= 2,
      null,
      { timeout: 20000 }
    )
    const e2 = enviados[1]
    console.log(
      '2ª consulta: historial',
      e2.entrada.historial?.length,
      'turnos | errores',
      e2.entrada.errores?.length
    )
    await p
      .locator('.aemcicd-ai-propuesta')
      .nth(1)
      .getByRole('button', { name: /^(Aplicar|Enviar a revisión)$/ })
      .click()
    await p.waitForFunction(
      () =>
        /Sigue habiendo|Compila sin errores/.test(
          document.querySelector('.aemcicd-ai-seguimiento')?.innerText || ''
        ),
      null,
      { timeout: 60000 }
    )
    console.log(
      'seguimiento 2:',
      (await p.locator('.aemcicd-ai-seguimiento').innerText()).replace(
        /\n+/g,
        ' | '
      )
    )
  }
  console.log(
    'preámbulo final:',
    (await textoDoc()).split('\n').slice(0, 3).join(' ⏎ ')
  )
  await p.screenshot({ path: `${OUT}/${TEMA}-a4-compila.png` })

  // Chat normal con selección: chips de contexto.
  await p.locator('.cm-line', { hasText: 'node (a)' }).first().click()
  await p.keyboard.press('Home')
  await p.keyboard.press('Shift+ArrowDown')
  await p.keyboard.press('Shift+ArrowDown')
  await p.waitForTimeout(1500)
  console.log(
    'chips:',
    (await p.locator('.aemcicd-ai-contexto').innerText()).replace(/\n+/g, ' · ')
  )
  await p
    .locator('textarea[aria-label="Mensaje para la IA"]')
    .fill('Haz las cajas con esquinas redondeadas')
  await p.screenshot({ path: `${OUT}/${TEMA}-a5-chips.png` })
  const turnosAntes = await p.locator('.aemcicd-ai-turno').count()
  await p.locator('textarea[aria-label="Mensaje para la IA"]').press('Enter')
  await p.waitForFunction(
    n => document.querySelectorAll('.aemcicd-ai-turno').length > n,
    turnosAntes,
    { timeout: 20000 }
  )
  await p.waitForTimeout(1500)
  const e3 = enviados.at(-1)
  console.log(
    '3ª consulta (chat):',
    e3.funcion,
    '| selección',
    e3.entrada.desde,
    '-',
    e3.entrada.hasta,
    '| historial',
    e3.entrada.historial?.length
  )

  // Herramientas.
  await p.getByRole('tab', { name: 'Herramientas' }).click()
  await p.waitForTimeout(600)
  await p.screenshot({ path: `${OUT}/${TEMA}-a6-herramientas.png` })
  await p.getByRole('tab', { name: 'Conversación' }).click()

  // PDF de 25 páginas generado con Chromium.
  const pdfPage = await ctx.newPage()
  await pdfPage.setContent(
    Array.from(
      { length: 25 },
      (_, i) =>
        `<section style="page-break-after:always;font:20px serif"><h1>Página ${i + 1}</h1><p>La energía es E = mc<sup>2</sup>. Ecuación ${i + 1}.</p></section>`
    ).join('')
  )
  const pdf = await pdfPage.pdf({ format: 'A4' })
  await pdfPage.close()
  require('fs').writeFileSync(OUT + '/prueba-25.pdf', pdf)
  let foto = null
  await p.route('**/aemcicd-ai/foto', async r => {
    foto = r.request().postDataJSON()
    await r.fulfill({
      status: 200,
      contentType: 'application/x-ndjson',
      body:
        JSON.stringify({
          tipo: 'error',
          codigo: 'prueba',
          mensaje: 'Respuesta simulada (prueba e2e).',
        }) + '\n',
    })
  })
  await p.setInputFiles(
    'input[aria-label="Foto o PDF a LaTeX"]',
    OUT + '/prueba-25.pdf'
  )
  await p.waitForSelector('.aemcicd-ai-rango', { timeout: 20000 })
  await p.screenshot({ path: `${OUT}/${TEMA}-a7-rango.png` })
  await p.locator('.aemcicd-ai-rango input').nth(0).fill('2')
  await p.locator('.aemcicd-ai-rango input').nth(1).fill('5')
  await p.getByRole('button', { name: 'Usar estas páginas' }).click()
  await p.waitForFunction(
    () =>
      /págs/.test(
        document.querySelector('.aemcicd-ai-contexto')?.innerText || ''
      ),
    null,
    { timeout: 30000 }
  )
  console.log('adjunto:', await p.locator('.aemcicd-ai-contexto').innerText())
  await p.locator('textarea[aria-label="Mensaje para la IA"]').press('Enter')
  await p.waitForSelector('.aemcicd-ai-estimacion', { timeout: 20000 })
  console.log(
    'estimación:',
    (await p.locator('.aemcicd-ai-estimacion').innerText()).replace(
      /\n+/g,
      ' | '
    )
  )
  await p.screenshot({ path: `${OUT}/${TEMA}-a8-estimacion.png` })
  await p.getByRole('button', { name: 'Consultar con este costo' }).click()
  await p.waitForTimeout(2500)
  console.log(
    '/foto recibió',
    foto?.entrada?.imagenes?.length,
    'páginas; mayor',
    Math.max(...(foto?.entrada?.imagenes || []).map(i => i.base64.length)),
    'b64; máximo aceptado',
    foto?.maximoAceptadoMicro
  )
  console.log('errores JS:', errores.join('\n') || 'ninguno')
  await b.close()
})().catch(e => {
  console.error(e)
  process.exit(1)
})
