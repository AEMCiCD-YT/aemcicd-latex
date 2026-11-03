import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, join, basename } from 'node:path'
import assert from 'node:assert/strict'
import { prepararDeclaracion } from '../../app/src/declaracion.mjs'

const require = createRequire(
  resolve(process.env.AEMCICD_IA_DEPS || '.', 'package.json')
)
const { chromium } = require('playwright')
const salida = process.env.AEMCICD_IA_BANCO || '/tmp/aemcicd-ia-banco'
const capturas = process.env.AEMCICD_IA_CAPTURAS || '/tmp/aemcicd-ia-capturas'
await mkdir(capturas, { recursive: true })
const servidor = createServer(async (req, res) => {
  const archivo =
    basename(new URL(req.url, 'http://localhost').pathname) || 'index.html'
  if (
    !['index.html', 'app.js', 'modulo.css', 'pdf.worker.mjs'].includes(archivo)
  ) {
    res.writeHead(404).end()
    return
  }
  try {
    res.setHeader(
      'Content-Type',
      archivo.endsWith('.html')
        ? 'text/html'
        : archivo.endsWith('.css')
          ? 'text/css'
          : 'text/javascript'
    )
    res.end(await readFile(join(salida, archivo)))
  } catch {
    res.writeHead(404).end()
  }
})
servidor.listen(0, '127.0.0.1')
await new Promise(r => servidor.once('listening', r))
const url = `http://127.0.0.1:${servidor.address().port}`
const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
const errores = []
page.on('pageerror', e => errores.push(e.message))
const peticiones = []
const estimaciones = []
const registros = []
const comentariosPublicados = []
await page.route('**/project/*/thread/*/messages', async route => {
  comentariosPublicados.push(route.request().postDataJSON())
  return route.fulfill({ status: 204 })
})
const saldo = {
  credito: 1,
  gastado: 0.001,
  disponible: 0.999,
  renuevaEl: '2026-12-01T05:00:00Z',
}
let fallarRegistro = false
await page.route('**/aemcicd-ai/estado', route =>
  route.fulfill({
    json: { habilitada: true, activada: true, saldo, versionAviso: '2026-11' },
  })
)
await page.route('**/project/*/aemcicd-ai/*', async route => {
  const accion = route.request().url().split('/').at(-1)
  const body =
    route.request().method() === 'POST' ? route.request().postDataJSON() : null
  if (accion === 'archivos')
    return route.fulfill({ json: { pdfs: [], bibliografias: [] } })
  if (accion === 'instrucciones')
    return route.fulfill({
      json: body ? { id: 'doc-main' } : { existe: false },
    })
  if (accion === 'estimacion') {
    estimaciones.push(body)
    return route.fulfill({
      json: { tokensEntrada: 2500, maximoMicro: 40000, modelos: [] },
    })
  }
  if (accion === 'validar-cambio') return route.fulfill({ json: body.cambio })
  if (accion === 'validar-comentario')
    return route.fulfill({ json: body.comentario })
  if (accion === 'grafica')
    return route.fulfill({
      json: { id: 'grafica-prueba', archivo: 'graficas/grafica-prueba.py' },
    })
  if (accion === 'declaracion') {
    const texto = await page.evaluate(() =>
      window.bancoIA.view.state.doc.toString()
    )
    return route.fulfill({
      json: {
        cambio: prepararDeclaracion(
          {
            ruta: 'main.tex',
            id: 'doc-main',
            texto,
            huella: createHash('sha256').update(texto).digest('hex'),
          },
          [{ funcion: 'reescribir' }],
          body.retirar
        ),
        aviso: 'Declara el uso de IA según las normas aplicables.',
      },
    })
  }
  if (accion === 'registro') {
    if (route.request().method() === 'GET')
      return route.fulfill({
        json: {
          registro: [
            {
              userId: 'prueba',
              funcion: 'reescribir',
              resumen: 'reescribió una selección: main.tex',
              fecha: '2026-11-01T12:00:00Z',
            },
          ],
        },
      })
    registros.push(body)
    return route.fulfill({ status: fallarRegistro ? 500 : 204 })
  }
  if (accion !== 'consulta' && accion !== 'foto')
    return route.fulfill({ status: 404 })
  peticiones.push(body)
  const original = await page.evaluate(() =>
    window.bancoIA.view.state.doc.toString()
  )
  const antes = body.entrada.seleccion ?? original
  const desde = body.entrada.desde ?? 0
  const despues =
    body.funcion === 'reescribir'
      ? 'La velocidad medida es v_0 = 3 m/s.'
      : 'La velocidad es $v_0 = 3$ m/s.'
  const cambio = {
    archivo: 'main.tex',
    docId: 'doc-main',
    desde,
    hasta: desde + antes.length,
    antes,
    despues,
    huella: createHash('sha256').update(original).digest('hex'),
  }
  const chat =
    body.funcion === 'chat_proyecto' ||
    body.funcion === 'pregunta' ||
    (body.funcion === 'agente' && body.entrada.usarProyecto)
  const extra =
    body.funcion === 'revisor_jurado'
      ? {
          explicacion: 'Observación académica de prueba.',
          comentarios: [
            {
              archivo: 'main.tex',
              docId: 'doc-main',
              cita: original,
              desde: 0,
              hasta: original.length,
              comentario: 'Describe cómo mediste las variables.',
            },
          ],
        }
      : body.funcion === 'grafica_datos'
        ? {
            explicacion: 'Gráfica propuesta para revisión.',
            grafica: {
              archivo: 'graficas/grafica-prueba.py',
              script:
                "import matplotlib.pyplot as plt\nplt.savefig('grafica.pdf')",
            },
          }
        : {}
  return route.fulfill({
    contentType: 'application/x-ndjson',
    body:
      (chat
        ? JSON.stringify({
            tipo: 'texto',
            texto: 'La metodología necesita describir las unidades.',
          }) + '\n'
        : '') +
      JSON.stringify({
        tipo: 'fin',
        eventoId: 'evento-simulado',
        proveedor: 'openai',
        modelo: 'gpt-6.1-terra',
        costo: 0.001,
        saldo,
        ...(chat
          ? {}
          : {
              explicacion:
                'El subíndice debe estar dentro del modo matemático. Revisa la propuesta antes de aplicarla.',
              cambios: [cambio],
            }),
        ...(['revisor_jurado', 'grafica_datos'].includes(body.funcion)
          ? { ...extra, cambios: [] }
          : {}),
      }) +
      '\n',
  })
})

async function abrir(parametros = '') {
  await page.goto(url + '/' + parametros)
  await page.getByRole('tab', { name: 'Conversación', exact: true }).waitFor()
}
async function herramientas() {
  await page.getByRole('tab', { name: 'Herramientas', exact: true }).click()
}
const enviar = () =>
  page.getByRole('button', { name: 'Enviar', exact: true }).click()
async function corregir() {
  await page
    .getByRole('button', { name: 'Corregir con IA', exact: true })
    .click()
  await page
    .getByText('El subíndice debe estar dentro', { exact: false })
    .waitFor()
}

function pdfSintetico(paginas) {
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Count ${paginas} /Kids [${Array.from({ length: paginas }, (_, i) => `${3 + 2 * i} 0 R`).join(' ')}] >>`,
  ]
  for (let i = 0; i < paginas; i++)
    objetos.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << >> /Contents ${4 + 2 * i} 0 R >>`,
      '<< /Length 3 >>\nstream\nq Q\nendstream'
    )
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objetos.forEach((objeto, i) => {
    offsets.push(Buffer.byteLength(pdf))
    pdf += `${i + 1} 0 obj\n${objeto}\nendobj\n`
  })
  const xref = Buffer.byteLength(pdf)
  pdf +=
    `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n` +
    offsets
      .slice(1)
      .map(o => String(o).padStart(10, '0') + ' 00000 n \n')
      .join('')
  pdf += `trailer\n<< /Root 1 0 R /Size ${objetos.length + 1} >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf)
}

try {
  for (const tema of ['claro', 'oscuro']) {
    await abrir(tema === 'oscuro' ? '?oscuro' : '')
    await page.screenshot({ path: join(capturas, `panel-${tema}.png`) })
    await corregir()
    assert.equal(peticiones.at(-1).funcion, 'corregir_error')
    assert.equal(peticiones.at(-1).entrada.archivo, 'main.tex')
    assert.equal(peticiones.at(-1).entrada.documento, undefined)
    await page.getByText('Ver diferencias', { exact: true }).click()
    await page.screenshot({ path: join(capturas, `log-${tema}.png`) })
    const registroGuardado = page.waitForResponse(
      r =>
        r.url().endsWith('/aemcicd-ai/registro') &&
        r.request().method() === 'POST' &&
        r.status() === 204
    )
    await page
      .getByRole('button', { name: 'Enviar a revisión', exact: true })
      .click()
    await page
      .getByText('Propuesta enviada a Control de cambios', { exact: false })
      .waitFor()
    await registroGuardado
    assert.equal(
      await page.evaluate(() => window.bancoIA.view.state.doc.toString()),
      'La velocidad es $v_0 = 3$ m/s.'
    )
    assert.equal(registros.at(-1).detalle, 'main.tex')
    await page.evaluate(() => window.bancoIA.deshacer())
    assert.equal(
      await page.evaluate(() => window.bancoIA.view.state.doc.toString()),
      'La velocidad es v_0 = 3 m/s.'
    )
    await page.evaluate(() => {
      const view = window.bancoIA.view
      view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } })
    })
    await page.getByLabel('Reescribir con IA', { exact: true }).click()
    await page.screenshot({ path: join(capturas, `seleccion-${tema}.png`) })
    await page
      .getByRole('button', { name: 'Tono académico', exact: true })
      .click()
    await page
      .getByText('El subíndice debe estar dentro', { exact: false })
      .last()
      .waitFor()
    assert.equal(peticiones.at(-1).funcion, 'reescribir')
    assert.equal(peticiones.at(-1).entrada.accion, 'academico')
  }

  await abrir()
  await herramientas()
  await page.getByRole('button', { name: /^Fórmula desde texto/ }).click()
  await enviar()
  await page.getByRole('button', { name: 'Descartar', exact: true }).waitFor()
  assert.equal(peticiones.at(-1).funcion, 'formula_texto')
  await page.getByRole('button', { name: 'Descartar', exact: true }).click()
  await page.getByText('Propuesta descartada.', { exact: true }).waitFor()

  await abrir()
  await corregir()
  await page.evaluate(() =>
    window.bancoIA.view.dispatch({
      changes: {
        from: 0,
        to: window.bancoIA.view.state.doc.length,
        insert: 'Edición de un compañero.',
      },
    })
  )
  await page
    .getByRole('button', { name: 'Enviar a revisión', exact: true })
    .click()
  await page
    .getByText(
      'El texto que había que cambiar ya no está igual. Vuelve a consultar antes de aplicar.',
      {
        exact: true,
      }
    )
    .waitFor()
  assert.ok(
    (
      await page.evaluate(() => window.bancoIA.view.state.doc.toString())
    ).startsWith('Edición de un compañero.')
  )

  await abrir('?lectura')
  await corregir()
  assert.equal(
    await page
      .getByRole('button', { name: 'Enviar a revisión', exact: true })
      .count(),
    0
  )

  await abrir()
  await page.getByRole('button', { name: 'Todo el proyecto' }).click()
  await page
    .getByLabel('Mensaje para la IA')
    .fill('¿Qué falta en este proyecto?')
  const antesDeEstimar = peticiones.length
  await enviar()
  await page.getByRole('button', { name: 'Consultar con este costo' }).waitFor()
  assert.equal(peticiones.length, antesDeEstimar)
  await page.getByRole('button', { name: 'Consultar con este costo' }).click()
  await page
    .getByText('La metodología necesita describir las unidades.', {
      exact: true,
    })
    .waitFor()
  assert.equal(peticiones.at(-1).maximoAceptadoMicro, 40000)
  assert.equal(peticiones.at(-1).funcion, 'agente')
  assert.equal(peticiones.at(-1).entrada.usarProyecto, true)

  // Agente: contexto del editor (archivo, cursor, selección, errores) e historial.
  await abrir()
  await page.evaluate(() => {
    window.bancoLog = {
      errors: [
        {
          level: 'error',
          message: 'Undefined control sequence',
          file: './main.tex',
          line: 1,
          content: 'l.1 \\mathbb',
        },
      ],
      warnings: [],
      typesetting: [
        { level: 'typesetting', message: 'Overfull \\hbox (40pt too wide)' },
        { level: 'typesetting', message: 'Underfull \\hbox' },
      ],
    }
    const v = window.bancoIA.view
    v.dispatch({ selection: { anchor: 4, head: 12 } })
  })
  await page.getByRole('button', { name: /2 avisos|1 error/ }).waitFor()
  await page.getByRole('button', { name: '1 línea' }).waitFor()
  await page.getByLabel('Mensaje para la IA').fill('No compila, arréglalo')
  await enviar()
  await page.getByRole('button', { name: 'Descartar', exact: true }).waitFor()
  const agente = peticiones.at(-1)
  assert.equal(agente.funcion, 'agente')
  assert.equal(agente.entrada.archivo, 'main.tex')
  assert.equal(agente.entrada.cursor, 12)
  assert.deepEqual([agente.entrada.desde, agente.entrada.hasta], [4, 12])
  assert.equal(
    agente.entrada.errores.length,
    2,
    'error + Overfull, sin Underfull'
  )
  assert.equal(agente.entrada.errores[0].archivo, 'main.tex')
  assert.equal(agente.entrada.historial, undefined)
  assert.equal(
    agente.entrada.texto,
    undefined,
    'el navegador no envía el texto'
  )
  await page.getByLabel('Mensaje para la IA').fill('¿Y ahora?')
  await enviar()
  await page
    .getByRole('button', { name: 'Descartar', exact: true })
    .nth(1)
    .waitFor()
  assert.equal(peticiones.at(-1).entrada.historial.length, 2)
  assert.equal(peticiones.at(-1).entrada.historial[0].rol, 'estudiante')
  await page.evaluate(() => {
    window.bancoLog = undefined
  })

  await abrir()
  await corregir()
  fallarRegistro = true
  await page
    .getByRole('button', { name: 'Enviar a revisión', exact: true })
    .click()
  await page.getByRole('button', { name: 'Reintentar registro' }).waitFor()
  assert.equal(
    await page
      .getByRole('button', { name: 'Enviar a revisión', exact: true })
      .count(),
    0
  )
  fallarRegistro = false
  await page.getByRole('button', { name: 'Reintentar registro' }).click()
  await page
    .getByRole('button', { name: 'Reintentar registro' })
    .waitFor({ state: 'detached' })

  await abrir()
  await page.locator('input[type=file]').setInputFiles({
    name: 'dos-paginas.pdf',
    mimeType: 'application/pdf',
    buffer: pdfSintetico(2),
  })
  await page.getByText('2 págs.', { exact: false }).waitFor()
  await enviar()
  await page
    .getByRole('button', { name: 'Enviar a revisión', exact: true })
    .waitFor()
  assert.equal(peticiones.at(-1).funcion, 'foto_latex')
  assert.equal(peticiones.at(-1).entrada.imagenes.length, 2)
  assert.ok(peticiones.at(-1).entrada.imagenes[0].base64.startsWith('/9j/'))
  assert.equal(peticiones.at(-1).entrada.imagenes[0].tipo, undefined)

  // Más de 20 páginas: se elige el rango; más de 2 páginas: se estima antes.
  await abrir()
  await page.locator('input[type=file]').setInputFiles({
    name: 'largo.pdf',
    mimeType: 'application/pdf',
    buffer: pdfSintetico(25),
  })
  await page.getByText('El PDF tiene 25 páginas.', { exact: false }).waitFor()
  await page.getByLabel('Desde', { exact: true }).fill('3')
  await page.getByLabel('Hasta', { exact: true }).fill('6')
  await page.getByRole('button', { name: 'Usar estas páginas' }).click()
  await page.getByText('págs. 3–6', { exact: false }).waitFor()
  const antesFoto = peticiones.length
  await enviar()
  await page.getByRole('button', { name: 'Consultar con este costo' }).click()
  await page
    .getByRole('button', { name: 'Enviar a revisión', exact: true })
    .last()
    .waitFor()
  assert.equal(peticiones.length, antesFoto + 1)
  assert.equal(peticiones.at(-1).entrada.imagenes.length, 4)
  assert.equal(estimaciones.at(-1).entrada.paginas, 4)
  assert.equal(estimaciones.at(-1).entrada.imagenes, undefined)

  for (const modo of ['', '?history', '?oscuro']) {
    await abrir(modo)
    await herramientas()
    await page.getByText('Revisión y entrega', { exact: true }).click()
    await page
      .getByRole('button', { name: 'Revisor tipo jurado', exact: true })
      .click()
    await page.getByRole('button', { name: 'Consultar con este costo' }).click()
    await page.getByRole('button', { name: 'Añadir al margen' }).click()
    await page
      .getByText('Comentario añadido al Panel de revisión.', { exact: true })
      .waitFor()
    assert.match(
      comentariosPublicados.at(-1).content,
      /^IA, pedido por Estudiante de prueba/
    )
    assert.equal(await page.evaluate(() => window.ultimoPanel), 'review-panel')
    assert.ok(
      await page.evaluate(
        history =>
          history
            ? window.comentariosHistory?.length > 0
            : window.comentariosLegacy?.length > 0,
        modo.includes('history')
      )
    )
    await page.screenshot({
      path: join(
        capturas,
        modo.includes('oscuro')
          ? 'jurado-oscuro.png'
          : modo
            ? 'jurado-history.png'
            : 'jurado-legacy.png'
      ),
    })
  }

  await abrir()
  await herramientas()
  await page.getByText('Gráfica desde datos', { exact: true }).click()
  await page
    .getByLabel('Datos de Excel o CSV', { exact: true })
    .fill('x,y\n0,0\n1,2')
  await page.getByRole('button', { name: 'Proponer gráfica' }).click()
  await page
    .getByRole('button', { name: 'Guardar script en el proyecto' })
    .click()
  await page
    .getByRole('button', { name: 'Ejecutar Python', exact: true })
    .waitFor()
  assert.equal(
    await page.evaluate(() => window.ejecucionesPython || 0),
    0,
    'guardar nunca ejecuta Python'
  )
  await page.screenshot({ path: join(capturas, 'grafica-guardada.png') })
  await page
    .getByRole('button', { name: 'Ejecutar Python', exact: true })
    .click()
  await page.waitForFunction(() => window.ejecucionesPython === 1)

  await abrir()
  await page.evaluate(() => {
    const view = window.bancoIA.view
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: '\\begin{document}\nResultados.\n\\end{document}',
      },
    })
  })
  await herramientas()
  await page.getByText('Registro de uso', { exact: true }).click()
  await page
    .getByRole('button', { name: 'Generar declaración', exact: true })
    .click()
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
  await page.waitForFunction(() =>
    window.bancoIA.view.state.doc
      .toString()
      .includes('% AEMCICD-IA-DECLARACION-INICIO')
  )
  await page.evaluate(() => {
    const view = window.bancoIA.view
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: '\\begin{document}\nResultados.\n\\end{document}',
      },
    })
  })
  await page.waitForFunction(() =>
    window.avisoDeclaracion?.texto.includes('responsabilidad')
  )

  assert.deepEqual(
    errores,
    [],
    'no debe haber errores de ejecución en los componentes'
  )
  console.log(
    'Interfaz: claro/oscuro, log, selección, propuestas con seguimiento, jurado legacy/history, ejecución explícita de gráfica, declaración y aviso al borrarla, acciones rápidas, deshacer, descarte, conflicto, solo lectura, estimación, reintento del registro y PDF: correctos. Capturas: ' +
      capturas
  )
} finally {
  await browser.close()
  await new Promise(r => servidor.close(r))
}
