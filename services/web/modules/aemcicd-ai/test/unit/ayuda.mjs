// Utilidades de prueba: Mongo real (MONGO_URL o mongodb-memory-server) y modelos simulados del
// AI SDK, para no gastar créditos.
import { MongoClient } from "mongodb";
import { MockLanguageModelV3 } from "ai/test";
import { simulateReadableStream } from "ai";

let servidor;
let cliente;

export async function conectar() {
  let url = process.env.MONGO_URL;
  if (!url) {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    servidor = await MongoMemoryServer.create({ binary: { version: "8.0.4" } });
    url = servidor.getUri();
  }
  cliente = await MongoClient.connect(url);
  return cliente.db(`aemcicd_ai_test_${process.pid}_${Date.now()}`);
}

export async function desconectar(db) {
  await db?.dropDatabase();
  await cliente?.close();
  await servidor?.stop();
}

export function uso(entrada, salida, cache = 0) {
  return {
    inputTokens: {
      total: entrada,
      noCache: entrada - cache,
      cacheRead: cache,
      cacheWrite: 0,
    },
    outputTokens: { total: salida, text: salida, reasoning: 0 },
  };
}

// Modelo que responde `trozos` y reporta el uso dado.
export function modeloQueResponde(trozos, usoFinal = uso(1000, 200)) {
  return new MockLanguageModelV3({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: "text-start", id: "t" },
          ...trozos.map((delta) => ({ type: "text-delta", id: "t", delta })),
          { type: "text-end", id: "t" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: "stop" },
            usage: usoFinal,
          },
        ],
      }),
    }),
  });
}

export function modeloQueFalla(mensaje = "sobrecargado") {
  return new MockLanguageModelV3({
    doStream: async () => {
      throw new Error(mensaje);
    },
  });
}
