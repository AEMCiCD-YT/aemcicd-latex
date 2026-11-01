import { test } from "node:test";
import assert from "node:assert/strict";
import { ciclo } from "../../app/src/ciclos.mjs";
import { leerConfig, RUTAS_POR_DEFECTO } from "../../app/src/config.mjs";
import { candidatos } from "../../app/src/enrutador.mjs";
import {
  costoMaximo,
  costoReal,
  salidaQueCabe,
  aMicro,
} from "../../app/src/precios.mjs";

test("ciclo mensual calendario en hora de Ecuador", () => {
  // 1 de diciembre 03:00 UTC = 30 de noviembre 22:00 en Ecuador.
  const c = ciclo(new Date("2026-12-01T03:00:00Z"), 1);
  assert.equal(c.id, "2026-11");
  assert.equal(c.inicio.toISOString(), "2026-11-01T05:00:00.000Z");
  assert.equal(c.fin.toISOString(), "2026-12-01T05:00:00.000Z");
});

test("ciclo de OpenAI del 6 al 6, con cambio de año", () => {
  assert.equal(ciclo(new Date("2026-11-05T12:00:00Z"), 6).id, "2026-10");
  assert.equal(ciclo(new Date("2026-11-06T12:00:00Z"), 6).id, "2026-11");
  const enero = ciclo(new Date("2027-01-03T12:00:00Z"), 6);
  assert.equal(enero.id, "2026-12");
  assert.equal(enero.fin.toISOString(), "2027-01-06T05:00:00.000Z");
});

test("costo real con caché y cota superior", () => {
  // Sonnet: 10 000 de entrada (4 000 de caché) y 1 000 de salida.
  const real = costoReal("claude-sonnet-5-5", {
    inputTokens: 10000,
    inputTokenDetails: {
      noCacheTokens: 6000,
      cacheReadTokens: 4000,
      cacheWriteTokens: 0,
    },
    outputTokens: 1000,
  });
  // 6000*2 + 4000*0.2 + 1000*10 = 22 800 / 1e6 USD = 0.0228 USD
  assert.equal(real, 22800);
  assert.ok(costoMaximo("claude-sonnet-5-5", 10000, 1000) >= real);
});

test("salida que cabe en el saldo", () => {
  // Luna: 1 000 de entrada = $0.0001; con $0.0006 quedan $0.0005 → 1 000 tokens de salida.
  assert.equal(salidaQueCabe("gpt-6-luna", 1000, 600), 1000);
  assert.equal(salidaQueCabe("gpt-6-luna", 1000, 50), 0);
});

test("configuración: deshabilitada sin claves; topes y rutas por defecto", () => {
  assert.equal(leerConfig({ AEMCICD_AI_ENABLED: "true" }).habilitada, false);
  const c = leerConfig({ AEMCICD_AI_ENABLED: "true", OPENAI_API_KEY: "x" });
  assert.equal(c.habilitada, true);
  assert.deepEqual(c.proveedores, ["openai"]);
  assert.equal(c.creditoMensualMicro, aMicro(1));
  assert.equal(c.presupuestos.openai.diaInicio, 6);
  assert.deepEqual(c.rutas, RUTAS_POR_DEFECTO);
  assert.throws(() =>
    leerConfig({
      AEMCICD_AI_ROUTES: '{"rapido":[{"proveedor":"x","modelo":"y"}]}',
    }),
  );
  assert.throws(() => leerConfig({ AEMCICD_AI_BUDGET_OPENAI_USD: "-1" }));
});

test("enrutador: sin clave de un proveedor queda solo el otro; «probar con otro modelo»", () => {
  const solo = leerConfig({
    AEMCICD_AI_ENABLED: "true",
    ANTHROPIC_API_KEY: "x",
  });
  assert.deepEqual(
    candidatos("rapido", solo).map((c) => c.modelo),
    ["claude-haiku-5-5"],
  );
  const ambos = leerConfig({
    AEMCICD_AI_ENABLED: "true",
    ANTHROPIC_API_KEY: "x",
    OPENAI_API_KEY: "y",
  });
  assert.deepEqual(
    candidatos("rapido", ambos).map((c) => c.modelo),
    ["gpt-6-luna", "claude-haiku-5-5"],
  );
  assert.deepEqual(
    candidatos("rapido", ambos, { preferir: "alternativa" }).map(
      (c) => c.modelo,
    ),
    ["claude-haiku-5-5", "gpt-6-luna"],
  );
});
