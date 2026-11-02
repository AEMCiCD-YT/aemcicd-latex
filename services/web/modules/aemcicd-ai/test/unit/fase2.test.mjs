import { test } from 'node:test'
import assert from 'node:assert/strict'
import { funcion, ErrorEntrada } from '../../app/src/funciones.mjs'
import { validarComentarios, validarGrafica } from '../../app/src/fase2.mjs'
import {
  prepararDeclaracion,
  INICIO_DECLARACION,
  FIN_DECLARACION,
  AVISO_DECLARACION,
} from '../../app/src/declaracion.mjs'
import { crearLectorProyecto, huella } from '../../app/src/proyecto.mjs'
import { validarRespuesta } from '../../app/src/cambios.mjs'
import { CONTEXTO, DOCUMENTO, SELECCION } from './casos-fase1.mjs'
import { ENTRADAS_FASE2 } from './casos-fase2.mjs'

for (const [nombre, entrada] of Object.entries(ENTRADAS_FASE2)) {
  test(`${nombre}: valida tipo, vacío y límites; contenido etiquetado`, () => {
    const def = funcion(nombre)
    for (const invalida of [
      null,
      {},
      42,
      [],
      { pregunta: '' },
      { ...entrada, pregunta: 42 },
      { ...entrada, pregunta: 'x'.repeat(4001) },
    ])
      assert.throws(() => def.preparar(invalida, CONTEXTO), ErrorEntrada)
    const p = def.preparar(entrada, CONTEXTO)
    assert.ok(
      JSON.stringify(p.mensajes).includes(
        nombre === 'soporte' || nombre === 'grafica_datos'
          ? '<seleccion>'
          : '<documento'
      )
    )
    if (def.usaProyecto)
      assert.deepEqual(
        p.mensajes[0].content[0].providerOptions.anthropic.cacheControl,
        { type: 'ephemeral' }
      )
    assert.equal(
      def.nivel,
      ['revisor_jurado', 'revisar_importacion'].includes(nombre)
        ? 'proyecto'
        : nombre === 'grafica_datos'
          ? 'escritura'
          : 'rapido'
    )
  })
}

test('soporte no recibe ni persiste información de cuentas o contenido del proyecto', () => {
  const p = funcion('soporte').preparar(ENTRADAS_FASE2.soporte, {
    bloqueProyecto: 'DOCUMENTO_PRIVADO_NO_ENVIAR',
    instrucciones: 'PREFERENCIA_PRIVADA',
  })
  assert.ok(!JSON.stringify(p).includes('DOCUMENTO_PRIVADO'))
  assert.ok(!JSON.stringify(p).includes('PREFERENCIA_PRIVADA'))
  assert.match(p.sistema, /No solicites contraseñas/)
})

test('revisión completa usa archivos leídos en el servidor y rechaza exceso sin recorte', async () => {
  const lector = crearLectorProyecto({
    obtenerProyecto: async () => ({
      rootDoc_id: 'a',
      rootFolder: [{ docs: [{ _id: 'a', name: 'main.tex' }], folders: [] }],
    }),
    obtenerDocumento: async () => ({ lines: [SELECCION], version: 1 }),
  })
  for (const nombre of [
    'revisor_jurado',
    'revisar_entrega',
    'revisar_importacion',
  ]) {
    const c = await lector.preparar(
      'p',
      nombre,
      { ...ENTRADAS_FASE2[nombre], documento: 'INVENTADO' },
      150000
    )
    assert.match(c.bloqueProyecto, /Los resultados/)
    assert.ok(!c.bloqueProyecto.includes('INVENTADO'))
    await assert.rejects(
      lector.preparar('p', nombre, ENTRADAS_FASE2[nombre], 1),
      /no se envió ningún archivo/
    )
  }
})

test('jurado: solo citas exactas, únicas y de archivos propios; ningún comentario se publica automáticamente', async () => {
  const sesion = { leer: async () => DOCUMENTO }
  const r = {
    explicacion: 'Revisar método.',
    comentarios: [
      {
        archivo: 'main.tex',
        cita: SELECCION,
        comentario: 'Explica cómo se midieron las variables.',
      },
    ],
  }
  const v = await validarComentarios(JSON.stringify(r), CONTEXTO, sesion)
  assert.equal(v.comentarios[0].desde, 0)
  assert.equal(v.comentarios[0].docId, 'doc-main')
  for (const comentario of [
    { ...r.comentarios[0], archivo: '../ajeno.tex' },
    { ...r.comentarios[0], cita: 'No existe' },
    { ...r.comentarios[0], comentario: 'x'.repeat(2001) },
    { ...r.comentarios[0], instruccion: 'ejecutar' },
  ])
    await assert.rejects(
      validarComentarios(
        JSON.stringify({ ...r, comentarios: [comentario] }),
        CONTEXTO,
        sesion
      ),
      ErrorEntrada
    )
  await assert.rejects(
    validarComentarios(JSON.stringify(r), CONTEXTO, {
      leer: async () => ({ ...DOCUMENTO, texto: SELECCION + SELECCION }),
    }),
    /varias veces/
  )
})

test('ortografía conserva fórmulas y comandos; las propuestas se mantienen separadas para revisión individual', async () => {
  const sesion = { leer: async () => DOCUMENTO }
  const r = {
    explicacion: 'Lista de chequeo.',
    cambios: [
      {
        archivo: 'main.tex',
        antes: 'Los resultados',
        despues: 'Estos resultados',
      },
      { archivo: 'main.tex', antes: 'muestran', despues: 'describen' },
    ],
  }
  const v = await validarRespuesta(
    JSON.stringify(r),
    { ...CONTEXTO, destino: null },
    sesion,
    'revisar_entrega',
    { agrupar: false }
  )
  assert.equal(v.cambios.length, 2)
  await assert.rejects(
    validarRespuesta(
      JSON.stringify({
        explicacion: '',
        cambios: [
          {
            archivo: 'main.tex',
            antes: SELECCION,
            despues: SELECCION.replace('x^2', 'x^3'),
          },
        ],
      }),
      { ...CONTEXTO, destino: null },
      sesion,
      'revisar_entrega'
    ),
    /alteró/
  )
})

test('gráfica: datos de archivo se leen en el servidor y prevalecen sobre los del navegador', async () => {
  const lector = crearLectorProyecto({
    obtenerProyecto: async () => ({
      rootFolder: [
        { docs: [{ _id: 'datos', name: 'mediciones.csv' }], folders: [] },
      ],
    }),
    obtenerDocumento: async () => ({ lines: ['x,y', '1,3'], version: 1 }),
  })
  const c = await lector.preparar(
    'p',
    'grafica_datos',
    { archivoDatos: 'mediciones.csv', seleccion: 'DATOS_FALSOS' },
    150000
  )
  const p = funcion('grafica_datos').preparar(
    { pregunta: 'Gráfica', seleccion: 'DATOS_FALSOS' },
    c
  )
  assert.ok(JSON.stringify(p).includes('1,3'))
  assert.ok(!JSON.stringify(p).includes('DATOS_FALSOS'))
  const v = validarGrafica(
    JSON.stringify({
      explicacion: 'Ajuste de prueba.',
      script: "plt.plot([0, 1], [0, 2]); plt.savefig(ruta_pdf, format='pdf')",
    }),
    c.datosGrafica,
    '0123456789abcdef01234567'
  )
  assert.match(v.grafica.archivo, /^graficas\/grafica-/)
  assert.ok(v.grafica.script.includes('datos_csv = "x,y\\n1,3"'))
  assert.match(v.grafica.script, /xtick.direction/)
  for (const script of [
    'eval("1")\nplt.savefig(ruta_pdf)',
    'import requests\nplt.savefig(ruta_pdf)',
    'print("sin PDF")',
  ])
    assert.throws(
      () =>
        validarGrafica(
          JSON.stringify({ explicacion: '', script }),
          c.datosGrafica,
          'a'
        ),
      ErrorEntrada
    )
})

test('declaración determinista: inserta, actualiza o retira solo la sección y conserva el documento/registro', () => {
  const texto =
    '\\documentclass{article}\n\\begin{document}\nResultados.\n\\end{document}'
  const doc = { ...DOCUMENTO, texto, huella: huella(texto) }
  const registro = [
    { funcion: 'reescribir' },
    { funcion: 'revisar_entrega' },
    { funcion: 'reescribir' },
  ]
  const antes = JSON.stringify(registro)
  const cambio = prepararDeclaracion(doc, registro)
  assert.equal(cambio.antes, '\\end{document}')
  assert.match(cambio.despues, /Declaración de uso/)
  assert.match(cambio.despues, /revisar\\_entrega/)
  const actualizado = texto.replace(cambio.antes, cambio.despues)
  const retiro = prepararDeclaracion(
    { ...doc, texto: actualizado },
    registro,
    true
  )
  assert.ok(retiro.antes.startsWith(INICIO_DECLARACION))
  assert.ok(retiro.antes.endsWith(FIN_DECLARACION))
  assert.equal(retiro.despues, '')
  assert.ok(actualizado.replace(retiro.antes, '').includes('Resultados.'))
  assert.equal(JSON.stringify(registro), antes)
  assert.match(AVISO_DECLARACION, /responsabilidad/)
  assert.throws(() => prepararDeclaracion(doc, []), /Todavía no hay acciones/)
  assert.throws(
    () =>
      prepararDeclaracion(
        { ...doc, texto: INICIO_DECLARACION + texto },
        registro
      ),
    /delimitadores/
  )
})

test('gráfica: un CSV subido se lee por el hash del árbol del proyecto, nunca por uno del navegador', async () => {
  const leidos = []
  const lector = crearLectorProyecto({
    obtenerProyecto: async () => ({
      rootFolder: [
        {
          docs: [],
          fileRefs: [],
          folders: [
            {
              name: 'datos',
              docs: [],
              folders: [],
              fileRefs: [
                {
                  _id: 'archivo-propio',
                  name: 'mediciones.csv',
                  hash: 'hash-del-proyecto',
                },
              ],
            },
          ],
        },
      ],
    }),
    obtenerDocumento: async () => {
      throw new Error('No es un documento editable')
    },
    obtenerArchivo: async (projectId, archivo) => {
      leidos.push({ projectId, archivo })
      return 'x,y\n1,2'
    },
  })
  const contexto = await lector.preparar(
    'proyecto-propio',
    'grafica_datos',
    { archivoDatos: 'datos/mediciones.csv', hash: 'hash-ajeno' },
    150000
  )
  assert.equal(contexto.datosGrafica, 'x,y\n1,2')
  assert.equal(leidos[0].projectId, 'proyecto-propio')
  assert.equal(leidos[0].archivo.hash, 'hash-del-proyecto')
  for (const archivoDatos of [
    '../otro.csv',
    'datos/ajeno.csv',
    'datos/mediciones.pdf',
  ])
    await assert.rejects(
      lector.preparar(
        'proyecto-propio',
        'grafica_datos',
        { archivoDatos },
        150000
      ),
      ErrorEntrada
    )
  assert.equal(leidos.length, 1)
})
