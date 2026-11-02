// Fixtures públicas y sintéticas; Python solo crea el ZIP con su biblioteca estándar.
import { execFileSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
const objetos = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 400] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
]
const flujo =
  'BT /F1 12 Tf 30 300 Td (Synthetic phase three method with five measurements.) Tj ET'
objetos.push(`<< /Length ${flujo.length} >>\nstream\n${flujo}\nendstream`)
let pdf = '%PDF-1.4\n'
const posiciones = []
objetos.forEach((obj, i) => {
  posiciones.push(pdf.length)
  pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`
})
const xref = pdf.length
pdf +=
  `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n` +
  posiciones.map(p => `${String(p).padStart(10, '0')} 00000 n \n`).join('') +
  `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
await writeFile('/tmp/ia-fase3-estudio.pdf', pdf)
execFileSync(
  'python3',
  [
    '-c',
    `import zipfile,json,sys
archivos=json.load(sys.stdin)
with zipfile.ZipFile('/tmp/ia-fase3-proyecto.zip','w',zipfile.ZIP_DEFLATED) as z:
 for nombre,texto in archivos.items(): z.writestr(nombre,texto)
`,
  ],
  {
    input: JSON.stringify({
      'main.tex':
        '\\documentclass{article}\n\\begin{document}\nPrueba de contexto nativo.\n\\end{document}\n',
      'referencias.bib': '% Referencias de prueba.\n',
      'articulos/estudio.pdf': pdf,
    }),
  }
)
console.log(
  'Fixtures creadas en /tmp/ia-fase3-proyecto.zip y /tmp/ia-fase3-estudio.pdf; sin datos personales.'
)
