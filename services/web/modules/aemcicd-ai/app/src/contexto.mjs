import Settings from "@overleaf/settings";
import logger from "@overleaf/logger";
import { streamText } from "ai";
import { getCollectionInternal } from "../../../../app/src/infrastructure/mongodb.mjs";
import EmailSender from "../../../../app/src/Features/Email/EmailSender.mjs";
import { NOMBRES, crearIndices } from "./almacen.mjs";
import { leerConfig } from "./config.mjs";
import { crearFabrica } from "./proveedores.mjs";
import { crearServicio } from "./servicio.mjs";

// Construye el servicio una vez, con las colecciones de Mongo de Overleaf y la configuración del
// entorno. Si la configuración es inválida, la IA queda deshabilitada y se registra el error.
let promesa;

async function avisarPresupuesto(config, c, proveedor, presupuestoId) {
  // Un solo aviso por proveedor y ciclo.
  const { modifiedCount } = await c.presupuestos.updateOne(
    { _id: presupuestoId, avisado: { $ne: true } },
    { $set: { avisado: true } },
  );
  if (modifiedCount !== 1) return;
  logger.warn(
    { proveedor, presupuestoId },
    "aemcicd-ai: presupuesto del proveedor agotado",
  );
  if (!config.correoAvisos) return;
  const texto =
    `El presupuesto de IA con ${proveedor === "openai" ? "OpenAI" : "Claude"} llegó a su tope en ` +
    `el ciclo ${presupuestoId}. Las consultas pasan al otro proveedor; si ambos se agotan, la IA ` +
    "se pausa hasta que se renueve alguno. Los topes se cambian en latex-server/personalizacion.";
  try {
    await EmailSender.promises.sendEmail(
      {
        to: config.correoAvisos,
        subject: "LaTeX AEMCiCD: presupuesto de IA agotado",
        text: texto,
        html: `<p>${texto}</p>`,
      },
      "aemcicdAiPresupuesto",
    );
  } catch (err) {
    logger.warn(
      { err },
      "aemcicd-ai: no se pudo enviar el aviso de presupuesto",
    );
  }
}

async function construir() {
  let config;
  try {
    config = leerConfig(process.env);
  } catch (err) {
    logger.error(
      { err },
      "aemcicd-ai: configuración inválida, IA deshabilitada",
    );
    config = leerConfig({});
  }
  const entradas = await Promise.all(
    Object.entries(NOMBRES).map(async ([k, n]) => [
      k,
      await getCollectionInternal(n),
    ]),
  );
  const c = Object.fromEntries(entradas);
  await crearIndices(c);
  Settings.aemcicdAi = {
    enabled: config.habilitada,
    soloAdmins: config.soloAdmins,
  };
  logger.info(
    {
      habilitada: config.habilitada,
      soloAdmins: config.soloAdmins,
      proveedores: config.proveedores,
    },
    "aemcicd-ai: listo",
  );
  return {
    config,
    c,
    servicio: crearServicio({
      config,
      c,
      streamText,
      crearModelo: crearFabrica(config.claves),
      alAgotarPresupuesto: (proveedor, id) =>
        avisarPresupuesto(config, c, proveedor, id),
    }),
  };
}

export function contexto() {
  promesa ??= construir();
  return promesa;
}
