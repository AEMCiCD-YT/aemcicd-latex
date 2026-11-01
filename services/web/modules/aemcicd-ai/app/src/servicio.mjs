import { ciclo } from "./ciclos.mjs";
import { candidatos } from "./enrutador.mjs";
import { funcion as definicion } from "./funciones.mjs";
import {
  costoMaximo,
  costoReal,
  estimarTokens,
  salidaQueCabe,
} from "./precios.mjs";
import * as saldos from "./saldos.mjs";

export class ErrorIA extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.codigo = codigo;
  }
}

const MENSAJES = {
  deshabilitada: "La IA no está disponible en este momento.",
  no_activada: "Activa la IA para usarla.",
  sin_saldo: "Ya usaste tu crédito de IA de este mes. Se renueva el día 1.",
  sin_presupuesto:
    "La IA del programa alcanzó su presupuesto de este ciclo. Vuelve a intentarlo en unos días.",
  no_disponible:
    "Los servicios de IA no responden. Inténtalo de nuevo en unos minutos.",
};

function error(codigo) {
  return new ErrorIA(codigo, MENSAJES[codigo]);
}

// Lógica del módulo, sin Express: la usan el controlador, los scripts y las pruebas.
// dependencias: { config, c (colecciones), crearModelo, streamText, ahora?, alAgotarPresupuesto? }
export function crearServicio({
  config,
  c,
  crearModelo,
  streamText,
  ahora = () => new Date(),
  alAgotarPresupuesto,
}) {
  const idCredito = (userId, fecha) => `${userId}:${ciclo(fecha, 1).id}`;
  const idPresupuesto = (proveedor, fecha) =>
    `${proveedor}:${ciclo(fecha, config.presupuestos[proveedor].diaInicio).id}`;

  async function activada(userId) {
    return Boolean(
      await c.usuarios.findOne({ _id: userId }, { projection: { _id: 1 } }),
    );
  }

  async function activar(userId, aviso) {
    await c.usuarios.updateOne(
      { _id: userId },
      { $setOnInsert: { activadoEn: ahora(), aviso } },
      { upsert: true },
    );
  }

  async function saldo(userId) {
    const fecha = ahora();
    const { gastadoMicro, reservadoMicro } = await saldos.leer(
      c.creditos,
      idCredito(userId, fecha),
      { ahora: fecha },
    );
    const { fin } = ciclo(fecha, 1);
    return {
      creditoMicro: config.creditoMensualMicro,
      gastadoMicro,
      disponibleMicro: Math.max(
        0,
        config.creditoMensualMicro - gastadoMicro - reservadoMicro,
      ),
      renuevaEl: fin,
    };
  }

  async function estado(userId) {
    return {
      habilitada: config.habilitada,
      activada: config.habilitada ? await activada(userId) : false,
      saldo: config.habilitada ? await saldo(userId) : null,
    };
  }

  async function registrarEvento(evento) {
    const { insertedId } = await c.eventos.insertOne({
      fecha: ahora(),
      valoracion: null,
      ...evento,
    });
    return insertedId;
  }

  // Ejecuta una función de IA. `alEscribir(texto)` recibe la respuesta en trozos.
  async function consultar({
    userId,
    funcion,
    entrada,
    preferir,
    alEscribir,
    senal,
  }) {
    if (!config.habilitada) throw error("deshabilitada");
    if (!(await activada(userId))) throw error("no_activada");
    const def = definicion(funcion);
    const { sistema, mensajes, opciones = {} } = def.preparar(entrada);
    const tokensEntrada =
      estimarTokens(sistema) + estimarTokens(JSON.stringify(mensajes));

    const fecha = ahora();
    const creditoId = idCredito(userId, fecha);
    const motivos = new Set();

    for (const cand of candidatos(def.nivel, config, { preferir })) {
      const { gastadoMicro, reservadoMicro } = await saldos.leer(
        c.creditos,
        creditoId,
        { ahora: fecha },
      );
      const disponible =
        config.creditoMensualMicro - gastadoMicro - reservadoMicro;
      const maxSalida = Math.min(
        def.maxSalida,
        salidaQueCabe(cand.modelo, tokensEntrada, disponible, config.precios),
      );
      if (maxSalida < def.minSalida) {
        motivos.add("sin_saldo");
        continue;
      }
      const maximo = costoMaximo(
        cand.modelo,
        tokensEntrada,
        maxSalida,
        config.precios,
      );
      const reservaCredito = await saldos.reservar(
        c.creditos,
        creditoId,
        maximo,
        config.creditoMensualMicro,
        {
          datos: { userId, ciclo: ciclo(fecha, 1).id },
          ahora: fecha,
        },
      );
      if (!reservaCredito) {
        motivos.add("sin_saldo");
        continue;
      }
      const presupuestoId = idPresupuesto(cand.proveedor, fecha);
      const reservaPresupuesto = await saldos.reservar(
        c.presupuestos,
        presupuestoId,
        maximo,
        config.presupuestos[cand.proveedor].topeMicro,
        { datos: { proveedor: cand.proveedor }, ahora: fecha },
      );
      if (!reservaPresupuesto) {
        await saldos.liberar(c.creditos, creditoId, reservaCredito);
        motivos.add("sin_presupuesto");
        await alAgotarPresupuesto?.(cand.proveedor, presupuestoId);
        continue;
      }

      let escrito = false;
      let costoMicro = 0;
      try {
        const resultado = streamText({
          model: crearModelo(cand),
          system: sistema,
          messages: mensajes,
          maxOutputTokens: maxSalida,
          maxRetries: 1,
          abortSignal: senal,
          // Los errores se tratan abajo (fullStream); sin esto el SDK los imprime en la consola.
          onError: () => {},
          providerOptions: {
            // Que OpenAI no guarde las respuestas en su plataforma (Responses API).
            openai: { store: false },
            ...opciones.providerOptions,
          },
        });
        let errorStream;
        for await (const parte of resultado.fullStream) {
          if (parte.type === "text-delta") {
            escrito = true;
            await alEscribir(parte.text);
          } else if (parte.type === "error") {
            errorStream = parte.error;
            break;
          }
        }
        if (errorStream) throw errorStream;
        const uso = await resultado.totalUsage;
        costoMicro = costoReal(cand.modelo, uso, config.precios);
        await saldos.liquidar(
          c.creditos,
          creditoId,
          reservaCredito,
          costoMicro,
        );
        await saldos.liquidar(
          c.presupuestos,
          presupuestoId,
          reservaPresupuesto,
          costoMicro,
        );
        const eventoId = await registrarEvento({
          userId,
          funcion,
          nivel: def.nivel,
          proveedor: cand.proveedor,
          modelo: cand.modelo,
          alternativa: preferir === "alternativa",
          tokensEntrada: uso.inputTokens ?? 0,
          tokensCache: uso.inputTokenDetails?.cacheReadTokens ?? 0,
          tokensSalida: uso.outputTokens ?? 0,
          costoMicro,
          estado: "ok",
        });
        return {
          eventoId,
          proveedor: cand.proveedor,
          modelo: cand.modelo,
          costoMicro,
          saldo: await saldo(userId),
        };
      } catch (err) {
        // Sin uso real conocido no se cobra al estudiante: el costo lo asume el programa.
        await saldos.liberar(c.creditos, creditoId, reservaCredito);
        await saldos.liberar(c.presupuestos, presupuestoId, reservaPresupuesto);
        const cancelada = senal?.aborted;
        await registrarEvento({
          userId,
          funcion,
          nivel: def.nivel,
          proveedor: cand.proveedor,
          modelo: cand.modelo,
          alternativa: preferir === "alternativa",
          costoMicro: 0,
          estado: cancelada ? "cancelada" : "error",
        });
        if (cancelada) throw err;
        // Si ya se mostró parte de la respuesta, no se mezcla con la de otro modelo.
        if (escrito) throw error("no_disponible");
        motivos.add("no_disponible");
      }
    }
    for (const codigo of ["no_disponible", "sin_presupuesto", "sin_saldo"]) {
      if (motivos.has(codigo)) throw error(codigo);
    }
    throw error("no_disponible");
  }

  async function valorar(userId, eventoId, valoracion) {
    if (![1, -1, null].includes(valoracion))
      throw new ErrorIA("entrada", "valoración no válida");
    const { matchedCount } = await c.eventos.updateOne(
      { _id: eventoId, userId, estado: "ok" },
      { $set: { valoracion } },
    );
    return matchedCount === 1;
  }

  // Registro de uso de IA del proyecto: lo ven el estudiante y sus colaboradores.
  async function registrar(projectId, userId, eventoId, detalle = "") {
    const evento = await c.eventos.findOne({
      _id: eventoId,
      userId,
      estado: "ok",
    });
    if (!evento) return false;
    const def = definicion(evento.funcion);
    const resumen = [def.resumen(), String(detalle).trim().slice(0, 120)]
      .filter(Boolean)
      .join(": ");
    await c.registro.updateOne(
      { projectId, eventoId },
      {
        $setOnInsert: {
          projectId,
          eventoId,
          userId,
          funcion: evento.funcion,
          resumen,
          fecha: ahora(),
        },
      },
      { upsert: true },
    );
    return true;
  }

  async function verRegistro(projectId) {
    return c.registro
      .find(
        { projectId },
        { projection: { _id: 0, userId: 1, funcion: 1, resumen: 1, fecha: 1 } },
      )
      .sort({ fecha: 1 })
      .limit(2000)
      .toArray();
  }

  async function vaciarRegistro(projectId) {
    await c.registro.deleteMany({ projectId });
  }

  return {
    estado,
    activar,
    saldo,
    consultar,
    valorar,
    registrar,
    verRegistro,
    vaciarRegistro,
    idPresupuesto,
  };
}
