// Crédito por estudiante, topes y días de ciclo que fija la plataforma (Programa LaTeX →
// Configuración → Asistente de IA). El conector latex-sync los guarda en Mongo con
// scripts/ajustes.mjs y el módulo los relee cada minuto, sin reiniciar Overleaf. Mientras no
// existan, rigen las variables de entorno (personalizacion/variables.env).
import { aMicro } from './precios.mjs'

export const ID_AJUSTES = 'plataforma'
const MAX_USD = 100000

function usd(valor, nombre) {
  if (
    typeof valor !== 'number' ||
    !Number.isFinite(valor) ||
    valor < 0 ||
    valor > MAX_USD
  ) {
    throw new Error(`ajustes de IA: ${nombre} no es un monto válido`)
  }
  return valor
}

function dia(valor, nombre) {
  if (!Number.isInteger(valor) || valor < 1 || valor > 28) {
    throw new Error(`ajustes de IA: ${nombre} debe ser un día entre 1 y 28`)
  }
  return valor
}

/** Solo estos campos, con estos tipos. Nada de claves ni de texto libre. */
export function validarAjustes(entrada) {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) {
    throw new Error('ajustes de IA: formato no válido')
  }
  const { huella, creditoMensualUsd, topes, diasInicio } = entrada
  if (typeof huella !== 'string' || !/^[A-Za-z0-9|._:-]{1,200}$/.test(huella)) {
    throw new Error('ajustes de IA: huella no válida')
  }
  if (
    !topes ||
    typeof topes !== 'object' ||
    !diasInicio ||
    typeof diasInicio !== 'object'
  ) {
    throw new Error('ajustes de IA: faltan topes o días de inicio')
  }
  return {
    huella,
    creditoMensualUsd: usd(creditoMensualUsd, 'creditoMensualUsd'),
    topes: {
      anthropic: usd(topes.anthropic, 'topes.anthropic'),
      openai: usd(topes.openai, 'topes.openai'),
    },
    diasInicio: {
      anthropic: dia(diasInicio.anthropic, 'diasInicio.anthropic'),
      openai: dia(diasInicio.openai, 'diasInicio.openai'),
    },
  }
}

/**
 * Aplica los ajustes guardados sobre la configuración en uso. El servicio lee estos campos en
 * cada consulta, así que el cambio rige desde la siguiente. Un documento inválido se ignora.
 */
export function aplicarAjustes(config, doc) {
  if (!doc) return false
  let ajustes
  try {
    ajustes = validarAjustes(doc)
  } catch {
    return false
  }
  config.creditoMensualMicro = aMicro(ajustes.creditoMensualUsd)
  for (const proveedor of ['anthropic', 'openai']) {
    if (!config.presupuestos[proveedor]) continue
    config.presupuestos[proveedor].topeMicro = aMicro(ajustes.topes[proveedor])
    config.presupuestos[proveedor].diaInicio = ajustes.diasInicio[proveedor]
  }
  config.ajustesHuella = ajustes.huella
  return true
}

export async function leerAjustes(c) {
  return c.ajustes.findOne({ _id: ID_AJUSTES })
}

export async function guardarAjustes(c, entrada, fecha = new Date()) {
  const ajustes = validarAjustes(entrada)
  await c.ajustes.replaceOne(
    { _id: ID_AJUSTES },
    { _id: ID_AJUSTES, ...ajustes, actualizado: fecha },
    { upsert: true }
  )
  return ajustes
}
