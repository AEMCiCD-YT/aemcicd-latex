import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  crearLectorProyecto,
  normalizarErrores,
  normalizarHistorial,
  MAX_ARCHIVO_ABIERTO,
} from '../../app/src/proyecto.mjs'
import { funcion, ErrorEntrada } from '../../app/src/funciones.mjs'
import { validarRespuesta } from '../../app/src/cambios.mjs'

const MAIN = [
  '\\documentclass{article}',
  '\\usepackage{tikz}',
  '\\begin{document}',
  'Introducción.',
  '\\input{cap1}',
  '\\end{document}',
].join('\n')
const CAP1 = Array.from({ length: 30 }, (_, i) =>
  i === 9 ? '\\draw (0,0) -- (1,1) node[above] {A};' : `Línea ${i + 1}.`
).join('\n')

function lector(textos) {
  const nombres = Object.keys(textos)
  return crearLectorProyecto({
    obtenerProyecto: async () => ({
      rootDoc_id: '0',
      rootFolder: [
        {
          docs: nombres.map((n, i) => ({ _id: String(i), name: n })),
          folders: [],
        },
      ],
    }),
    obtenerDocumento: async (_, id) => ({
      lines: textos[nombres[Number(id)]].split('\n'),
      version: 1,
    }),
  })
}

test('agente: ve el archivo abierto completo, el cursor, la selección, la lista y el preámbulo', async () => {
  const l = lector({ 'main.tex': MAIN, 'cap1.tex': CAP1 })
  const cursor = CAP1.indexOf('Línea 20')
  const ctx = await l.preparar(
    'p',
    'agente',
    {
      pregunta: 'No compila, arréglalo',
      archivo: 'cap1.tex',
      cursor,
      desde: 0,
      hasta: 7,
      errores: [
        {
          nivel: 'error',
          mensaje: 'Undefined control sequence',
          archivo: './cap1.tex',
          linea: 10,
        },
      ],
      historial: [
        { rol: 'estudiante', texto: 'Haz un diagrama' },
        { rol: 'asistente', texto: 'Listo, inserté un diagrama.' },
      ],
    },
    150000
  )
  assert.deepEqual(ctx.archivos, ['cap1.tex', 'main.tex'])
  assert.equal(ctx.abierto, 'cap1.tex')
  assert.equal(ctx.cursor.linea, 20)
  assert.equal(ctx.seleccionAgente.texto, 'Línea 1')
  assert.equal(ctx.errores[0].archivo, 'cap1.tex')
  assert.ok(ctx.vistas.some(v => v.ruta === 'cap1.tex' && v.completo))
  // El capítulo no tiene preámbulo: se añade el del documento principal.
  assert.ok(
    ctx.vistas.some(
      v => v.ruta === 'main.tex' && v.texto.includes('\\usepackage{tikz}')
    )
  )
  const p = funcion('agente').preparar(
    { pregunta: 'No compila, arréglalo' },
    ctx
  )
  assert.equal(p.mensajes.length, 3)
  assert.deepEqual(
    p.mensajes.slice(0, 2).map(m => m.role),
    ['user', 'assistant']
  )
  const ultimo = p.mensajes[2].content
  for (const esperado of [
    '<archivos_del_proyecto>',
    '<documento ruta="cap1.tex">',
    '<log>',
    'cursor está en la línea 20',
    '<seleccion ruta="cap1.tex">',
    'No compila, arréglalo',
  ])
    assert.ok(ultimo.includes(esperado), esperado)
  assert.equal(p.nivel, undefined)
})

test('agente: archivo grande se envía alrededor del cursor; todo el proyecto exige confirmación', async () => {
  const grande = Array.from(
    { length: 4000 },
    (_, i) => `Línea larga número ${i + 1} con texto.`
  ).join('\n')
  assert.ok(grande.length > MAX_ARCHIVO_ABIERTO)
  const l = lector({ 'main.tex': MAIN, 'tesis.tex': grande })
  const ctx = await l.preparar(
    'p',
    'agente',
    {
      pregunta: 'x',
      archivo: 'tesis.tex',
      cursor: grande.indexOf('número 2000 '),
    },
    150000
  )
  const vista = ctx.vistas.find(v => v.ruta === 'tesis.tex')
  assert.equal(vista.completo, false)
  assert.ok(vista.texto.includes('número 2000 '))
  assert.ok(!vista.texto.includes('número 10 '))
  const proyecto = await l.preparar(
    'p',
    'agente',
    { pregunta: 'x', usarProyecto: true },
    150000
  )
  const p = funcion('agente').preparar({ pregunta: 'x' }, proyecto)
  assert.equal(p.nivel, 'proyecto')
  assert.equal(p.requiereConfirmacion, true)
})

test('agente: inserta en el cursor y solo cambia texto mostrado', async () => {
  const l = lector({ 'main.tex': MAIN, 'cap1.tex': CAP1 })
  const cursor = CAP1.indexOf('Línea 20')
  const ctx = await l.preparar(
    'p',
    'agente',
    { pregunta: 'x', archivo: 'cap1.tex', cursor },
    150000
  )
  const ses = await l.abrir('p')
  const r = await validarRespuesta(
    JSON.stringify({
      explicacion: 'Inserté un diagrama y cargué la librería.',
      cambios: [
        {
          archivo: 'cap1.tex',
          antes: '',
          despues: '\\begin{tikzpicture}\\end{tikzpicture}\n',
        },
        {
          archivo: 'main.tex',
          antes: '\\usepackage{tikz}',
          despues: '\\usepackage{tikz}\n\\usetikzlibrary{arrows.meta}',
        },
      ],
    }),
    ctx,
    ses,
    'agente'
  )
  const insercion = r.cambios.find(c => c.archivo === 'cap1.tex')
  assert.equal(insercion.desde, cursor)
  assert.equal(insercion.antes, '')
  // Fuera de lo mostrado: con un archivo grande, texto lejos del cursor no se puede cambiar.
  const grande =
    Array.from({ length: 4000 }, (_, i) => `Fila ${i + 1}.`).join('\n') +
    '\n'.repeat(1) +
    'x'.repeat(30000)
  const l2 = lector({ 'main.tex': MAIN, 'g.tex': grande })
  const ctx2 = await l2.preparar(
    'p',
    'agente',
    { pregunta: 'x', archivo: 'g.tex', cursor: grande.indexOf('Fila 3000.') },
    150000
  )
  await assert.rejects(
    validarRespuesta(
      JSON.stringify({
        explicacion: 'x',
        cambios: [
          { archivo: 'g.tex', antes: 'Fila 5.', despues: 'Fila cinco.' },
        ],
      }),
      ctx2,
      await l2.abrir('p'),
      'agente'
    ),
    /fuera de lo que se envió/
  )
  // Sin cursor no hay inserción.
  const sinCursor = await l.preparar(
    'p',
    'agente',
    { pregunta: 'x', archivo: 'cap1.tex' },
    150000
  )
  await assert.rejects(
    validarRespuesta(
      JSON.stringify({
        explicacion: 'x',
        cambios: [{ archivo: 'cap1.tex', antes: '', despues: 'x' }],
      }),
      sinCursor,
      ses,
      'agente'
    ),
    ErrorEntrada
  )
})

test('agente: errores e historial se normalizan y acotan', () => {
  const errores = normalizarErrores([
    {
      mensaje: 'x'.repeat(900),
      archivo: '../secreto',
      linea: -3,
      nivel: 'warning',
    },
    { mensaje: 'ok', archivo: './a/b.tex', linea: 4 },
    null,
    { archivo: 'sin mensaje' },
    ...Array.from({ length: 20 }, () => ({ mensaje: 'm' })),
  ])
  // Se descartan los inválidos y se toman como máximo 10.
  assert.equal(errores.length, 10)
  assert.equal(errores[0].mensaje.length, 500)
  assert.equal(errores[0].archivo, null)
  assert.equal(errores[0].linea, null)
  assert.equal(errores[0].nivel, 'advertencia')
  assert.equal(errores[1].archivo, 'a/b.tex')
  const h = normalizarHistorial([
    { rol: 'asistente', texto: 'empieza el asistente' },
    { rol: 'estudiante', texto: 'hola' },
    { rol: 'estudiante', texto: 'otra' },
    { rol: 'asistente', texto: 'respuesta' },
    { rol: 'raro', texto: '' },
  ])
  assert.deepEqual(
    h.map(t => t.role),
    ['user', 'assistant']
  )
  assert.equal(h[0].content, 'hola\n\notra')
})
