import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'

// Fábrica de modelos del AI SDK a partir de las claves de la configuración. Las claves solo viven
// en el servidor (variables del contenedor) y nunca se envían al navegador.
// Direcciones fijas: el SDK también lee ANTHROPIC_BASE_URL y OPENAI_BASE_URL del entorno, y una
// variable olvidada podría enviar las consultas (y la clave) a otro servidor.
const URL_ANTHROPIC = 'https://api.anthropic.com/v1'
const URL_OPENAI = 'https://api.openai.com/v1'

// `fetch` solo se pasa en las pruebas, para ver las peticiones sin llamar a los API.
export function crearFabrica(claves, { fetch } = {}) {
  const clientes = {}
  if (claves.anthropic)
    clientes.anthropic = createAnthropic({
      apiKey: claves.anthropic,
      baseURL: URL_ANTHROPIC,
      fetch,
    })
  if (claves.openai)
    clientes.openai = createOpenAI({
      apiKey: claves.openai,
      baseURL: URL_OPENAI,
      fetch,
    })
  return ({ proveedor, modelo }) => {
    const cliente = clientes[proveedor]
    if (!cliente) throw new Error(`proveedor sin clave: ${proveedor}`)
    return cliente(modelo)
  }
}
