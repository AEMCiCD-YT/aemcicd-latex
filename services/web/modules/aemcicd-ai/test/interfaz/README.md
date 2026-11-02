# Banco aislado de interfaz

Ejecuta los componentes reales de `aemcicd-ai` con React, CodeMirror y el Markdown seguro del
módulo. Los contextos de Overleaf, botones compartidos, cabecera y transporte se sustituyen por
adaptadores visibles en `adaptadores.tsx`. Las respuestas HTTP se interceptan con Playwright;
no se contacta Azure ni se utilizan claves.

Este banco permite comprobar interacciones y obtener capturas. **No es una instancia completa
de Overleaf y no prueba la sincronización real de ShareJS, Mongo o Redis**, el posicionamiento
del menú dentro del editor completo ni la compilación webpack de la imagen.

Desde la raíz del fork, con las dependencias de las pruebas unitarias ya instaladas en `/tmp/ia-pruebas`:

```bash
npm install --prefix /tmp/ia-pruebas esbuild@0.25.12 sass@1.77.1 playwright@1.56.1 react@18.3.1 react-dom@18.3.1 @codemirror/state@6.5.4 @codemirror/view@6.38.6 @codemirror/commands@6.8.1 dompurify@3.2.7 micromark@4.0.0 pdfjs-dist@5.1.91 typescript@5.9.3
AEMCICD_IA_DEPS=/tmp/ia-pruebas node services/web/modules/aemcicd-ai/test/interfaz/crear.mjs
AEMCICD_IA_DEPS=/tmp/ia-pruebas node services/web/modules/aemcicd-ai/test/interfaz/pruebas.mjs
```

No instala dependencias en el fork ni modifica el lockfile. Requiere Chrome local; por defecto
se usa `/usr/bin/google-chrome`. `CHROME` permite elegir otro ejecutable.

La compilación va a `/tmp/aemcicd-ia-banco` (`AEMCICD_IA_BANCO` para cambiarlo); las capturas,
a `/tmp/aemcicd-ia-capturas` (`AEMCICD_IA_CAPTURAS`). `pruebas.mjs` inicia un servidor HTTP local,
lo cierra al terminar y comprueba:

- Tema claro y oscuro, panel, botón de log y acciones del menú de selección.
- Las consultas usan su función correspondiente y no envían el documento desde el cliente.
- Enviar a revisión edita CodeMirror, permite deshacer y registra la ruta; descartar no escribe.
- Una edición concurrente bloquea el parche y preserva el contenido nuevo.
- Un lector no ve «Enviar a revisión».
- El chat del proyecto no consulta hasta aceptar el costo estimado.
- Si falla el registro tras editar, el reintento solo registra y no vuelve a editar.
- PDF de una página convertido a PNG y PDF de dos páginas rechazado antes de enviar.
- Jurado en legacy/history-ot, guardado de gráfica sin ejecutarla y ejecución solo al pulsar.
- Declaración determinista y aviso al borrar su marca manualmente.
- Ausencia de errores JavaScript en estos componentes.

Las seis capturas del PR están en
[`aemcicd/docs/ia-fase-1/capturas/`](../../../../../../aemcicd/docs/ia-fase-1/capturas/).
Su encabezado identifica expresamente el entorno simulado.

## Comprobaciones adicionales

```bash
AEMCICD_IA_DEPS=/tmp/ia-pruebas node services/web/modules/aemcicd-ai/test/interfaz/seguimiento.mjs
node services/web/modules/aemcicd-ai/test/interfaz/grafica-python.mjs
```

`seguimiento.mjs` extrae mediante TypeScript los métodos reales `withTrackedChanges` y
`setTrackChangesUserId`, y comprueba su estado durante sincronización, cambios del interruptor,
fallos y recuperación. La segunda prueba requiere Python con NumPy, SciPy y Matplotlib; ejecuta
un fixture fijo revisado y comprueba el ajuste (pendiente 2, intercepto 1, R² 1) y el PDF vectorial.
No ejecuta código recibido de un modelo.

## Overleaf completo

Se incluye `compose.yml` para una instancia desechable en **localhost:18182**, con Mongo, Redis,
claves falsas, IA solo para administradores y un volumen propio para el historial. Construye
primero `docker build -f aemcicd/Dockerfile -t aemcicd-latex:ia-fase-2 .`. Copia el compose a
`/tmp/aemcicd-ia-fase2-compose.yml` y úsalo con `docker compose -p aemcicd-ia-fase2 -f ...`.
Inicializa la réplica Mongo `overleaf` con el miembro `mongo:27017` antes de arrancar web.
No montes directorios ni credenciales de producción.

La preparación de la sesión es explícita: crea `admin@example.test` con el script nativo
`modules/server-ce-scripts/scripts/create-user.mjs --admin --email=admin@example.test`, desde
`/overleaf/services/web` y cargando `/etc/overleaf/env.sh`; activa esa cuenta en el navegador,
crea un proyecto ficticio y guarda su sesión Playwright en `/tmp/ia-overleaf-sesion.json`.
Guarda exclusivamente `{projectId,docId,userId}` en `/tmp/ia-overleaf-ids.json`. Prepara en el
Mongo temporal tres eventos `ok` sin contenido, propios de esa cuenta/proyecto:
`000000000000000000000201` (`corregir_error`), `...202` (`revisor_jurado`) y `...203`
(`grafica_datos`). Son autorización para las respuestas simuladas; **no son consumo real**.
No escribas documentos en Mongo: las pruebas editan por CodeMirror y las rutas nativas.

```bash
# Contraseña exclusiva de esa cuenta ficticia; no utilices una cuenta real.
AEMCICD_IA_PASSWORD=... node services/web/modules/aemcicd-ai/test/interfaz/overleaf.mjs
python3 services/web/modules/aemcicd-ai/test/interfaz/importaciones.py
node services/web/modules/aemcicd-ai/test/interfaz/importaciones.mjs
node services/web/modules/aemcicd-ai/test/interfaz/grafica-overleaf.mjs
node services/web/modules/aemcicd-ai/test/interfaz/capturas-overleaf.mjs
```

Las pruebas usan `AEMCICD_IA_DEPS` y `CHROME` como el banco. `overleaf.mjs` verifica diagnóstico
real de CLSI, validación del servidor, seguimiento nativo, comentario de procedencia, otra pestaña,
aceptación nativa y jurado. El estado de la barra lateral se comparte entre pestañas: abrir una
pestaña ya abierta la cerraría. Los hilos se pliegan según la selección de cada editor.
`importaciones.mjs` verifica CORS/CSRF, resumen administrador, ZIP de Prism, lectura del CSV
fileRef y DOCX convertido por Pandoc/CLSI. La lectura del CSV se comprueba enviando una pregunta
vacía: se lee el archivo y se rechaza la entrada antes de llamar a un modelo.
`grafica-overleaf.mjs` usa Pyodide y sube el PDF real; `capturas-overleaf.mjs` no modifica texto.
Solo se simula `/consulta`, con fixtures revisados. No se verifica colaboración entre cuentas
distintas ni history-ot en esta instancia (el banco sí cubre ambas variantes de comentarios).
No confundas estas pruebas con llamadas reales a Azure ni con un despliegue.

Evidencia de fase 2 en [`aemcicd/docs/ia-fase-2/`](../../../../../../aemcicd/docs/ia-fase-2/).
