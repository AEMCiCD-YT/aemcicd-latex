import { CONTEXTO } from './casos-fase1.mjs'
export const ENTRADAS_FASE3 = {
  bibliografia_verificada: {
    pregunta: 'Busca sobre la estructura del ADN.',
    dois: ['10.1038/171737a0'],
    archivoBib: 'referencias.bib',
  },
  citas_faltantes: {
    pregunta: 'Revisa las afirmaciones que necesitan una fuente.',
  },
  chat_pdf: {
    pregunta: '¿Qué método describe este artículo?',
    pdfs: ['articulos/estudio.pdf'],
  },
  tutor_latex: {
    pregunta: 'Explícame cómo funcionan las referencias cruzadas.',
  },
  resumen_cambios: {
    pregunta: 'Resume el intervalo.',
    desdeVersion: 1,
    hastaVersion: 3,
  },
  revision_equipo: { pregunta: 'Revisa contradicciones entre capítulos.' },
  beamer: { pregunta: 'Crea una presentación del informe.' },
  poster: { pregunta: 'Crea un póster del informe.' },
  coherencia_notacion: { pregunta: 'Revisa el uso de t y las unidades.' },
  codigo_algoritmo: {
    pregunta: 'Convierte la selección a pseudocódigo.',
    seleccion: CONTEXTO.destino.seleccion,
  },
}
export const CONTEXTO_FASE3 = {
  ...CONTEXTO,
  bloquePdf:
    '<pagina_pdf ruta="articulos/estudio.pdf" numero="1">\nPDF_NO_PERSISTIR: método de prueba.\n</pagina_pdf>',
  bloqueHistorial:
    '<historial>HISTORIAL_NO_PERSISTIR: cambió una definición.</historial>',
  referencias: [
    {
      doi: '10.1038/171737a0',
      titulo: 'TITULO_NO_PERSISTIR',
      clave: 'adn',
      bibtex: '@article{adn,title={TITULO_NO_PERSISTIR}}',
    },
  ],
  archivoBib: 'referencias.bib',
}
