# Evaluación comparativa de modelos

Ejecuta los casos de `casos.json` con cada modelo (GPT-6 Luna, Claude Haiku 5.5, GPT-6.1 Terra,
Claude Sonnet 5.5 y GPT-6.1 Sol) usando las mismas instrucciones y precios que el servidor, y
genera `informe.html` con las respuestas lado a lado, el costo y el tiempo. Sirve para decidir
qué modelo atiende cada función (sección 5 del diseño).

Desde la laptop (WSL o macOS) o Azure Cloud Shell, con `az login` hecho y Node 20 o superior:

```bash
bash aemcicd/ia-eval/evaluar.sh
```

Solo algunos modelos:

```bash
bash aemcicd/ia-eval/evaluar.sh gpt-6-luna,claude-haiku-5-5
```

Las claves se leen del Key Vault y no se muestran. La evaluación base tenía 20 casos; ahora hay
63, incluidos los casos de fase 1 y tres por cada función nueva de fase 2. El costo histórico de unos $0,40 para los
20 casos no es una estimación de esta batería ampliada: incluye visión y proyectos completos.
No se ha ejecutado la batería nueva contra las API reales durante esta implementación.

Cada caso admite `funcion`, `entrada`, `archivos` (un proyecto sintético) e `imagen` (ruta a una
imagen de `fixtures/`). `preparar-caso.mjs` usa el lector y el catálogo del módulo para construir
el mismo contexto que el servidor. Los casos anteriores sin `funcion` siguen usando `pregunta`.
Las tres imágenes son ejemplos sintéticos de una ecuación, una matriz y una tabla; no contienen
datos personales. El informe muestra la función de cada caso y valida también los formatos de comentarios y scripts de fase 2.

Para añadir casos reales, agrégalos a `casos.json` sin datos personales. Este evaluador es una
herramienta comparativa aislada, no una ruta del producto: no usa cuentas ni crédito de estudiantes.
