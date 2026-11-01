import { PRECIOS_POR_DEFECTO, aMicro } from './precios.mjs'

// Asignación inicial de la sección 5 del diseño (aemcicd/docs/ia-diseno.md). Cada nivel tiene un
// modelo principal y una alternativa en el otro proveedor. Se reemplaza con AEMCICD_AI_ROUTES.
//
// `esfuerzo` es el razonamiento previo del modelo (se cobra como salida aunque no se vea):
// reasoningEffort en OpenAI y effort en Claude. Claude Haiku 5.5 y Sonnet 5.5 razonan por defecto
// (medium y high), así que se fija explícitamente.
//
// Evaluación del 1 de noviembre de 2026 (aemcicd/ia-eval, 20 casos): GPT-6 Luna dio una corrección
// que no compila y Claude Haiku 5.5 afirmó algo falso sobre paquetes; GPT-6.1 Terra no tuvo errores
// a $0,0016 por consulta. Por eso Terra atiende también el nivel rápido.
export const RUTAS_POR_DEFECTO = {
  rapido: [
    { proveedor: 'openai', modelo: 'gpt-6.1-terra', esfuerzo: 'low' },
    { proveedor: 'anthropic', modelo: 'claude-haiku-5-5', esfuerzo: 'low' },
  ],
  proyecto: [
    { proveedor: 'openai', modelo: 'gpt-6.1-terra', esfuerzo: 'medium' },
    { proveedor: 'anthropic', modelo: 'claude-sonnet-5-5', esfuerzo: 'medium' },
  ],
  escritura: [
    { proveedor: 'anthropic', modelo: 'claude-sonnet-5-5', esfuerzo: 'medium' },
    { proveedor: 'openai', modelo: 'gpt-6.1-sol', esfuerzo: 'medium' },
  ],
}

export const ESFUERZOS = ['low', 'medium', 'high']

// Opciones del AI SDK para el esfuerzo de razonamiento de cada proveedor.
export function opcionesDeEsfuerzo({ proveedor, esfuerzo }) {
  if (!esfuerzo) return {}
  return proveedor === 'openai'
    ? // El SDK solo reconoce como modelos de razonamiento a o1-o4 y gpt-5*; con GPT-6 descartaría
      // reasoningEffort sin avisar.
      { openai: { reasoningEffort: esfuerzo, forceReasoning: true } }
    : { anthropic: { effort: esfuerzo } }
}

function json(texto, nombre) {
  if (!texto) return undefined
  try {
    return JSON.parse(texto)
  } catch {
    throw new Error(`${nombre} no es JSON válido`)
  }
}

function numero(texto, porDefecto, nombre) {
  if (texto == null || texto === '') return porDefecto
  const n = Number(texto)
  if (!Number.isFinite(n) || n < 0)
    throw new Error(`${nombre} debe ser un número positivo`)
  return n
}

// Lee la configuración desde las variables de entorno del contenedor.
export function leerConfig(env = process.env) {
  const claves = {
    anthropic: env.ANTHROPIC_API_KEY || '',
    openai: env.OPENAI_API_KEY || '',
  }
  const proveedores = Object.keys(claves).filter(p => claves[p])
  const config = {
    habilitada: env.AEMCICD_AI_ENABLED === 'true' && proveedores.length > 0,
    // Solo los administradores del servidor ven y usan la IA: para probarla en producción antes
    // de abrirla a los estudiantes.
    soloAdmins: env.AEMCICD_AI_ONLY_ADMINS === 'true',
    maxTokensProyecto: numero(
      env.AEMCICD_AI_MAX_PROJECT_TOKENS,
      150000,
      'AEMCICD_AI_MAX_PROJECT_TOKENS'
    ),
    claves,
    proveedores,
    creditoMensualMicro: aMicro(
      numero(
        env.AEMCICD_AI_MONTHLY_CREDIT_USD,
        1,
        'AEMCICD_AI_MONTHLY_CREDIT_USD'
      )
    ),
    presupuestos: {
      anthropic: {
        topeMicro: aMicro(
          numero(
            env.AEMCICD_AI_BUDGET_CLAUDE_USD,
            450,
            'AEMCICD_AI_BUDGET_CLAUDE_USD'
          )
        ),
        diaInicio: numero(
          env.AEMCICD_AI_CYCLE_DAY_CLAUDE,
          1,
          'AEMCICD_AI_CYCLE_DAY_CLAUDE'
        ),
      },
      openai: {
        topeMicro: aMicro(
          numero(
            env.AEMCICD_AI_BUDGET_OPENAI_USD,
            340,
            'AEMCICD_AI_BUDGET_OPENAI_USD'
          )
        ),
        diaInicio: numero(
          env.AEMCICD_AI_CYCLE_DAY_OPENAI,
          6,
          'AEMCICD_AI_CYCLE_DAY_OPENAI'
        ),
      },
    },
    rutas:
      json(env.AEMCICD_AI_ROUTES, 'AEMCICD_AI_ROUTES') ?? RUTAS_POR_DEFECTO,
    precios: {
      ...PRECIOS_POR_DEFECTO,
      ...(json(env.AEMCICD_AI_PRICES, 'AEMCICD_AI_PRICES') ?? {}),
    },
    // Correo de la directiva para avisos de presupuesto (opcional).
    correoAvisos: env.AEMCICD_AI_ALERT_EMAIL || '',
  }
  for (const [nivel, opciones] of Object.entries(config.rutas)) {
    if (!Array.isArray(opciones) || opciones.length === 0) {
      throw new Error(`AEMCICD_AI_ROUTES: el nivel ${nivel} no tiene modelos`)
    }
    for (const { proveedor, modelo, esfuerzo } of opciones) {
      if (esfuerzo != null && !ESFUERZOS.includes(esfuerzo)) {
        throw new Error(
          `AEMCICD_AI_ROUTES: esfuerzo no válido ${esfuerzo} (low, medium o high)`
        )
      }
      if (!['anthropic', 'openai'].includes(proveedor)) {
        throw new Error(`AEMCICD_AI_ROUTES: proveedor desconocido ${proveedor}`)
      }
      if (!config.precios[modelo]) {
        throw new Error(
          `AEMCICD_AI_ROUTES: sin precio para ${modelo} (añadirlo en AEMCICD_AI_PRICES)`
        )
      }
    }
  }
  for (const p of Object.values(config.presupuestos)) {
    if (!Number.isInteger(p.diaInicio) || p.diaInicio < 1 || p.diaInicio > 28) {
      throw new Error('el día de inicio de ciclo debe estar entre 1 y 28')
    }
  }
  return config
}
