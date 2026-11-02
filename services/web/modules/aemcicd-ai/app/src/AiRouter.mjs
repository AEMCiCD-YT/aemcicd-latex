import logger from '@overleaf/logger'
import AuthenticationController from '../../../../app/src/Features/Authentication/AuthenticationController.mjs'
import AuthorizationMiddleware from '../../../../app/src/Features/Authorization/AuthorizationMiddleware.mjs'
import RateLimiterMiddleware from '../../../../app/src/Features/Security/RateLimiterMiddleware.mjs'
import { RateLimiter } from '../../../../app/src/infrastructure/RateLimiter.mjs'
import AiController from './AiController.mjs'
import SessionManager from '../../../../app/src/Features/Authentication/SessionManager.mjs'

// Además del crédito mensual, un límite por minuto evita ráfagas (scripts, doble clic).
const limiteConsultas = new RateLimiter('aemcicd-ai-consulta', {
  points: 12,
  duration: 60,
})
const limiteGeneral = new RateLimiter('aemcicd-ai-general', {
  points: 120,
  duration: 60,
})

export default {
  apply(webRouter) {
    logger.debug({}, 'Init aemcicd-ai router')
    const login = AuthenticationController.requireLogin()
    const general = RateLimiterMiddleware.rateLimit(limiteGeneral)
    const sesionJson = (req, res, next) =>
      SessionManager.getLoggedInUserId(req.session)
        ? next()
        : res.status(401).json({
            mensaje:
              'Inicia sesión en el servidor LaTeX para usar el soporte con tu crédito.',
          })
    const leer = [
      login,
      AuthorizationMiddleware.blockRestrictedUserFromProject,
      AuthorizationMiddleware.ensureUserCanReadProject,
    ]
    const escribir = [
      login,
      AuthorizationMiddleware.blockRestrictedUserFromProject,
      AuthorizationMiddleware.ensureUserCanWriteProjectContent,
    ]

    webRouter.get('/aemcicd-ai/estado', login, general, AiController.estado)
    webRouter.get(
      '/aemcicd-ai/soporte/sesion',
      sesionJson,
      login,
      general,
      AiController.soporteSesion
    )
    webRouter.post(
      '/aemcicd-ai/soporte',
      sesionJson,
      login,
      RateLimiterMiddleware.rateLimit(limiteConsultas),
      AiController.soporte
    )
    webRouter.get(
      '/aemcicd-ai/resumen',
      sesionJson,
      login,
      general,
      AiController.resumen
    )
    webRouter.post('/aemcicd-ai/activar', login, general, AiController.activar)
    webRouter.post(
      '/aemcicd-ai/eventos/:eventoId/valoracion',
      login,
      general,
      AiController.valorar
    )

    // Quien puede leer el proyecto puede preguntar; aplicar cambios exige poder escribir.
    webRouter.post(
      '/project/:Project_id/aemcicd-ai/consulta',
      ...leer,
      RateLimiterMiddleware.rateLimit(limiteConsultas),
      AiController.consultar
    )
    webRouter.post(
      '/project/:Project_id/aemcicd-ai/foto',
      ...leer,
      RateLimiterMiddleware.rateLimit(limiteConsultas),
      AiController.consultar
    )
    webRouter.post(
      '/project/:Project_id/aemcicd-ai/estimacion',
      ...leer,
      general,
      AiController.estimar
    )
    webRouter.get(
      '/project/:Project_id/aemcicd-ai/instrucciones',
      ...leer,
      general,
      AiController.instrucciones
    )
    webRouter.post(
      '/project/:Project_id/aemcicd-ai/instrucciones',
      ...escribir,
      general,
      AiController.crearInstrucciones
    )
    webRouter.post(
      '/project/:Project_id/aemcicd-ai/validar-cambio',
      ...escribir,
      general,
      AiController.validarCambio
    )
    webRouter.post(
      '/project/:Project_id/aemcicd-ai/declaracion',
      ...escribir,
      general,
      AiController.declaracion
    )
    webRouter.post(
      '/project/:Project_id/aemcicd-ai/validar-comentario',
      ...escribir,
      general,
      AiController.validarComentario
    )
    webRouter.post(
      '/project/:Project_id/aemcicd-ai/grafica',
      ...escribir,
      general,
      AiController.guardarScript
    )
    webRouter.get(
      '/project/:Project_id/aemcicd-ai/registro',
      ...leer,
      general,
      AiController.verRegistro
    )
    webRouter.post(
      '/project/:Project_id/aemcicd-ai/registro',
      ...escribir,
      general,
      AiController.registrar
    )
    webRouter.delete(
      '/project/:Project_id/aemcicd-ai/registro',
      ...escribir,
      general,
      AiController.vaciarRegistro
    )
  },
}
