import logger from "@overleaf/logger";
import AuthenticationController from "../../../../app/src/Features/Authentication/AuthenticationController.mjs";
import AuthorizationMiddleware from "../../../../app/src/Features/Authorization/AuthorizationMiddleware.mjs";
import RateLimiterMiddleware from "../../../../app/src/Features/Security/RateLimiterMiddleware.mjs";
import { RateLimiter } from "../../../../app/src/infrastructure/RateLimiter.mjs";
import AiController from "./AiController.mjs";

// Además del crédito mensual, un límite por minuto evita ráfagas (scripts, doble clic).
const limiteConsultas = new RateLimiter("aemcicd-ai-consulta", {
  points: 12,
  duration: 60,
});
const limiteGeneral = new RateLimiter("aemcicd-ai-general", {
  points: 120,
  duration: 60,
});

export default {
  apply(webRouter) {
    logger.debug({}, "Init aemcicd-ai router");
    const login = AuthenticationController.requireLogin();
    const general = RateLimiterMiddleware.rateLimit(limiteGeneral);
    const leer = [
      login,
      AuthorizationMiddleware.blockRestrictedUserFromProject,
      AuthorizationMiddleware.ensureUserCanReadProject,
    ];
    const escribir = [
      login,
      AuthorizationMiddleware.blockRestrictedUserFromProject,
      AuthorizationMiddleware.ensureUserCanWriteProjectContent,
    ];

    webRouter.get("/aemcicd-ai/estado", login, general, AiController.estado);
    webRouter.post("/aemcicd-ai/activar", login, general, AiController.activar);
    webRouter.post(
      "/aemcicd-ai/eventos/:eventoId/valoracion",
      login,
      general,
      AiController.valorar,
    );

    // Quien puede leer el proyecto puede preguntar; aplicar cambios exige poder escribir.
    webRouter.post(
      "/project/:Project_id/aemcicd-ai/consulta",
      ...leer,
      RateLimiterMiddleware.rateLimit(limiteConsultas),
      AiController.consultar,
    );
    webRouter.get(
      "/project/:Project_id/aemcicd-ai/registro",
      ...leer,
      general,
      AiController.verRegistro,
    );
    webRouter.post(
      "/project/:Project_id/aemcicd-ai/registro",
      ...escribir,
      general,
      AiController.registrar,
    );
    webRouter.delete(
      "/project/:Project_id/aemcicd-ai/registro",
      ...escribir,
      general,
      AiController.vaciarRegistro,
    );
  },
};
