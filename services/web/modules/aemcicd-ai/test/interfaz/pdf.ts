import * as PDFJS from 'pdfjs-dist'
PDFJS.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs'
export { PDFJS }
