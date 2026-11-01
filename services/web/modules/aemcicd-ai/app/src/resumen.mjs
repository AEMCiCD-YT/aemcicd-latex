import { ciclo } from "./ciclos.mjs";
import { aUsd } from "./precios.mjs";

// Resumen agregado de uso de la IA en un mes calendario, para decisiones internas. Solo totales:
// no incluye identificadores de estudiantes ni contenido (política de datos, sección 9).
export async function resumenMensual(c, config, fecha = new Date()) {
  const { id, inicio, fin } = ciclo(fecha, 1);
  const rango = { fecha: { $gte: inicio, $lt: fin } };

  const porModelo = await c.eventos
    .aggregate([
      { $match: rango },
      {
        $group: {
          _id: {
            funcion: "$funcion",
            proveedor: "$proveedor",
            modelo: "$modelo",
          },
          consultas: { $sum: { $cond: [{ $eq: ["$estado", "ok"] }, 1, 0] } },
          errores: { $sum: { $cond: [{ $eq: ["$estado", "error"] }, 1, 0] } },
          alternativas: { $sum: { $cond: ["$alternativa", 1, 0] } },
          costoMicro: { $sum: "$costoMicro" },
          tokensEntrada: { $sum: "$tokensEntrada" },
          tokensSalida: { $sum: "$tokensSalida" },
          utiles: { $sum: { $cond: [{ $eq: ["$valoracion", 1] }, 1, 0] } },
          noUtiles: { $sum: { $cond: [{ $eq: ["$valoracion", -1] }, 1, 0] } },
        },
      },
      { $sort: { costoMicro: -1 } },
    ])
    .toArray();

  const [{ usuarios = 0 } = {}] = await c.eventos
    .aggregate([
      { $match: { ...rango, estado: "ok" } },
      { $group: { _id: "$userId" } },
      { $count: "usuarios" },
    ])
    .toArray();

  const agotaron = await c.creditos.countDocuments({
    ciclo: id,
    gastadoMicro: { $gte: Math.floor(config.creditoMensualMicro * 0.95) },
  });
  const activados = await c.usuarios.countDocuments({});

  const presupuestos = {};
  for (const proveedor of Object.keys(config.presupuestos)) {
    const p = config.presupuestos[proveedor];
    const cicloProveedor = ciclo(fecha, p.diaInicio);
    const doc = await c.presupuestos.findOne({
      _id: `${proveedor}:${cicloProveedor.id}`,
    });
    presupuestos[proveedor] = {
      ciclo: cicloProveedor.id,
      gastado: aUsd(doc?.gastadoMicro ?? 0),
      tope: aUsd(p.topeMicro),
      agotado: Boolean(doc?.avisado),
    };
  }

  const filas = porModelo.map((f) => ({
    ...f._id,
    consultas: f.consultas,
    errores: f.errores,
    alternativas: f.alternativas,
    costo: aUsd(f.costoMicro),
    tokensEntrada: f.tokensEntrada,
    tokensSalida: f.tokensSalida,
    utiles: f.utiles,
    noUtiles: f.noUtiles,
  }));
  const totalCosto = filas.reduce((s, f) => s + f.costo, 0);
  const totalConsultas = filas.reduce((s, f) => s + f.consultas, 0);
  return {
    mes: id,
    estudiantesConIaActivada: activados,
    estudiantesQueUsaron: usuarios,
    estudiantesQueAgotaron: agotaron,
    consultas: totalConsultas,
    costo: Math.round(totalCosto * 10000) / 10000,
    costoPorEstudiante: usuarios
      ? Math.round((totalCosto / usuarios) * 10000) / 10000
      : 0,
    presupuestos,
    porFuncionYModelo: filas,
  };
}
