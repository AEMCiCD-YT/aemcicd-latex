// Precios de lista por millón de tokens (USD), noviembre de 2026.
// Fuentes: claude.com/pricing y developers.openai.com/api/docs/pricing.
// Se pueden reemplazar con AEMCICD_AI_PRICES (JSON con la misma forma) sin cambiar código.
//
// entrada: tokens sin caché; cacheLectura: tokens leídos de la caché;
// cacheEscritura: tokens escritos en la caché (Anthropic cobra 1,25 × entrada; OpenAI no cobra);
// salida: tokens generados (incluye razonamiento).
export const PRECIOS_POR_DEFECTO = {
  "claude-haiku-5-5": {
    entrada: 0.1,
    cacheLectura: 0.01,
    cacheEscritura: 0.125,
    salida: 0.5,
  },
  "claude-sonnet-5-5": {
    entrada: 2,
    cacheLectura: 0.2,
    cacheEscritura: 2.5,
    salida: 10,
  },
  "gpt-6-luna": {
    entrada: 0.1,
    cacheLectura: 0.01,
    cacheEscritura: 0.1,
    salida: 0.5,
  },
  "gpt-6.1-terra": {
    entrada: 1,
    cacheLectura: 0.05,
    cacheEscritura: 1,
    salida: 5,
  },
  "gpt-6.1-sol": {
    entrada: 2,
    cacheLectura: 0.1,
    cacheEscritura: 2,
    salida: 10,
  },
};

// Los importes se guardan en micro-dólares enteros (1 USD = 1 000 000) para evitar redondeos.
export const MICRO = 1_000_000;

export function aMicro(usd) {
  return Math.round(usd * MICRO);
}

export function aUsd(micro) {
  return micro / MICRO;
}

function precioDe(modelo, precios) {
  const precio = precios[modelo];
  if (!precio) throw new Error(`sin precio para el modelo ${modelo}`);
  return precio;
}

// Un precio de $p por millón de tokens equivale a p micro-dólares por token: los cálculos se hacen
// en micro-dólares para evitar errores de coma flotante.

// Costo real de una respuesta, a partir del uso que devuelve el SDK (LanguageModelUsage).
// Se redondea hacia arriba: nunca se cobra de menos.
export function costoReal(modelo, uso, precios = PRECIOS_POR_DEFECTO) {
  const p = precioDe(modelo, precios);
  const total = uso?.inputTokens ?? 0;
  const lectura = uso?.inputTokenDetails?.cacheReadTokens ?? 0;
  const escritura = uso?.inputTokenDetails?.cacheWriteTokens ?? 0;
  const sinCache =
    uso?.inputTokenDetails?.noCacheTokens ??
    Math.max(0, total - lectura - escritura);
  const salida = uso?.outputTokens ?? 0;
  const micro =
    sinCache * p.entrada +
    lectura * p.cacheLectura +
    escritura * p.cacheEscritura +
    salida * p.salida;
  return Math.ceil(micro - 1e-6);
}

// Cota superior del costo antes de llamar al API: toda la entrada al precio más caro (sin caché o
// escrita en caché) y la salida completa hasta maxSalida.
export function costoMaximo(
  modelo,
  tokensEntrada,
  maxSalida,
  precios = PRECIOS_POR_DEFECTO,
) {
  const p = precioDe(modelo, precios);
  return Math.ceil(
    tokensEntrada * Math.max(p.entrada, p.cacheEscritura) +
      maxSalida * p.salida -
      1e-6,
  );
}

// Máximo de tokens de salida que caben en un saldo dado, para no rechazar consultas pequeñas.
export function salidaQueCabe(
  modelo,
  tokensEntrada,
  saldoMicro,
  precios = PRECIOS_POR_DEFECTO,
) {
  const p = precioDe(modelo, precios);
  const restante =
    saldoMicro - tokensEntrada * Math.max(p.entrada, p.cacheEscritura);
  if (restante <= 0) return 0;
  return Math.floor(restante / p.salida + 1e-6);
}

// Estimación conservadora de tokens a partir de caracteres (LaTeX y español: ~3-4 caracteres por
// token; se usa 2,5 para quedar por encima). La reserva se ajusta luego con el uso real.
export function estimarTokens(texto) {
  return Math.ceil((texto?.length ?? 0) / 2.5);
}
