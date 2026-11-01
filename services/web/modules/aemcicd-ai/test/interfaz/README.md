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
npm install --prefix /tmp/ia-pruebas esbuild@0.25.12 sass@1.77.1 playwright@1.56.1 react@18.3.1 react-dom@18.3.1 @codemirror/state@6.5.4 @codemirror/view@6.38.6 @codemirror/commands@6.8.1 dompurify@3.2.7 micromark@4.0.0 pdfjs-dist@5.1.91
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
- Aplicar edita CodeMirror, permite deshacer y registra la ruta; descartar no escribe.
- Una edición concurrente bloquea el parche y preserva el contenido nuevo.
- Un lector no ve «Aplicar».
- El chat del proyecto no consulta hasta aceptar el costo estimado.
- Si falla el registro tras editar, el reintento solo registra y no vuelve a editar.
- PDF de una página convertido a PNG y PDF de dos páginas rechazado antes de enviar.
- Ausencia de errores JavaScript en estos componentes.

Las seis capturas del PR están en
[`aemcicd/docs/ia-fase-1/capturas/`](../../../../../../aemcicd/docs/ia-fase-1/capturas/).
Su encabezado identifica expresamente el entorno simulado.
