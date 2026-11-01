import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { resolve, join } from 'node:path'
import { mkdir, writeFile, copyFile } from 'node:fs/promises'

const require = createRequire(
  resolve(process.env.AEMCICD_IA_DEPS || '.', 'package.json')
)
const { build } = require('esbuild')
const sass = require('sass')
const aqui = fileURLToPath(new URL('.', import.meta.url))
const modulo = resolve(aqui, '../..')
const salida = process.env.AEMCICD_IA_BANCO || '/tmp/aemcicd-ia-banco'
await mkdir(salida, { recursive: true })
const adaptadores = [
  'project-context',
  'permissions-context',
  'rail-context',
  'editor-manager-context',
  'editor-open-doc-context',
  'file-tree-path',
  'editor-properties-context',
  'codemirror-context',
  'loading-spinner',
  'fetch-json',
  'debugging',
  'load-mathjax',
]
const componentes = {
  'ol-button': 'Boton',
  'ol-icon-button': 'BotonIcono',
  'ol-tooltip': 'Tooltip',
  'material-icon': 'Icono',
  'rail-panel-header': 'Cabecera',
}
await build({
  entryPoints: [join(aqui, 'app.tsx')],
  bundle: true,
  outfile: join(salida, 'app.js'),
  format: 'esm',
  jsx: 'automatic',
  nodePaths: [resolve(process.env.AEMCICD_IA_DEPS || '.', 'node_modules')],
  plugins: [
    {
      name: 'adaptadores-overleaf',
      setup(b) {
        b.onResolve({ filter: /^@\// }, args => {
          const nombre = args.path.split('/').at(-1)
          if (nombre === 'meta') return { path: join(aqui, 'meta.ts') }
          if (nombre === 'pdf-js') return { path: join(aqui, 'pdf.ts') }
          if (nombre === 'error-boundary')
            return { path: 'limite', namespace: 'banco' }
          if (componentes[nombre])
            return { path: componentes[nombre], namespace: 'banco' }
          if (adaptadores.includes(nombre))
            return { path: join(aqui, 'adaptadores.tsx') }
          throw new Error(`Falta el adaptador ${args.path}`)
        })
        b.onLoad({ filter: /.*/, namespace: 'banco' }, args => ({
          contents:
            args.path === 'limite'
              ? 'export default x => x'
              : `export { ${args.path} as default } from ${JSON.stringify(join(aqui, 'adaptadores.tsx'))}`,
          loader: 'tsx',
          resolveDir: aqui,
        }))
        b.onLoad({ filter: /\.scss$/ }, () => ({ contents: '', loader: 'css' }))
      },
    },
  ],
})
await copyFile(
  require.resolve('pdfjs-dist/build/pdf.worker.mjs'),
  join(salida, 'pdf.worker.mjs')
)
await writeFile(
  join(salida, 'modulo.css'),
  sass.compile(join(modulo, 'frontend/stylesheets/aemcicd-ai.scss')).css
)
await writeFile(
  join(salida, 'index.html'),
  `<!doctype html><html lang="es"><meta charset="utf-8"><title>Banco aislado IA AEMCiCD</title><link rel="stylesheet" href="/modulo.css"><style>
:root{--bg-primary-themed:#fff;--bg-secondary-themed:#f3f4f6;--bg-tertiary-themed:#dedee4;--content-primary-themed:#252735;--content-secondary-themed:#5f6375;--border-primary-themed:#d5d7e0;--bg-accent-01:#8e2432;--content-danger:#ad2837;--font-size-01:11px;--font-size-02:13px;--font-size-03:16px;--border-radius-base:5px;--spacing-01:3px;--spacing-02:6px;--spacing-03:10px;--spacing-04:14px;--spacing-05:20px;--spacing-06:24px;--spacing-09:42px}
html.oscuro{--bg-primary-themed:#20232d;--bg-secondary-themed:#2c303d;--bg-tertiary-themed:#454b5d;--content-primary-themed:#e9ebf1;--content-secondary-themed:#b2b7c8;--border-primary-themed:#52596c;--content-danger:#ff9caa}
*{box-sizing:border-box}body{margin:0;background:var(--bg-primary-themed);color:var(--content-primary-themed);font:14px/1.45 system-ui}button,input,textarea{font:inherit}button{cursor:pointer;color:inherit;background:var(--bg-secondary-themed);border:1px solid var(--border-primary-themed);border-radius:5px;padding:6px 9px}button:disabled{opacity:.5;cursor:default}.primary{background:var(--bg-accent-01);color:white}.link{border:0;background:transparent;text-decoration:underline}textarea{width:100%;padding:8px;background:var(--bg-primary-themed);color:inherit;border:1px solid var(--border-primary-themed);border-radius:5px}h2{font-size:17px;margin:0 0 14px}p{margin:8px 0}.banco-cabecera{padding:14px 22px;border-bottom:1px solid var(--border-primary-themed);display:flex;justify-content:space-between}.banco-cabecera span{font-size:12px;color:var(--content-secondary-themed)}main{position:relative;padding:20px 440px 20px 24px;min-height:calc(100vh - 50px)}aside{position:absolute;right:0;top:0;width:410px;height:calc(100vh - 50px);border-left:1px solid var(--border-primary-themed);padding:15px 0}.banco-barra{display:flex;justify-content:space-between;margin-bottom:15px}.banco-editor{min-height:240px;border:1px solid var(--border-primary-themed);background:var(--bg-primary-themed)}.cm-editor{min-height:240px}.cm-content,.cm-gutters{color:var(--content-primary-themed);background:var(--bg-primary-themed)}.banco-menu{display:flex;gap:6px;align-items:center;padding:12px 0;height:60px}.editor-floating-menu-button{display:block;padding:6px 12px;border:1px solid var(--border-primary-themed);border-radius:5px}.banco-log{margin-top:24px;padding:16px;border:1px solid var(--border-primary-themed);border-radius:5px}.banco-log>div{display:flex;gap:18px;align-items:center;flex-wrap:wrap}.banco-log span{font-size:12px;color:var(--content-secondary-themed)}.aemcicd-ai-formulario .aemcicd-ai-acciones button{align-self:stretch;font-size:12px}.aemcicd-ai-modelo{padding-right:4px}.aemcicd-ai-turnos{min-height:180px}.aemcicd-ai-propuesta pre{font-size:12px}.aemcicd-ai-adjunto{font-size:13px}
</style><div id="app"></div><script>if(location.search.includes('oscuro'))document.documentElement.classList.add('oscuro')</script><script type="module" src="/app.js"></script></html>`
)
console.log(`Banco compilado en ${salida}`)
