// Prueba científica con un script fijo revisado. No ejecuta código recibido de un modelo.
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { validarGrafica } from '../../app/src/fase2.mjs'
const carpeta = await mkdtemp(join(tmpdir(), 'aemcicd-grafica-'))
try {
  const { grafica } = validarGrafica(
    JSON.stringify({
      explicacion: 'Recta sintética y PDF vectorial.',
      script: `import io, json
import numpy as np
from scipy.optimize import curve_fit
d = np.genfromtxt(io.StringIO(datos_csv), delimiter=',', names=True)
x, y = d['x'], d['y']
def recta(x, m, b):
    return m*x+b
p, cov = curve_fit(recta, x, y)
r2 = 1 - np.sum((y-recta(x,*p))**2)/np.sum((y-np.mean(y))**2)
plt.scatter(x, y, label='Datos')
plt.plot(x, recta(x,*p), label='Ajuste')
plt.xlabel('Tiempo (s)')
plt.ylabel('Distancia (m)')
plt.legend()
plt.savefig(ruta_pdf, format='pdf', bbox_inches='tight')
print(json.dumps({'pendiente': float(p[0]), 'intercepto': float(p[1]), 'r2': float(r2)}))`,
    }),
    'x,y\n0,1\n1,3\n2,5\n3,7',
    '000000000000000000000001'
  )
  await mkdir(join(carpeta, 'graficas'))
  await writeFile(join(carpeta, grafica.archivo), grafica.script)
  const resultado = JSON.parse(
    execFileSync(process.env.PYTHON || 'python3', [grafica.archivo], {
      cwd: carpeta,
      env: { ...process.env, MPLCONFIGDIR: join(carpeta, 'mpl') },
      encoding: 'utf8',
    })
  )
  assert.ok(Math.abs(resultado.pendiente - 2) < 1e-9)
  assert.ok(Math.abs(resultado.intercepto - 1) < 1e-9)
  assert.ok(Math.abs(resultado.r2 - 1) < 1e-9)
  const pdf = await readFile(
    join(carpeta, grafica.archivo.replace(/\.py$/, '.pdf'))
  )
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-')
  assert.ok(pdf.length > 1000)
  console.log(
    'Python local: datos originales, ajuste SciPy (m=2, b=1, R²=1) y PDF vectorial Matplotlib: correctos. No verifica Pyodide ni la subida a Overleaf.'
  )
} finally {
  await rm(carpeta, { recursive: true, force: true })
}
