import { getJSON, postJSON } from '@/infrastructure/fetch-json'
import getMeta from '@/utils/meta'

export type Saldo = {
  credito: number
  gastado: number
  disponible: number
  renuevaEl: string
}

export type EstadoIA = {
  habilitada: boolean
  activada: boolean
  saldo: Saldo | null
  versionAviso: string
}

export type FinConsulta = {
  tipo: 'fin'
  eventoId: string
  proveedor: 'anthropic' | 'openai'
  modelo: string
  costo: number
  saldo: Saldo
}

export type ErrorConsulta = { tipo: 'error'; codigo: string; mensaje: string }

export function leerEstado() {
  return getJSON<EstadoIA>('/aemcicd-ai/estado')
}

export function activar(aviso: string) {
  return postJSON('/aemcicd-ai/activar', { body: { aviso } })
}

export function valorar(eventoId: string, valoracion: 1 | -1 | null) {
  return postJSON(`/aemcicd-ai/eventos/${eventoId}/valoracion`, {
    body: { valoracion },
  })
}

export function registrar(projectId: string, eventoId: string, detalle = '') {
  return postJSON(`/project/${projectId}/aemcicd-ai/registro`, {
    body: { eventoId, detalle },
  })
}

// La respuesta llega en NDJSON: una línea por trozo de texto y una final de cierre o error.
export async function consultar(
  projectId: string,
  cuerpo: { funcion: string; entrada: unknown; preferir?: 'alternativa' },
  alTexto: (texto: string) => void,
  senal: AbortSignal
): Promise<FinConsulta | ErrorConsulta> {
  const res = await fetch(`/project/${projectId}/aemcicd-ai/consulta`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/x-ndjson',
      'X-Csrf-Token': getMeta('ol-csrfToken'),
    },
    body: JSON.stringify(cuerpo),
    signal: senal,
  })
  if (res.status === 429) {
    return {
      tipo: 'error',
      codigo: 'limite',
      mensaje: 'Demasiadas consultas seguidas. Espera un minuto.',
    }
  }
  if (!res.ok || !res.body) {
    return {
      tipo: 'error',
      codigo: 'interno',
      mensaje: 'Algo falló. Inténtalo de nuevo.',
    }
  }
  const lector = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let pendiente = ''
  let final: FinConsulta | ErrorConsulta | null = null
  for (;;) {
    const { value, done } = await lector.read()
    if (done) break
    pendiente += value
    let i
    while ((i = pendiente.indexOf('\n')) >= 0) {
      const linea = pendiente.slice(0, i)
      pendiente = pendiente.slice(i + 1)
      if (!linea) continue
      const obj = JSON.parse(linea)
      if (obj.tipo === 'texto') alTexto(obj.texto)
      else final = obj
    }
  }
  return (
    final ?? {
      tipo: 'error',
      codigo: 'interno',
      mensaje: 'La respuesta se cortó. Inténtalo de nuevo.',
    }
  )
}
