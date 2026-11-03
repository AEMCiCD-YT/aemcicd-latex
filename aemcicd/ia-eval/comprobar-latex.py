"""Compila exclusivamente respuestas sintéticas en el contenedor aislado del evaluador."""
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

BASE = Path(__file__).resolve().parent
SALIDA = Path(sys.argv[1]).resolve()
CONTENEDOR = 'aemcicd-ia-eval-tex'
RAIZ = BASE / 'resultados/entorno/compilaciones'
if os.environ.get('EVAL_SOLO_PREPARAR') != 'true':
    redes = json.loads(subprocess.check_output(['docker', 'inspect', CONTENEDOR, '--format', '{{json .NetworkSettings.Networks}}'], text=True))
    if redes:
        raise SystemExit('Desconecta la red del contenedor antes de compilar respuestas.')
casos = {c['id']: c for c in json.loads((BASE / 'casos.json').read_text())}
respuestas = {}
for linea in (SALIDA / 'respuestas.jsonl').read_text().splitlines():
    r = json.loads(linea)
    respuestas[r['clave']] = r
paquete = re.compile(r'\\usepackage(?:\[[^\]]*\])?\{[^}]+\}')
bloque = re.compile(r'```(?:latex|tex)\s*\n([\s\S]*?)```')
tareas = []


def pdf_de_prueba():
    objetos = [b'<< /Type /Catalog /Pages 2 0 R >>',
               b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
               b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] /Contents 4 0 R >>',
               b'<< /Length 0 >>\nstream\nendstream']
    salida = b'%PDF-1.4\n'
    posiciones = []
    for i, obj in enumerate(objetos, 1):
        posiciones.append(len(salida))
        salida += str(i).encode() + b' 0 obj\n' + obj + b'\nendobj\n'
    xref = len(salida)
    salida += b'xref\n0 5\n0000000000 65535 f \n'
    salida += b''.join(f'{n:010} 00000 n \n'.encode() for n in posiciones)
    salida += f'trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode()
    return salida


def archivos_seguros(archivos, carpeta):
    for nombre, texto in archivos.items():
        ruta = Path(nombre)
        if ruta.is_absolute() or '..' in ruta.parts:
            raise ValueError('Ruta no permitida en un fixture de evaluación.')
        destino = carpeta / ruta
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_text(texto)


def preparar(r):
    if r.get('error') or r.get('validacion', {}).get('ok') is False:
        return
    c = casos[r['casoId']]
    documentos = dict(c.get('archivos', {}))
    v = r.get('validacion', {}).get('respuesta', {})
    fuentes = []
    if 'documento' in v:
        documentos['main.tex'] = v['documento']['contenido']
        fuentes.append(('documento', documentos, ''))
    elif v.get('cambios') and r['funcion'] != 'bibliografia_verificada':
        por_archivo = {}
        for cambio in v['cambios']:
            por_archivo.setdefault(cambio['archivo'], []).append(cambio)
        for nombre, cambios in por_archivo.items():
            texto = documentos[nombre]
            for cambio in sorted(cambios, key=lambda x: x['desde'], reverse=True):
                assert texto[cambio['desde']:cambio['hasta']] == cambio['antes']
                texto = texto[:cambio['desde']] + cambio['despues'] + texto[cambio['hasta']:]
            documentos[nombre] = texto
        fuentes.append(('propuesta', documentos, v.get('explicacion', '')))
    elif not r.get('validacion'):
        for i, contenido in enumerate(bloque.findall(r['texto'])):
            if contenido.lstrip().startswith('@'):
                continue
            if '\\usepackage' in contenido and '\\documentclass' not in contenido and not re.search(r'\\(?:begin|qty|SI|si|num)\b|\\\[', contenido):
                continue
            if not '\\begin{document}' in contenido:
                # No se intenta compilar como documento un bloque solo de configuración.
                resto = paquete.sub('', contenido)
                resto = re.sub(r'\\(?:sisetup|addbibresource)\{[^}]*\}', '', resto)
                resto = re.sub(r'%[^\n]*', '', resto).strip()
                if not resto or resto.startswith('\\bibliographystyle'):
                    continue
            d = dict(documentos)
            d['main.tex'] = contenido
            entradas = re.findall(r'```bibtex\s*\n([\s\S]*?)```', r['texto'])
            nombres = re.findall(r'\\addbibresource\{([^}]+)\}', contenido)
            if entradas and nombres:
                d[nombres[0]] = entradas[0]
            configuracion = '\n'.join(b for b in bloque.findall(r['texto']) if '\\documentclass' in b or ('\\usepackage' in b and not re.search(r'\\(?:begin|qty|SI|si|num)\b|\\\[', b)))
            fuentes.append((f'ejemplo-{i+1}', d, configuracion))
    for indice, (tipo, docs, explicacion) in enumerate(fuentes):
        if 'main.tex' not in docs:
            continue
        texto = docs['main.tex']
        envoltura = '\\documentclass' not in texto
        if envoltura:
            declaraciones = list(dict.fromkeys(paquete.findall(explicacion)))
            if 'hyperref' in c.get('entrada', {}).get('mensaje', ''):
                declaraciones.append('\\usepackage{hyperref}')
            # El preámbulo de prueba usa solo los paquetes que la propia respuesta declara.
            texto = '\\documentclass{article}\n' + '\n'.join(declaraciones) + '\n\\begin{document}\n' + texto + '\n\\end{document}\n'
        docs = {**docs, 'main.tex': texto}
        carpeta = RAIZ / (r['casoId'] + '-' + r['posicion'] + '-' + str(indice))
        carpeta.mkdir(parents=True, exist_ok=True)
        archivos_seguros(docs, carpeta)
        recursos = []
        if not r.get('validacion'):
            # Los ejemplos didácticos de figuras usan sustitutos identificados, no datos reales.
            for nombre in re.findall(r'\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}', texto):
                if Path(nombre).name == nombre and not (carpeta / nombre).exists():
                    destino = carpeta / (nombre if Path(nombre).suffix else nombre + '.pdf')
                    destino.write_bytes(pdf_de_prueba())
                    recursos.append(nombre)
        tareas.append({'clave': r['clave'], 'casoId': r['casoId'], 'posicion': r['posicion'],
                       'tipo': tipo, 'envoltura': envoltura, 'recursos_de_prueba': recursos,
                       'carpeta': str(carpeta.relative_to(RAIZ)),
                       'delimitador_sobreescapado': bool(re.search(r'(?<!\\)\\\\[()]', texto))})


def compilar(tarea):
    carpeta = RAIZ / tarea['carpeta']
    comando = ['docker', 'exec', '-w', '/trabajo/' + tarea['carpeta'], CONTENEDOR,
               'timeout', '40s', 'pdflatex', '-no-shell-escape', '-interaction=nonstopmode',
               '-halt-on-error', '-file-line-error', 'main.tex']
    registros = []
    try:
        for _ in range(2):
            r = subprocess.run(comando, capture_output=True, text=True, timeout=45)
            registros.append(r.stdout + r.stderr)
            if r.returncode:
                break
        texto = '\n'.join(registros)
        (carpeta / 'comprobacion.log').write_text(texto)
        tarea['ok'] = r.returncode == 0 and (carpeta / 'main.pdf').exists()
        tarea['codigo'] = r.returncode
        tarea['diagnostico'] = [l for l in texto.splitlines() if l.startswith('!') or re.search(r'main\.tex:\d+:', l)][:6]
        tarea['paquete_ausente'] = re.findall(r"File `([^']+\.(?:sty|cls))' not found", texto)
        tarea['advertencias'] = list(dict.fromkeys(l for l in texto.splitlines() if 'LaTeX Warning:' in l))[:8]
        if tarea['ok']:
            pdf = (carpeta / 'main.pdf').read_bytes()
            tarea['pdfSha256'] = hashlib.sha256(pdf).hexdigest()
        return tarea
    except subprocess.TimeoutExpired:
        return {**tarea, 'ok': False, 'diagnostico': ['Tiempo de compilación agotado.']}


for r in respuestas.values():
    preparar(r)
(SALIDA / 'tareas-compilacion.json').write_text(json.dumps(tareas, ensure_ascii=False, indent=2))
if os.environ.get('EVAL_SOLO_PREPARAR') == 'true':
    print('Documentos/fragmentos preparados:', len(tareas))
    raise SystemExit(0)
print('Documentos/fragmentos a compilar:', len(tareas), flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as grupo:
    resultados = list(grupo.map(compilar, tareas))
(SALIDA / 'compilacion.json').write_text(json.dumps(resultados, ensure_ascii=False, indent=2))
for r in resultados:
    if not r['ok'] or r['delimitador_sobreescapado']:
        print(r['casoId'], r['posicion'], r['tipo'], r['ok'], r['diagnostico'], r.get('paquete_ausente'), 'sobreescape=' + str(r['delimitador_sobreescapado']))
print('Compilaciones:', len(resultados), 'PDF correctos:', sum(r['ok'] for r in resultados))
