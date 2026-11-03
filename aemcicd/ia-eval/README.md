# Evaluación de calidad y costo

La batería tiene **93 casos**: fase base, fases 1/2 y treinta de fase 3. Usa datos sintéticos,
sin documentos de estudiantes. La [ejecución real del 2 de noviembre de 2026](informes/2026-11-02.md)
completó 186 consultas, con su modelo principal y alternativa, y documenta costos, errores y ejemplos.

## Rutas que usa producción

Desde la raíz del fork, con `az login`, Node 20 o superior y npm:

```bash
bash aemcicd/ia-eval/evaluar.sh --rutas
```

Lee las claves existentes de Key Vault sin mostrarlas. Usa `config.mjs`, cada función y su
esfuerzo por nivel, `store: false` para OpenAI y los mismos esquemas y validadores del producto.
Es una evaluación aislada: llama a las API sin crear cuentas, reservas ni eventos en Mongo;
no consume el crédito de un estudiante. Sí genera consumo facturable de los proveedores.

Los resultados quedan en `resultados/rutas/`, ignorado por Git. `respuestas.jsonl` se escribe
tras cada consulta y permite reanudar sin volver a pagar respuestas ya guardadas. No usa reintentos
automáticos ocultos. `configuracion.json` contiene rutas y precios, nunca claves.

Variables opcionales:

- `EVAL_SALIDA`: carpeta de resultados; conserva la misma para reanudar.
- `EVAL_CASOS`: identificadores separados por comas para acotar una comprobación.
- `EVAL_POSICIONES`: `principal`, `alternativa` o ambas, separadas por coma.
- `EVAL_CONCURRENCIA`: de 1 a 8; predeterminada 4.
- `EVAL_PRESUPUESTO_USD`: tope de costo/reserva del evaluador; predeterminado $8.
- `EVAL_REINTENTAR=true`: permite volver a intentar respuestas que terminaron en error;
  las respuestas válidas se conservan.
- `EVAL_SOLO_PREPARAR=true`: calcula lo pendiente y su cota, sin consultar modelos.

El límite usa el uso conocido y la reserva máxima de peticiones sin importe reportado. Cada
respuesta se identifica por caso, ruta y huella del contexto: cambiar el prompt produce una
observación nueva, no sustituye una medición anterior. Esta identificación no prueba por sí
sola que una respuesta sea correcta.

## Compilación y revisión

`comprobar-latex.py` prepara y compila propuestas/documentos o ejemplos Markdown. Requiere
un contenedor de pruebas llamado `aemcicd-ia-eval-tex`, **sin red**, con pdfLaTeX y los paquetes
indicados por las respuestas. Debe montar `resultados/entorno/compilaciones` en `/trabajo`;
el proceso del contenedor necesita permiso para escribir únicamente esos recursos sintéticos.
Usa sistema de archivos de solo lectura, un `/tmp` temporal, `--cap-drop=ALL`,
`--security-opt no-new-privileges`, límites de CPU/memoria y `-no-shell-escape`.
No montes el socket Docker ni carpetas con credenciales dentro del contenedor.

```bash
python3 aemcicd/ia-eval/comprobar-latex.py <carpeta-de-resultados>
```

`EVAL_SOLO_PREPARAR=true` prepara los archivos sin acceder a Docker. Los fragmentos reciben
un preámbulo de prueba y los paquetes que la respuesta declara; el informe los identifica.
Los ejemplos de figuras usan sustitutos sintéticos. Los archivos faltantes y las incompatibilidades
del entorno se distinguen de los defectos de la respuesta antes de cerrar el informe.

La revisión de contenido se guarda en `revisiones/FECHA.json`, indicando quién la hizo y sus
limitaciones. No se interpreta «JSON válido» como «resultado correcto». La ejecución de scripts
Python generados requiere revisarlos antes y usar otro contenedor aislado, sin red ni credenciales;
no se ejecutan en el equipo anfitrión. La prueba del 2 de noviembre produjo seis PDF de gráficas.

`informar-rutas.py` combina las respuestas con `compilacion-consolidada.json`, `graficas.json`
y las anotaciones. Produce un HTML con las dos respuestas por caso, filtros, hallazgos, costos
individuales y los ejemplos completos, además de JSON y CSV. No llama a modelos ni lee claves:

```bash
python3 aemcicd/ia-eval/informar-rutas.py <carpeta-de-resultados> aemcicd/ia-eval/revisiones/2026-11-02.json
```

El contraste de compilación con TeX Live completo de esa ejecución está documentado en su informe.
Los importes de tarifas de lista usan las páginas oficiales consultadas en esa fecha; no son
una conciliación de factura. Actualiza esa instantánea al realizar una comparación futura.

## Comparación general de modelos

Se conserva el evaluador anterior, que prueba todos los modelos o los que elijas:

```bash
bash aemcicd/ia-eval/evaluar.sh
bash aemcicd/ia-eval/evaluar.sh gpt-6-luna,claude-haiku-5-5
```

Genera `informe.html` con respuestas lado a lado, costo y tiempo. El modo general toma el primer
esfuerzo configurado de cada modelo; usa `--rutas` para comprobar la asignación efectiva por función.

Cada caso admite `funcion`, `entrada`, `archivos`, `imagen`, `pdfs`, `historial` y `referencias`.
`preparar-caso.mjs` usa el lector y el catálogo del módulo para construir el contexto. Los casos
anteriores sin `funcion` siguen usando `pregunta`. Las imágenes y los contextos de PDF/historial
son fixtures sintéticos; no representan extracción o búsquedas reales durante cada consulta.

Añade casos sin datos personales y conserva los resultados desfavorables para medir las correcciones.
