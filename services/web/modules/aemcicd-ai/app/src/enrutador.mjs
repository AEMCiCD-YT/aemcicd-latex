// Devuelve, en orden de preferencia, los modelos que pueden atender un nivel: primero el asignado,
// después la alternativa. Descarta proveedores sin clave o marcados como no disponibles
// (presupuesto agotado o caídos); el llamador prueba la lista en orden.
export function candidatos(nivel, config, { excluir = [], preferir } = {}) {
  const opciones = config.rutas[nivel];
  if (!opciones) throw new Error(`nivel desconocido: ${nivel}`);
  let lista = opciones.filter(
    (o) =>
      config.proveedores.includes(o.proveedor) &&
      !excluir.includes(o.proveedor),
  );
  // «Probar con otro modelo»: la alternativa pasa primero.
  if (preferir === "alternativa" && lista.length > 1)
    lista = [...lista.slice(1), lista[0]];
  return lista;
}
