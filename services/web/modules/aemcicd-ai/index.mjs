import logger from "@overleaf/logger";
import AiRouter from "./app/src/AiRouter.mjs";
import { contexto } from "./app/src/contexto.mjs";

// Asistente de IA de LaTeX AEMCiCD. Diseño: aemcicd/docs/ia-diseno.md.
// Se activa con AEMCICD_AI_ENABLED=true y al menos una clave (ANTHROPIC_API_KEY u OPENAI_API_KEY).
// Sin eso, las rutas existen pero responden que la IA no está disponible y el panel no aparece.
export default {
  router: AiRouter,
  hooks: {
    promises: {
      // El registro de uso de IA se borra junto con el proyecto.
      async projectExpired(projectId) {
        try {
          const { servicio } = await contexto();
          await servicio.vaciarRegistro(projectId);
        } catch (err) {
          logger.warn(
            { err, projectId },
            "aemcicd-ai: no se pudo borrar el registro del proyecto",
          );
        }
      },
    },
  },
  async start() {
    await contexto();
  },
};
