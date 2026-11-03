"""Informe offline con respuestas sintéticas escapadas; no llama a modelos ni lee claves."""
from collections import Counter
from decimal import Decimal, ROUND_CEILING
from html import escape
import csv
import json
from pathlib import Path
import statistics
import sys

BASE = Path(__file__).resolve().parent
SALIDA = Path(sys.argv[1]).resolve()
REVISION = Path(sys.argv[2]).resolve()
casos = json.loads((BASE / 'casos.json').read_text())
config = json.loads((SALIDA / 'configuracion.json').read_text())
revision = json.loads(REVISION.read_text())
hallazgos = revision['hallazgos']
respuestas = {}
for linea in (SALIDA / 'respuestas.jsonl').read_text().splitlines():
    r = json.loads(linea)
    respuestas[(r['casoId'], r['posicion'])] = r
assert len(respuestas) == len(casos) * 2, 'La batería no está completa.'
compilaciones = json.loads((SALIDA / 'compilacion-consolidada.json').read_text())
graficas = json.loads((SALIDA / 'graficas.json').read_text())


def costo_proveedor(r):
    p = dict(config['precios'][r['modelo']])
    if r['modelo'] == 'claude-sonnet-5-5':
        p['cacheLectura'] = 0.1
    u = r['uso']
    d = u.get('inputTokenDetails', {})
    lectura = d.get('cacheReadTokens', 0) or 0
    escritura = d.get('cacheWriteTokens', 0) or 0
    entrada = d.get('noCacheTokens')
    if entrada is None:
        entrada = max(0, u['inputTokens'] - lectura - escritura)
    micro = sum(Decimal(str(p[k])) * n for k, n in [
        ('entrada', entrada), ('cacheLectura', lectura),
        ('cacheEscritura', escritura), ('salida', u['outputTokens'])])
    return float((micro - Decimal('0.000001')).to_integral_value(rounding=ROUND_CEILING) / 1000000)


filas = list(respuestas.values())
for r in filas:
    r['costoListaUSD'] = costo_proveedor(r)
    r['hallazgos'] = [h for h in hallazgos if (h['casoId'], h['posicion']) == (r['casoId'], r['posicion'])]


def estadisticas(rs):
    return {'consultas': len(rs), 'erroresAPI': sum(bool(r.get('error')) for r in rs),
            'cortadas': sum(r.get('fin') == 'length' for r in rs),
            'costoProgramaUSD': round(sum(r['costoUSD'] for r in rs), 6),
            'costoListaUSD': round(sum(r['costoListaUSD'] for r in rs), 6),
            'tokensEntrada': sum(r['uso']['inputTokens'] for r in rs),
            'tokensSalida': sum(r['uso']['outputTokens'] for r in rs),
            'medianaMs': statistics.median(r['totalMs'] for r in rs),
            'estructuradas': sum('validacion' in r for r in rs),
            'validas': sum(r.get('validacion', {}).get('ok') is True for r in rs),
            'sinCambios': sum(r.get('validacion', {}).get('cambios') == 0 for r in rs),
            'conHallazgos': sum(bool(r['hallazgos']) for r in rs)}


resumen = {'fecha': revision['fecha'], 'revisor': revision['revisor'], 'casos': len(casos),
           'total': estadisticas(filas),
           'porPosicion': {p: estadisticas([r for r in filas if r['posicion'] == p]) for p in ['principal', 'alternativa']},
           'porModelo': {m: estadisticas([r for r in filas if r['modelo'] == m]) for m in sorted({r['modelo'] for r in filas})},
           'compilacion': {'pruebas': len(compilaciones), 'pdf': sum(r['ok'] for r in compilaciones),
                           'fallos': [{k:r[k] for k in ['casoId','posicion','diagnostico']} for r in compilaciones if not r['ok']]},
           'graficas': {'pruebas': len(graficas), 'pdf': sum(r['pdf'] for r in graficas)},
           'hallazgos': hallazgos}
(SALIDA / 'resumen.json').write_text(json.dumps(resumen, ensure_ascii=False, indent=2))
with (SALIDA / 'resumen.csv').open('w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['caso', 'posicion', 'funcion', 'modelo', 'esfuerzo', 'costo_programa_USD', 'costo_lista_USD', 'entrada', 'salida', 'ms', 'validacion', 'hallazgos'])
    for r in filas:
        w.writerow([r['casoId'],r['posicion'],r['funcion'],r['modelo'],r['esfuerzo'],r['costoUSD'],r['costoListaUSD'],r['uso']['inputTokens'],r['uso']['outputTokens'],r['totalMs'],r.get('validacion',{}).get('ok'),'; '.join(h['nota'] for h in r['hallazgos'])])


def pre(texto, clase=''):
    return f'<pre class="{clase}">{escape(str(texto))}</pre>'


def respuesta(r):
    html = f'<h3>{escape(r["posicion"].capitalize())}: {escape(r["modelo"])}</h3><p class="meta">Esfuerzo {escape(r["esfuerzo"])} · ${r["costoUSD"]:.6f} · {r["totalMs"]/1000:.2f} s</p>'
    if r['hallazgos']:
        html += '<ul>' + ''.join(f'<li class="{escape(h["gravedad"])}"><b>{escape(h["gravedad"])}:</b> {escape(h["nota"])}</li>' for h in r['hallazgos']) + '</ul>'
    else:
        html += '<p class="meta">Sin hallazgos registrados en esta revisión.</p>'
    v = r.get('validacion')
    if v:
        html += '<p><b>Formato:</b> ' + ('aceptado' if v['ok'] else 'rechazado: ' + escape(v['motivo'])) + '</p>'
    checks = [c for c in compilaciones if c['clave'] == r['clave']]
    for c in checks:
        html += f'<p><b>LaTeX:</b> {"PDF generado" if c["ok"] else "no compila"}; {escape(c["tipo"])}'
        if c['envoltura']:
            html += '; fragmento con preámbulo de prueba'
        if c.get('recursos_de_prueba'):
            html += '; imágenes sustitutas de prueba'
        html += '.</p>'
        if not c['ok']:
            html += pre('\n'.join(c['diagnostico']))
    try:
        contenido = json.loads(r['texto'])
    except (ValueError, KeyError):
        contenido = None
    if isinstance(contenido, dict) and 'explicacion' in contenido:
        html += '<h4>Explicación recibida</h4>' + pre(contenido['explicacion'], 'prosa')
        if 'contenido' in contenido:
            html += '<h4>Documento propuesto</h4>' + pre(contenido['contenido'])
        for c in contenido.get('cambios', []):
            html += '<h4>Cambio en ' + escape(c['archivo']) + '</h4><b>Antes</b>' + pre(c['antes']) + '<b>Después</b>' + pre(c['despues'])
        for c in contenido.get('comentarios', []):
            html += '<h4>Comentario en ' + escape(c['archivo']) + '</h4>' + pre(c['cita']) + pre(c['comentario'], 'prosa')
        if 'script' in contenido:
            html += '<h4>Script propuesto</h4>' + pre(contenido['script'])
        if 'dois' in contenido:
            html += '<h4>DOI seleccionados</h4>' + pre(json.dumps(contenido['dois'], ensure_ascii=False))
    else:
        html += pre(r.get('texto', ''), 'prosa')
    imagen = 'graficas/' + r['casoId'] + '-' + r['posicion'] + '.png'
    if (SALIDA / imagen).exists():
        html += '<h4>PDF generado</h4><img alt="Gráfica de los datos sintéticos" src="' + escape(imagen) + '">'
    return '<article>' + html + '</article>'


def tabla(grupo):
    cabecera = '<table><tr><th>Ruta/modelo</th><th>Consultas</th><th>Costo programa</th><th>Mediana</th><th>Formato válido</th><th>Respuestas con hallazgos</th></tr>'
    for nombre, e in grupo.items():
        formato = f'{e["validas"]}/{e["estructuradas"]}' if e['estructuradas'] else '—'
        cabecera += f'<tr><td>{escape(nombre)}</td><td>{e["consultas"]}</td><td>${e["costoProgramaUSD"]:.6f}</td><td>{e["medianaMs"]/1000:.2f} s</td><td>{formato}</td><td>{e["conHallazgos"]}</td></tr>'
    return cabecera + '</table>'


secciones = []
for c in casos:
    par = [respuestas[(c['id'], p)] for p in ['principal', 'alternativa']]
    marcas = sorted({h['gravedad'] for r in par for h in r['hallazgos']})
    solicitud = c.get('pregunta') or c.get('entrada')
    html = f'<section class="caso" data-funcion="{escape(c.get("funcion", "pregunta"))}" data-marcas="{escape(" ".join(marcas))}"><h2>{escape(c["id"])}</h2><p>Función: {escape(c.get("funcion", "pregunta"))}</p>'
    html += '<details><summary>Solicitud y contexto sintético</summary>' + pre(solicitud if isinstance(solicitud, str) else json.dumps(solicitud, ensure_ascii=False, indent=2))
    if c.get('imagen'):
        html += f'<img alt="Imagen sintética del caso" src="{escape("../../"+c["imagen"])}">'
    for campo in ['archivos', 'pdfs', 'historial', 'referencias']:
        if campo in c:
            html += '<h4>' + escape(campo) + '</h4>' + pre(json.dumps(c[campo], ensure_ascii=False, indent=2))
    html += '</details><div class="comparacion">' + ''.join(respuesta(r) for r in par) + '</div></section>'
    secciones.append(html)

funciones = sorted({c.get('funcion','pregunta') for c in casos})
html = '''<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Evaluación AEMCiCD: resultados y ejemplos</title>
<style>:root{color-scheme:light dark}body{font:15px/1.5 system-ui,sans-serif;margin:24px auto;max-width:1500px;padding:0 16px}h1{font-size:27px}h2{font-size:21px}h3{font-size:18px}table{border-collapse:collapse;width:100%;margin:20px 0}td,th{padding:9px;text-align:left;border:1px solid #8886}th{background:#8882}pre{white-space:pre-wrap;overflow-wrap:anywhere;padding:10px;border:1px solid #8885;border-radius:4px;font:12px/1.5 ui-monospace,monospace}.prosa{font:14px/1.55 system-ui,sans-serif}.meta{font-size:13px;opacity:.8}.comparacion{display:grid;grid-template-columns:1fr 1fr;gap:20px}article{min-width:0;border:1px solid #8885;padding:14px;border-radius:6px}.caso{border-top:2px solid #8886;margin-top:32px;padding-top:14px}summary{cursor:pointer;font-weight:600}label{margin-right:16px}input,select{padding:6px;margin:6px}img{max-width:100%}.corregir,.bloqueada{color:light-dark(#9b1c1c,#ffaaaa)}.observacion{color:light-dark(#775000,#ffdb85)}.filtros{position:sticky;top:0;background:Canvas;border:1px solid #8886;padding:10px;z-index:1}[hidden]{display:none!important}@media(max-width:850px){.comparacion{grid-template-columns:1fr}table{font-size:12px;display:block;overflow:auto}}@media print{.filtros{display:none}details{display:block}.caso{break-before:page}}
</style><body>'''
html += f'<h1>Evaluación de calidad y costo · {escape(revision["fecha"])}</h1><p><b>{len(casos)} casos · {len(filas)} consultas reales · {resumen['total']['erroresAPI']} errores de API · {resumen['total']['cortadas']} respuestas cortadas.</b></p>'
html += f'<p>Costo con la configuración del programa: <b>${resumen["total"]["costoProgramaUSD"]:.6f}</b>. Con tarifas de lista verificadas: <b>${resumen["total"]["costoListaUSD"]:.6f}</b>. Son importes calculados desde el uso reportado por las API, no una conciliación de factura. La evaluación usa datos sintéticos y conserva los saldos de estudiantes.</p>'
html += f'<p>{resumen["total"]["validas"]}/{resumen["total"]["estructuradas"]} respuestas estructuradas aceptadas, incluidas {resumen["total"]["sinCambios"]} abstenciones sin cambios. {resumen["compilacion"]["pdf"]}/{resumen["compilacion"]["pruebas"]} documentos o fragmentos generaron PDF. Las {len(graficas)} gráficas generaron {sum(g["pdf"] for g in graficas)} PDF. Cada hallazgo aparece junto a la respuesta correspondiente.</p>'
html += '<h2>Rutas de producción</h2>' + tabla(resumen['porPosicion'])
html += '<h2>Modelos</h2><p class="meta">Cada modelo atendió funciones y esfuerzos distintos. Para comparar calidad, consulta las dos respuestas de un mismo caso. «Sin hallazgos registrados» describe esta revisión, no una garantía de corrección.</p>' + tabla(resumen['porModelo'])
html += '<p>Metodología: una ejecución por caso/ruta; validadores del producto; compilación sin red ni shell escape; preámbulo de prueba para fragmentos e imágenes sustitutas para ejemplos didácticos. Las 17 compilaciones dudosas se contrastaron con el digest TeX Live de producción en contenedores de recursos limitados. El alcance no incluye OCR, tráfico real de estudiantes ni revisión humana independiente.</p>'
html += '<p>Tarifas: <a href="https://developers.openai.com/api/docs/pricing">OpenAI</a> y <a href="https://platform.claude.com/docs/en/about-claude/pricing">Anthropic</a>. La lectura de caché de Sonnet figura como $0,20/MTok en la configuración y $0,10/MTok en la tarifa publicada consultada. <a href="resumen.csv" download>Descargar métricas CSV</a>.</p>'
html += '<div class="filtros"><label>Buscar <input id="buscar" type="search" placeholder="Caso, modelo o texto"></label><label>Función <select id="funcion"><option value="">Todas</option>' + ''.join(f'<option>{escape(f)}</option>' for f in funciones) + '</select></label><label>Mostrar <select id="marcas"><option value="">Todos los casos</option><option value="hallazgos">Con hallazgos</option><option value="corregir">Requieren corrección</option><option value="bloqueada">Bloqueadas por el servidor</option><option value="observacion">Observaciones</option></select></label><span id="cuenta"></span></div>'
html += ''.join(secciones)
html += '''<script>const elementos=[...document.querySelectorAll('.caso')];const buscar=document.getElementById('buscar'),funcion=document.getElementById('funcion'),marcas=document.getElementById('marcas');function filtrar(){let n=0;for(const e of elementos){const texto=buscar.value.toLocaleLowerCase('es'),m=marcas.value;const visible=(!funcion.value||e.dataset.funcion===funcion.value)&&(!texto||e.textContent.toLocaleLowerCase('es').includes(texto))&&(!m||(m==='hallazgos'?e.dataset.marcas.length>0:e.dataset.marcas.split(' ').includes(m)));e.hidden=!visible;if(visible)n++}document.getElementById('cuenta').textContent=n+' casos'}for(const e of [buscar,funcion,marcas])e.addEventListener('input',filtrar);filtrar();</script></body></html>'''
(SALIDA / 'informe.html').write_text(html)
print(json.dumps({'total':resumen['total'],'porPosicion':resumen['porPosicion'],'compilacion':resumen['compilacion'],'hallazgos':len(hallazgos)},ensure_ascii=False,indent=2))
print('Informe:', SALIDA / 'informe.html')
