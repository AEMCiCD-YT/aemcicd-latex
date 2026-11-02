// Conversión y lectura reales; no llama a ningún proveedor de IA.
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const { request } = createRequire(
  resolve(
    process.env.AEMCICD_IA_DEPS || '/tmp/aemcicd-ia-pruebas',
    'package.json'
  )
)('playwright')
const url = 'http://localhost:18182'
const api = await request.newContext({
  baseURL: url,
  storageState: '/tmp/ia-overleaf-sesion.json',
  timeout: 120000,
})
try {
  const pagina = await api.get('/project')
  assert.equal(
    new URL(pagina.url()).pathname,
    '/project',
    'Inicia sesión primero con la cuenta ficticia'
  )
  const csrf = (await pagina.text()).match(
    /name="ol-csrfToken"[^>]*content="([^"]+)"/
  )[1]
  const headers = { 'X-Csrf-Token': csrf }
  const origen = 'https://plataforma.aemcicd.org'
  const sesion = await api.get('/aemcicd-ai/soporte/sesion', {
    headers: { Origin: origen },
  })
  assert.equal(sesion.status(), 200)
  assert.equal(sesion.headers()['access-control-allow-origin'], origen)
  assert.equal(sesion.headers()['cache-control'], 'no-store')
  assert.ok((await sesion.json()).csrf)
  assert.equal(
    (
      await api.get('/aemcicd-ai/soporte/sesion', {
        headers: { Origin: 'https://ajeno.example' },
      })
    ).status(),
    403
  )
  assert.equal(
    (
      await api.post('/aemcicd-ai/soporte', {
        headers: { Origin: origen },
        data: { pregunta: 'No ejecutar: falta CSRF' },
      })
    ).status(),
    403
  )
  const resumen = await api.get('/aemcicd-ai/resumen', {
    headers: { Origin: origen },
  })
  assert.equal(resumen.status(), 200)
  assert.equal(resumen.headers()['access-control-allow-origin'], origen)
  const datos = await resumen.json()
  assert.ok(Array.isArray(datos.porFuncionYModelo))
  for (const clave of ['userId', 'projectId', 'pregunta', 'respuesta'])
    assert.equal(Object.hasOwn(datos, clave), false)
  const zip = await api.post('/project/new/upload', {
    headers,
    multipart: {
      name: 'Prism sintético.zip',
      qqfile: {
        name: 'Prism sintético.zip',
        mimeType: 'application/zip',
        buffer: await readFile('/tmp/aemcicd-ia-importaciones/prism.zip'),
      },
    },
  })
  assert.equal(zip.status(), 200, await zip.text())
  const prism = await zip.json()
  assert.ok(prism.project_id)
  const estimacion = await api.post(
    `/project/${prism.project_id}/aemcicd-ai/consulta`,
    {
      headers,
      data: {
        funcion: 'grafica_datos',
        entrada: {
          archivoDatos: 'datos/mediciones.csv',
          pregunta: '',
        },
      },
    }
  )
  assert.equal(estimacion.status(), 200, await estimacion.text())
  const rechazo = JSON.parse((await estimacion.text()).trim())
  assert.equal(rechazo.codigo, 'entrada')
  assert.match(rechazo.mensaje, /La descripción de la gráfica debe tener/) // El CSV se leyó antes de rechazar la pregunta vacía; no se llamó al modelo.
  const word = await api.post('/project/new/import-document?type=docx', {
    headers,
    multipart: {
      name: 'Word sintético.docx',
      qqfile: {
        name: 'Word sintético.docx',
        mimeType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        buffer: await readFile('/tmp/aemcicd-ia-importaciones/word.docx'),
      },
    },
  })
  const resultado = {
    cors: true,
    csrf: true,
    resumenAgregado: true,
    prism: true,
    csvFileRef: true,
    wordEstado: word.status(),
    word: await word.json(),
  }
  await writeFile(
    '/tmp/aemcicd-ia-importaciones/resultado.json',
    JSON.stringify(resultado, null, 2)
  )
  assert.equal(word.status(), 200, JSON.stringify(resultado.word))
  assert.ok(resultado.word.project_id)
  console.log(
    'Overleaf real: CORS limitado, CSRF, resumen administrador sin identificadores, ZIP de Prism, CSV fileRef y conversión Word mediante CLSI: correctos.'
  )
} finally {
  await api.dispose()
}
