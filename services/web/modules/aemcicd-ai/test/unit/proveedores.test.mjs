import { test } from "node:test";
import assert from "node:assert/strict";
import { streamText } from "ai";
import { crearFabrica } from "../../app/src/proveedores.mjs";
import { funcion } from "../../app/src/funciones.mjs";

// Captura la petición HTTP que el SDK enviaría a cada API, sin red.
async function peticion(proveedor, modelo) {
  let capturada;
  const fetch = async (url, init) => {
    capturada = {
      url: String(url),
      headers: new Headers(init.headers),
      body: JSON.parse(init.body),
    };
    return new Response('{"error":{"message":"prueba"}}', { status: 400 });
  };
  const crear = crearFabrica(
    { anthropic: "clave-a", openai: "clave-o" },
    { fetch },
  );
  const { sistema, mensajes } = funcion("pregunta").preparar({
    pregunta: "hola",
    seleccion: "\\section{A}",
  });
  const r = streamText({
    model: crear({ proveedor, modelo }),
    system: sistema,
    messages: mensajes,
    maxOutputTokens: 321,
    maxRetries: 0,
    onError: () => {},
    providerOptions: { openai: { store: false } },
  });
  for await (const _ of r.fullStream) {
    // consumir
  }
  return capturada;
}

test("OpenAI: API Responses, modelo, límite de salida y store=false", async () => {
  const p = await peticion("openai", "gpt-6-luna");
  assert.equal(p.url, "https://api.openai.com/v1/responses");
  assert.equal(p.headers.get("authorization"), "Bearer clave-o");
  assert.equal(p.body.model, "gpt-6-luna");
  assert.equal(p.body.max_output_tokens, 321);
  assert.equal(p.body.store, false);
  assert.ok(JSON.stringify(p.body.input).includes("<seleccion>"));
});

test("Anthropic: Messages, modelo y límite de salida; ignora opciones de OpenAI", async () => {
  const p = await peticion("anthropic", "claude-haiku-5-5");
  assert.equal(p.url, "https://api.anthropic.com/v1/messages");
  assert.equal(p.headers.get("x-api-key"), "clave-a");
  assert.equal(p.body.model, "claude-haiku-5-5");
  assert.equal(p.body.max_tokens, 321);
  assert.equal(p.body.store, undefined);
  assert.ok(JSON.stringify(p.body.system).includes("asistente de LaTeX"));
});
