# Fase 3: comprobación y entrega

**Alcance:** batería previa a la publicación, realizada en `ia-fase-3`. La implementación ya
se unió y desplegó el 2 de noviembre de 2026; el [registro de producción](despliegue.md) contiene
las versiones, el respaldo y sus comprobaciones. Es la última fase prevista. Se mantienen las
claves, el crédito, los topes y la IA habilitada para estudiantes.

## Resultado

- **110 pruebas unitarias del módulo aprobadas**, con MongoDB temporal y modelos simulados.
  Las diez funciones nuevas validan entradas y etiquetas. Para cada una se comprueba el cobro
  del uso real reportado por el modelo y que documentos, PDF, historial, consultas, metadatos
  bibliográficos y respuestas no aparezcan en las colecciones del asistente.
- DOI: destino fijo `api.crossref.org`, sin redirecciones, validación de identidad y formato,
  límites de tiempo/tamaño y escape de campos BibTeX. Se rechazan DOI inventados por el modelo,
  rutas ajenas, entradas incompletas y claves de cita literales nuevas inexistentes.
- PDF: firma y tamaño, pertenencia, todas las páginas etiquetadas, límite sin recorte,
  documentos sin texto y limpieza incluso al fallar. También se extrae texto con **PDF.js real**
  de un PDF sintético válido; no se limita a simular el parser.
- Historial: intervalo acotado, diferencias de la API nativa y eliminación de metadatos de autores.
  Los binarios o archivos eliminados solo se describen por su operación.
- Archivos generados: tipo y estructura LaTeX, nombre derivado del evento y escritura por el
  canal nativo, con rechazo de evento o proyecto ajeno y guardado idempotente.
- **Banco Playwright**: conserva la regresión de fases 1/2 y comprueba las diez funciones,
  confirmación de costo, selector PDF/`.bib`, tutor y selección, intervalos, guardado explícito,
  descarte, Word sin modelo, creación desde plantilla, solo lectura y temas claro/oscuro.
  Sin errores JavaScript en esta batería. El transporte y los contextos de Overleaf se adaptan;
  no se presenta el banco como una instancia completa.
- **Overleaf completo local**, Mongo y Redis, usuario/proyectos ficticios y claves falsas:
  galería nativa y creación de un proyecto; ZIP con PDF; extracción de su texto por el servidor;
  estimaciones PDF/historial/bibliografía; DOI real `10.1038/171737a0` consultado en Crossref;
  diferencias reales del Historial; rechazo de PDF y evento de otro proyecto; archivos Beamer
  y de código a algoritmo nuevos, guardado repetido con el mismo identificador, rechazo de
  sobrescritura con otro contenido y registro sin contenido; huella del original intacta.
- El botón **Resumir con IA** se comprobó también en el Historial real: usa su intervalo y abre
  la confirmación de costo, sin una llamada al modelo.
- **Word real**: conversión por CLSI/Pandoc y descarga de un DOCX válido, con
  `word/document.xml` y el texto del proyecto sintético. No consume crédito de IA.
- **Seis plantillas compiladas a PDF** con pdfLaTeX 2026. La imagen local mínima carecía de
  `babel-spanish` y `booktabs`; se instalaron únicamente en `/tmp/ia-fase3-texmf`, en modo
  usuario, para la prueba. No se modificó producción ni se añadió ese árbol a la imagen.
  Son puntos de partida editables; no se certifican normas oficiales de carreras o revistas.
- **31 pruebas de plataforma** y sus typechecks de API/web aprobados. El contrato admite los diez
  nombres nuevos, manteniendo el rechazo de contenido y campos adicionales.
- **19 pruebas del conector aprobadas**: nuevos nombres admitidos y contenido rechazado. No se
  cambia su frecuencia, token, ruta, crédito ni presupuesto.
- `node --check` en los **54 `.mjs` del módulo**, Prettier 3.7.4 con las opciones del fork
  y `git diff --check` aprobados.
- **93 casos de evaluación** preparados sin proveedores ni claves, incluidos 30 nuevos
  (tres por función). El evaluador comprende bibliografía y documentos generados. Los fixtures
  de PDF/historial son sintéticos; el parser y las lecturas reales se prueban por separado.

## Imagen y cambios mínimos

La candidata de entrega se construyó desde el commit de código `8cdc84699f` en ACR (`cjg`,
construcción correcta), con etiqueta
`acraemcicdplatform.azurecr.io/latex-aemcicd:6.3.0-ext-v5.1-fase3-8cdc8469` y digest
`sha256:6176fd3802cdf2bd2b74cd98650e835fb6ee19237f85e1d2eeadad11ff331ee4`.
Incluye la galería habilitada, el ajuste del modo tutor y la conservación del código original
al generar algoritmos. Los commits posteriores de documentación y pruebas no cambian el
código de la aplicación. Esta imagen sustituyó posteriormente a `a5`; véase el registro de
producción para distinguir ambas baterías de comprobaciones.

El [PR 4 de `latex-server`](https://github.com/AEMCiCD-YT/latex-server/pull/4) prepara esa
referencia por digest en el instalador y admite los nombres nuevos en los totales. El
[PR 81 de plataforma](https://github.com/AEMCiCD-YT/aemcicd-platform/pull/81) prepara el contrato
de agregados y los términos 1.3. Los tres PR se unieron para la publicación coordinada posterior.

PDF.js ya estaba en el lockfile, pero como dependencia de desarrollo de web. Se mueve la misma
versión 5.1.91 a producción para el parser del servidor. No se añaden versiones ni se regenera
`yarn.lock`. Se documentan todos los archivos de Overleaf modificados en
[Qué cambia](../../README.md#qué-cambia).

## Reproducir

Las pruebas unitarias usan las dependencias externas descritas en el README del módulo:

```bash
mkdir -p /tmp/aemcicd-ia-pruebas/fase3/app /tmp/aemcicd-ia-pruebas/fase3/test
cp -a services/web/modules/aemcicd-ai/app/src /tmp/aemcicd-ia-pruebas/fase3/app/
cp -a services/web/modules/aemcicd-ai/test/unit /tmp/aemcicd-ia-pruebas/fase3/test/
(cd /tmp/aemcicd-ia-pruebas/fase3 && node --test test/unit/*.test.mjs)
AEMCICD_IA_DEPS=/tmp/aemcicd-ia-pruebas node services/web/modules/aemcicd-ai/test/interfaz/crear.mjs
AEMCICD_IA_DEPS=/tmp/aemcicd-ia-pruebas CHROME=/opt/google/chrome/chrome node services/web/modules/aemcicd-ai/test/interfaz/pruebas.mjs
AEMCICD_IA_DEPS=/tmp/aemcicd-ia-pruebas CHROME=/opt/google/chrome/chrome node services/web/modules/aemcicd-ai/test/interfaz/fase3.mjs
```

La instancia completa se prepara con `compose-fase3.yml`, puerto local 18183 y proyecto Compose
`aemcicd-ia-fase3`. Véanse los comandos en
[el banco de interfaz](../../../services/web/modules/aemcicd-ai/test/interfaz/README.md).
No monta datos ni lee claves del servidor. La prueba crea un evento de autorización sintético
sin contenido para comprobar el guardado real; no lo presenta como una respuesta de un modelo.

## Lo que no se certifica

- Esta batería local no midió la calidad de respuestas reales. La
  [evaluación posterior de 93 casos](../../ia-eval/informes/2026-11-02.md) ya está ejecutada y
  distingue respuestas correctas, observaciones y defectos por corregir.
- OCR, interpretación de figuras de PDF, verificación simbólica o validez científica de una
  referencia: siguen fuera del alcance o requieren revisión humana.
- Colaboración entre cuentas distintas y soporte HTTPS entre subdominios con sesiones reales.
  Las pruebas locales anteriores y las de fase 3 no sustituyen ese recorrido de producción.
- Esta batería local no certifica por sí sola el despliegue. La imagen, las listas de funciones
  y los términos 1.3 se comprobaron posteriormente como indica el registro de producción.

## Capturas

Datos ficticios, sin claves ni consultas reales a modelos:

- [Panel del banco claro](capturas/banco/fase3-panel-claro.png) y
  [oscuro](capturas/banco/fase3-panel-oscuro.png), con el entorno adaptado identificado.
- [Galería de Overleaf real](capturas/overleaf/galeria-real.png).
- [Panel de Overleaf claro](capturas/overleaf/panel-real-light.png) y
  [oscuro](capturas/overleaf/panel-real-dark.png).
- [Acción del Historial real](capturas/overleaf/historial-real.png).
- [Confirmación de costo del Historial](capturas/overleaf/historial-estimacion-real.png).
