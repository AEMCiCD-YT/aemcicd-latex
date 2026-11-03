import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dato, escapar } from './datos.mjs'
import { ErrorEntrada } from './entrada.mjs'
import { textoDePdf } from './leer-pdf.mjs'

export const MAX_PDF_BYTES = 10 * 1024 * 1024

// Límites del proceso hijo. El tamaño del archivo no basta: un PDF de 200 KB puede descomprimirse
// a gigabytes. Por eso la extracción no corre en el proceso web (bloqueaba a todos los usuarios)
// sino en un hijo con memoria virtual, CPU y tiempo acotados, y con pocas extracciones a la vez.
export const LIMITES_PDF = {
  memoriaBytes: 1536 * 1024 * 1024,
  cpuSegundos: 20,
  tiempoMs: 25000,
  simultaneas: 2,
  enEspera: 4,
}

const HIJO = fileURLToPath(new URL('./pdf-hijo.mjs', import.meta.url))
const PRLIMIT = ['/usr/bin/prlimit', '/bin/prlimit'].find(p => existsSync(p))

let activas = 0
const cola = []

async function turno() {
  if (activas < LIMITES_PDF.simultaneas) {
    activas++
    return
  }
  if (cola.length >= LIMITES_PDF.enEspera)
    throw new ErrorEntrada(
      'Hay muchas lecturas de PDF en curso en el servidor. Inténtalo en un minuto.'
    )
  await new Promise(resolve => cola.push(resolve))
}

function liberar() {
  const siguiente = cola.shift()
  if (siguiente) siguiente()
  else activas--
}

export function extraerEnHijo(datos, limites = LIMITES_PDF) {
  return new Promise((resolve, reject) => {
    const args = PRLIMIT
      ? [
          PRLIMIT,
          `--as=${limites.memoriaBytes}`,
          `--cpu=${limites.cpuSegundos}`,
          '--',
          process.execPath,
          HIJO,
        ]
      : [process.execPath, HIJO]
    const hijo = spawn(args[0], args.slice(1), {
      stdio: ['pipe', 'pipe', 'ignore'],
      env: {
        // Solo lo necesario para resolver dependencias (PnP): nunca las claves de IA.
        PATH: process.env.PATH,
        NODE_OPTIONS: [
          process.env.NODE_OPTIONS || '',
          // El montón de V8 también se acota; la memoria externa la limita prlimit.
          '--max-old-space-size=768',
        ].join(' '),
      },
    })
    let salida = ''
    let terminado = false
    const fallar = mensaje => {
      if (terminado) return
      terminado = true
      hijo.kill('SIGKILL')
      reject(new ErrorEntrada(mensaje))
    }
    const reloj = setTimeout(
      () =>
        fallar(
          'El PDF tardó demasiado en leerse. Elige uno más pequeño o más simple.'
        ),
      limites.tiempoMs
    )
    hijo.stdout.on('data', d => {
      salida += d
      if (salida.length > 4 * 1024 * 1024)
        fallar('El PDF contiene demasiado texto. Elige uno más pequeño.')
    })
    hijo.on('error', () => fallar('No se pudo leer el PDF en el servidor.'))
    hijo.on('close', () => {
      clearTimeout(reloj)
      if (terminado) return
      terminado = true
      let r
      try {
        r = JSON.parse(salida)
      } catch {
        // Sin respuesta válida: el hijo murió por memoria o CPU.
        return reject(
          new ErrorEntrada(
            'No se pudo leer el PDF: es demasiado complejo o está dañado.'
          )
        )
      }
      if (r.error) reject(new ErrorEntrada(r.error))
      else resolve(r.paginas)
    })
    hijo.stdin.on('error', () => {})
    hijo.stdin.end(Buffer.from(datos))
  })
}

// `cargar` solo se pasa en pruebas: extrae en el mismo proceso con un pdfjs simulado.
export async function extraerPdf(datos, ruta, cargar) {
  if (
    !(datos instanceof Uint8Array) ||
    datos.length > MAX_PDF_BYTES ||
    !Buffer.from(datos.subarray(0, 5)).equals(Buffer.from('%PDF-'))
  )
    throw new ErrorEntrada('El archivo debe ser un PDF de hasta 10 MiB.')
  let paginas
  if (cargar) {
    paginas = await textoDePdf(datos, cargar)
  } else {
    await turno()
    try {
      paginas = await extraerEnHijo(datos)
    } finally {
      liberar()
    }
  }
  return paginas
    .map((texto, i) =>
      dato('pagina_pdf', texto, ` ruta="${escapar(ruta)}" numero="${i + 1}"`)
    )
    .join('\n\n')
}
