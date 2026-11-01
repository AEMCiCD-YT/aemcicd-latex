# Verificación de la fase 1

Implementación en `ia-fase-1`, desde `origin/ext-ce` (`60185d5e8f`). No se modificó la rama
`ext-ce`, `latex-server`, la configuración de Azure ni las dependencias del fork.

## Comprobado localmente

- **55 pruebas aprobadas**, con MongoDB temporal 8.0.4 y modelos simulados del AI SDK. Incluyen
  validación de las ocho funciones, lectura del proyecto desde el servidor, instrucciones,
  límites sin recortes, formato de cambios, rutas ajenas/traversal, conflictos, conservación de
  comandos y fórmulas, selección parcial, agrupación de cambios, privacidad de las colecciones,
  cobro real por función y exclusión de consultas simultáneas.
- Peticiones HTTP de imagen capturadas a Anthropic Messages (Sonnet) y OpenAI Responses (Sol),
  con base64 y MIME reales. La caché del proyecto se serializa como `cache_control` en Anthropic;
  `store=false` se conserva en OpenAI. El transporte es simulado, sin llamadas a los proveedores.
- Parser ampliado solo para `/foto`, con rechazo de JSON inválido y exceso de tamaño.
- **31 archivos `.mjs` del módulo** y `settings.defaults.js` pasan `node --check`.
- Prettier 3.7.4 pasa para todos los `.mjs`, `.ts`, `.tsx` y `.scss` del módulo y los archivos de
  código/JSON modificados del evaluador. `git diff --check` pasa. Se conservaron los bloques
  ajenos de `settings.defaults.js`, que ya tenían diferencias de formato en la base.
- Los **44 casos del evaluador** preparan su entrada correctamente; los 24 nuevos cubren tres
  casos por función. Las imágenes son sintéticas y no hay datos personales.
- El banco de interfaz compila con esbuild y Sass. Chrome ejecuta los componentes reales del
  módulo y CodeMirror con adaptadores de Overleaf y respuestas HTTP interceptadas: temas claro
  y oscuro; log; menú y acción de selección; acción rápida; aplicar y deshacer; descartar;
  conflicto por edición concurrente; permiso de solo lectura; costo confirmado antes del chat;
  fallo del registro y reintento sin duplicar la edición; PDF de una página convertido a PNG y
  PDF de dos páginas rechazado. No aparecen errores JavaScript durante estos casos.

Los comandos reproducibles están en el [README del módulo](../../../services/web/modules/aemcicd-ai/README.md)
y en [test/interfaz/README.md](../../../services/web/modules/aemcicd-ai/test/interfaz/README.md).

## Capturas del banco aislado

El encabezado de cada imagen identifica el entorno y las respuestas simuladas. **No son
capturas de producción ni de una instancia completa de Overleaf.**

| Vista                     | Claro                               | Oscuro                               |
| ------------------------- | ----------------------------------- | ------------------------------------ |
| Panel y acciones rápidas  | [Ver](capturas/panel-claro.png)     | [Ver](capturas/panel-oscuro.png)     |
| Botón del log y propuesta | [Ver](capturas/log-claro.png)       | [Ver](capturas/log-oscuro.png)       |
| Menú de selección         | [Ver](capturas/seleccion-claro.png) | [Ver](capturas/seleccion-oscuro.png) |

## Sin verificar en este entorno

- Construcción de la imagen y webpack/TypeScript de Overleaf completo: Docker Desktop no tiene
  integración habilitada con esta distribución WSL. No se arrancó una instancia con Mongo y Redis.
- Sincronización efectiva entre dos navegadores, historial remoto de ShareJS y colocación del
  menú dentro del editor completo. El banco comprueba la operación CodeMirror y su deshacer,
  pero usa adaptadores de proyecto, permisos, apertura de documentos y controles compartidos.
- Respuestas reales, precisión de los parches y compilación del LaTeX generado por los modelos;
  evaluación comparativa de los 24 casos nuevos con claves reales; costos y caché medidos por las
  API reales. No se extrajeron ni se usaron las claves de Azure.
- No se desplegó la fase 1. El PR requiere revisión e integración antes de abrir el piloto.
