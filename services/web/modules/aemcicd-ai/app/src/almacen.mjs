// Colecciones del módulo en el Mongo de Overleaf. Ninguna guarda el texto de documentos ni de
// preguntas (política de datos, sección 9 del diseño).
export const NOMBRES = {
  usuarios: "aemcicdAiUsuarios", // activación de la IA por estudiante
  creditos: "aemcicdAiCreditos", // crédito mensual por estudiante
  presupuestos: "aemcicdAiPresupuestos", // presupuesto por proveedor y ciclo
  eventos: "aemcicdAiEventos", // medición: función, modelo, tokens, costo, 👍/👎
  registro: "aemcicdAiRegistro", // registro de uso de IA de cada proyecto
};

export function colecciones(db) {
  return Object.fromEntries(
    Object.entries(NOMBRES).map(([k, n]) => [k, db.collection(n)]),
  );
}

export async function crearIndices(c) {
  await Promise.all([
    c.eventos.createIndex({ fecha: 1 }),
    c.eventos.createIndex({ userId: 1, fecha: -1 }),
    c.registro.createIndex({ projectId: 1, fecha: -1 }),
    c.creditos.createIndex({ userId: 1, ciclo: 1 }),
  ]);
}
