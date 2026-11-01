import { randomUUID } from "node:crypto";

// Saldos con reservas atómicas en Mongo. Se usa para el crédito de cada estudiante y para el
// presupuesto de cada proveedor. Documento:
//   { _id, gastadoMicro, reservas: [{ id, montoMicro, en }], ...datos }
// Una consulta reserva su costo máximo antes de llamar al API y lo cambia por el costo real al
// terminar. Así, dos pestañas a la vez no pueden pasar del tope. Las reservas que un fallo dejó
// abiertas caducan a los RESERVA_MAX_MS.
export const RESERVA_MAX_MS = 15 * 60 * 1000;

const sumaReservas = { $sum: { $ifNull: ["$reservas.montoMicro", []] } };

async function asegurar(coleccion, id, datos) {
  await coleccion.updateOne(
    { _id: id },
    { $setOnInsert: { gastadoMicro: 0, reservas: [], ...datos } },
    { upsert: true },
  );
}

// Reserva `montoMicro` si gastado + reservas + monto <= topeMicro. Devuelve el id de la reserva o
// null si no alcanza.
export async function reservar(
  coleccion,
  id,
  montoMicro,
  topeMicro,
  { datos = {}, ahora = new Date() } = {},
) {
  await asegurar(coleccion, id, datos);
  await coleccion.updateOne(
    { _id: id },
    {
      $pull: {
        reservas: { en: { $lt: new Date(ahora.getTime() - RESERVA_MAX_MS) } },
      },
    },
  );
  const reservaId = randomUUID();
  const { matchedCount } = await coleccion.updateOne(
    {
      _id: id,
      $expr: {
        $lte: [
          { $add: ["$gastadoMicro", sumaReservas, montoMicro] },
          topeMicro,
        ],
      },
    },
    { $push: { reservas: { id: reservaId, montoMicro, en: ahora } } },
  );
  return matchedCount === 1 ? reservaId : null;
}

// Cierra la reserva y suma el costo real (puede ser 0 si la consulta falló antes de responder).
export async function liquidar(coleccion, id, reservaId, realMicro) {
  await coleccion.updateOne(
    { _id: id },
    {
      $pull: { reservas: { id: reservaId } },
      $inc: { gastadoMicro: realMicro },
    },
  );
}

export async function liberar(coleccion, id, reservaId) {
  await liquidar(coleccion, id, reservaId, 0);
}

// Gastado y reservado (reservas vigentes) de un saldo.
export async function leer(coleccion, id, { ahora = new Date() } = {}) {
  const doc = await coleccion.findOne({ _id: id });
  if (!doc) return { gastadoMicro: 0, reservadoMicro: 0 };
  const limite = ahora.getTime() - RESERVA_MAX_MS;
  const reservadoMicro = (doc.reservas || [])
    .filter((r) => r.en.getTime() >= limite)
    .reduce((s, r) => s + r.montoMicro, 0);
  return { gastadoMicro: doc.gastadoMicro, reservadoMicro, doc };
}
