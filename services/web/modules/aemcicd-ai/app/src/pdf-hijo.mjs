// Proceso hijo que extrae el texto de un PDF. Lo lanza pdf-proyecto.mjs con límites de memoria,
// CPU y tiempo: un PDF malicioso (por ejemplo, una bomba de descompresión) agota este proceso,
// no el servidor web. Lee el PDF por stdin y escribe una línea JSON por stdout.
import { textoDePdf } from './leer-pdf.mjs'
import { ErrorEntrada } from './entrada.mjs'

const partes = []
for await (const parte of process.stdin) partes.push(parte)
let salida
try {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  salida = { paginas: await textoDePdf(Buffer.concat(partes), getDocument) }
} catch (err) {
  salida = {
    error:
      err instanceof ErrorEntrada
        ? err.message
        : // Suele ser falta de memoria por el límite del proceso: PDF demasiado complejo.
          'No se pudo leer el PDF: es demasiado complejo, está cifrado o está dañado.',
  }
}
process.stdout.write(JSON.stringify(salida) + '\n', () => process.exit(0))
