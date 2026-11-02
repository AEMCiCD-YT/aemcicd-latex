// Puntos de partida editables del programa, no formatos oficiales de una carrera o revista.
function informe(titulo, secciones) {
  return `\\documentclass[11pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage[spanish]{babel}
\\usepackage{amsmath,amssymb,graphicx,booktabs}
\\usepackage[margin=2.5cm]{geometry}
\\title{${titulo}}
\\author{Tu nombre}
\\date{}
\\begin{document}
\\maketitle
${secciones.map(s => `\\section{${s}}\n% Completa esta sección con tu trabajo y fuentes verificadas.\n`).join('\n')}
\\end{document}
`
}
export const PLANTILLAS = [
  {
    id: 'aemcicd',
    nombre: 'AEMCiCD: informe académico',
    contenido: informe('Título de tu informe', [
      'Introducción',
      'Objetivos',
      'Desarrollo',
      'Resultados',
      'Conclusiones',
      'Referencias',
    ]),
  },
  {
    id: 'matematica',
    nombre: 'Matemática: demostraciones',
    contenido: informe('Trabajo de matemática', [
      'Definiciones y notación',
      'Enunciados',
      'Demostraciones',
      'Ejemplos',
      'Conclusiones',
      'Referencias',
    ]),
  },
  {
    id: 'computacion',
    nombre: 'Computación: algoritmos',
    contenido: informe('Informe de computación', [
      'Problema',
      'Método y algoritmo',
      'Implementación',
      'Evaluación reproducible',
      'Limitaciones',
      'Referencias',
    ]),
  },
  ...['Física', 'Química', 'Biología'].map((area, i) => ({
    id: ['fisica', 'quimica', 'biologia'][i],
    nombre: `${area}: laboratorio`,
    contenido: informe(`Informe de laboratorio de ${area.toLowerCase()}`, [
      'Objetivos',
      'Fundamento teórico',
      'Materiales y método',
      'Resultados e incertidumbres',
      'Discusión',
      'Conclusiones',
      'Referencias',
    ]),
  })),
]
export function plantilla(id) {
  return PLANTILLAS.find(p => p.id === id)
}
