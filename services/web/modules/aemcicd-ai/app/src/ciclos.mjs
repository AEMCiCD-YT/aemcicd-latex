// Ciclos de facturación. Se calculan en hora de Ecuador (UTC-5, sin horario de verano).
const DESFASE_MS = -5 * 60 * 60 * 1000

function partes(fecha) {
  const local = new Date(fecha.getTime() + DESFASE_MS)
  return {
    anio: local.getUTCFullYear(),
    mes: local.getUTCMonth(),
    dia: local.getUTCDate(),
  }
}

function inicioLocal(anio, mes, dia) {
  return new Date(Date.UTC(anio, mes, dia) - DESFASE_MS)
}

function dos(n) {
  return String(n).padStart(2, '0')
}

// Ciclo mensual que empieza el día `diaInicio` de cada mes (1 = mes calendario).
// Devuelve { id: 'AAAA-MM' (mes en que empieza), inicio, fin } con fin exclusivo.
export function ciclo(fecha = new Date(), diaInicio = 1) {
  let { anio, mes, dia } = partes(fecha)
  if (dia < diaInicio) {
    mes -= 1
    if (mes < 0) {
      mes = 11
      anio -= 1
    }
  }
  const inicio = inicioLocal(anio, mes, diaInicio)
  const fin = inicioLocal(
    mes === 11 ? anio + 1 : anio,
    (mes + 1) % 12,
    diaInicio
  )
  return { id: `${anio}-${dos(mes + 1)}`, inicio, fin }
}
