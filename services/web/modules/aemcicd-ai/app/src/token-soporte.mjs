import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

// Token propio del asistente de soporte. La plataforma (otro origen) lo obtiene con la sesión del
// estudiante y lo devuelve en X-Csrf-Token al consultar. A diferencia del token CSRF de Overleaf,
// solo sirve para POST /aemcicd-ai/soporte, del mismo usuario y durante 30 minutos: un XSS en la
// plataforma no podría usarlo para borrar proyectos ni añadir colaboradores en el editor.
const DURACION_MS = 30 * 60 * 1000
const PROPOSITO = 'aemcicd-ai-soporte-v1'

export function crearFirmador(secreto = randomBytes(32).toString('hex')) {
  const firmar = (userId, vence) =>
    createHmac('sha256', String(secreto))
      .update(`${PROPOSITO}:${userId}:${vence}`)
      .digest('base64url')
  return {
    crear(userId, ahora = Date.now()) {
      const vence = ahora + DURACION_MS
      return `${vence}.${firmar(String(userId), vence)}`
    },
    valido(userId, token, ahora = Date.now()) {
      if (typeof token !== 'string' || token.length > 200) return false
      const [vence, firma] = token.split('.')
      if (!/^\d{13}$/.test(vence || '') || Number(vence) < ahora) return false
      const esperado = Buffer.from(firmar(String(userId), Number(vence)))
      const recibido = Buffer.from(firma || '')
      return (
        esperado.length === recibido.length &&
        timingSafeEqual(esperado, recibido)
      )
    },
  }
}
