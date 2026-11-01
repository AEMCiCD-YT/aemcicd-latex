import { test } from 'node:test'
import assert from 'node:assert/strict'
import { streamText } from 'ai'
import { crearFabrica } from '../../app/src/proveedores.mjs'
import { funcion } from '../../app/src/funciones.mjs'
import { ENTRADAS, CONTEXTO, PNG } from './casos-fase1.mjs'

// Captura la petición HTTP que el SDK enviaría a cada API, sin red.
async function peticion(
  proveedor,
  modelo,
  providerOptions = { openai: { store: false } },
  nombre = 'pregunta',
  entrada = { pregunta: 'hola', seleccion: '\\section{A}' }
) {
  let capturada
  const fetch = async (url, init) => {
    capturada = {
      url: String(url),
      headers: new Headers(init.headers),
      body: JSON.parse(init.body),
    }
    return new Response('{"error":{"message":"prueba"}}', { status: 400 })
  }
  const crear = crearFabrica(
    { anthropic: 'clave-a', openai: 'clave-o' },
    { fetch }
  )
  const { sistema, mensajes } = funcion(nombre).preparar(entrada, CONTEXTO)
  const r = streamText({
    model: crear({ proveedor, modelo }),
    system: sistema,
    messages: mensajes,
    maxOutputTokens: 321,
    maxRetries: 0,
    onError: () => {},
    providerOptions,
  })
  for await (const _ of r.fullStream) {
    // consumir
  }
  return capturada
}

test('OpenAI: API Responses, modelo, límite de salida y store=false', async () => {
  const p = await peticion('openai', 'gpt-6-luna')
  assert.equal(p.url, 'https://api.openai.com/v1/responses')
  assert.equal(p.headers.get('authorization'), 'Bearer clave-o')
  assert.equal(p.body.model, 'gpt-6-luna')
  assert.equal(p.body.max_output_tokens, 321)
  assert.equal(p.body.store, false)
  assert.ok(JSON.stringify(p.body.input).includes('<seleccion>'))
})

test('Anthropic: Messages, modelo y límite de salida; ignora opciones de OpenAI', async () => {
  const p = await peticion('anthropic', 'claude-haiku-5-5')
  assert.equal(p.url, 'https://api.anthropic.com/v1/messages')
  assert.equal(p.headers.get('x-api-key'), 'clave-a')
  assert.equal(p.body.model, 'claude-haiku-5-5')
  assert.equal(p.body.max_tokens, 321)
  assert.equal(p.body.store, undefined)
  assert.ok(JSON.stringify(p.body.system).includes('asistente de LaTeX'))
})

test('esfuerzo de razonamiento en la petición de cada API', async () => {
  const o = await peticion('openai', 'gpt-6.1-terra', {
    openai: { store: false, reasoningEffort: 'low', forceReasoning: true },
  })
  assert.equal(o.body.reasoning.effort, 'low')
  assert.equal(o.body.store, false)
  const a = await peticion('anthropic', 'claude-haiku-5-5', {
    anthropic: { effort: 'low' },
  })
  assert.equal(a.body.output_config.effort, 'low')
})

test('visión: Sonnet y Sol reciben la imagen real mediante sus API HTTP, sin red', async () => {
  const a = await peticion(
    'anthropic',
    'claude-sonnet-5-5',
    { anthropic: { effort: 'medium' } },
    'foto_latex',
    ENTRADAS.foto_latex
  )
  const imagenA = a.body.messages
    .flatMap(m => m.content)
    .find(p => p.type === 'image')
  assert.equal(imagenA.source.media_type, 'image/png')
  assert.equal(imagenA.source.data, PNG)
  const o = await peticion(
    'openai',
    'gpt-6.1-sol',
    {
      openai: { store: false, reasoningEffort: 'medium', forceReasoning: true },
    },
    'foto_latex',
    ENTRADAS.foto_latex
  )
  const imagenO = o.body.input
    .flatMap(m => m.content || [])
    .find(p => p.type === 'input_image')
  assert.equal(imagenO.image_url, 'data:image/png;base64,' + PNG)
  assert.equal(o.body.store, false)
})

test('caché de proyecto: Anthropic recibe cache_control en el bloque estable; OpenAI no recibe opciones de Claude', async () => {
  const a = await peticion(
    'anthropic',
    'claude-sonnet-5-5',
    {},
    'chat_proyecto',
    ENTRADAS.chat_proyecto
  )
  assert.deepEqual(a.body.messages[0].content[0].cache_control, {
    type: 'ephemeral',
  })
  assert.ok(a.body.messages[0].content[0].text.includes('<documento'))
  const o = await peticion(
    'openai',
    'gpt-6.1-terra',
    { openai: { store: false } },
    'chat_proyecto',
    ENTRADAS.chat_proyecto
  )
  assert.equal(JSON.stringify(o.body).includes('cache_control'), false)
})

test('propuestas: salida estructurada nativa en ambos API, sin herramienta forzada en Claude', async () => {
  const { Output, jsonSchema } = await import('ai')
  const { ESQUEMA_CAMBIOS } = await import('../../app/src/cambios.mjs')
  const salida = Output.object({
    schema: jsonSchema(ESQUEMA_CAMBIOS),
    name: 'propuesta_de_cambios',
  })
  async function cuerpo(proveedor, modelo, providerOptions) {
    let capturado
    const fetch = async (url, init) => {
      capturado = JSON.parse(init.body)
      return new Response('{"error":{"message":"prueba"}}', { status: 400 })
    }
    const crear = crearFabrica({ anthropic: 'a', openai: 'o' }, { fetch })
    const r = streamText({
      model: crear({ proveedor, modelo }),
      messages: [{ role: 'user', content: 'x' }],
      output: salida,
      maxRetries: 0,
      onError: () => {},
      providerOptions,
    })
    for await (const _ of r.fullStream) {
      // consumir
    }
    return capturado
  }
  const a = await cuerpo('anthropic', 'claude-sonnet-5-5', {
    anthropic: { structuredOutputMode: 'outputFormat', effort: 'medium' },
  })
  assert.equal(a.output_config.format.type, 'json_schema')
  assert.deepEqual(a.output_config.format.schema.required, [
    'explicacion',
    'cambios',
  ])
  assert.equal(a.output_config.effort, 'medium')
  assert.equal(
    a.tool_choice,
    undefined,
    'Claude 5.5 rechaza tool_choice forzado'
  )
  assert.equal(a.tools, undefined)
  const o = await cuerpo('openai', 'gpt-6.1-sol', {
    openai: { store: false, reasoningEffort: 'medium', forceReasoning: true },
  })
  assert.equal(o.text.format.type, 'json_schema')
  assert.equal(o.text.format.strict, true)
  assert.equal(o.text.format.schema.additionalProperties, false)
  assert.equal(o.reasoning.effort, 'medium')
})
