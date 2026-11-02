# Comprobación de la fase 2

La batería local se ejecutó en `ia-fase-2`, desde `ext-ce` (`fcf60a8e29`, fase 1 unida),
con proyectos ficticios y proveedores simulados. El código se unió después mediante
[PR #5](https://github.com/AEMCiCD-YT/aemcicd-latex/pull/5) y está desplegado.
La plataforma se unió mediante [PR #79](https://github.com/AEMCiCD-YT/aemcicd-platform/pull/79).
Las comprobaciones posteriores en Azure se documentan por separado en
[despliegue de producción](despliegue.md); los resultados locales de abajo conservan su alcance.

## Resultado

- **79 pruebas del módulo aprobadas**, con MongoDB temporal 8.0.4 y modelos simulados del AI SDK.
  Incluyen las funciones nuevas, datos etiquetados, crédito/costo real por función, ausencia de
  contenido en todas las colecciones del asistente, estimación previa, archivos ajenos, rutas
  inseguras, citas únicas y actuales, cambios separados, fórmulas/comandos protegidos, declaración
  determinista, CSV subido como fileRef y la vinculación del evento a su función/proyecto/persona.
- Dos pruebas adicionales ejecutan los métodos reales de `DocumentContainer`: conservan el
  seguimiento hasta sincronizar, restauran el último interruptor elegido y manejan fallo,
  concurrencia y recuperación de copias locales.
- Python local: NumPy/SciPy/Matplotlib recuperan la recta sintética (m=2, b=1, R²=1) y producen
  un PDF vectorial. El script es un fixture revisado, no código recibido de un modelo.
- Banco de componentes reales con React/CodeMirror y transporte adaptado: claro/oscuro, Logs,
  selección, propuestas, deshacer, descarte, conflicto, solo lectura, estimación, reintento del
  registro, PNG/PDF, jurado legacy/history-ot, ejecución explícita de gráfica y aviso al quitar
  la declaración desde CodeMirror. Sin errores JavaScript en la batería.
- **Imagen construida** con `docker build -f aemcicd/Dockerfile -t aemcicd-latex:ia-fase-2 .`.
  Webpack 5.106.2 terminó con dos advertencias de tamaño, sin errores; 68 vistas Pug compiladas.
  La imagen base carecía de Pandoc y ZIP y devolvía 404 al convertir Word: el Dockerfile del fork
  instala esas herramientas y activa la variable nativa `ENABLE_PANDOC_CONVERSIONS=true`.
  Puede sobrescribirse en ejecución y habilita también los demás menús de conversión nativos.
- **Overleaf completo**, con Mongo, Redis, claves falsas e IA solo para administradores:
  diagnóstico LaTeX real y botón «Corregir con IA»; propuesta validada por el servidor; seguimiento
  nativo con comentario «IA, pedido por admin»; cambios pendientes visibles desde otra pestaña;
  aceptación nativa y comentario del jurado publicado en el margen. Solo se intercepta `/consulta`;
  los eventos de autorización son sintéticos, sin contenido ni consumo real.
- **Importaciones reales**: ZIP de Prism mediante el cargador existente, CSV desde fileRef y
  DOCX convertido por CLSI/Pandoc. No se consulta al modelo durante estas pruebas.
- **Pyodide real**: guardar crea el script por `EditorController` sin producir el PDF; solo tras
  pulsar «Ejecutar Python» se genera y sube el PDF a `graficas/` del proyecto. Se comprobó su
  presencia por la API de entidades y la notificación nativa de subida.
- **Seguridad HTTP real**: sesión de soporte con CORS solo al origen de la plataforma;
  origen ajeno rechazado; POST sin CSRF rechazado antes del modelo; resumen solo de totales
  obtenido con la sesión administradora. No contiene identificadores ni conversaciones.
- Panel y menú de selección también capturados en el editor completo en claro y oscuro.
- Plataforma: **21 pruebas aprobadas**, typecheck de API y web, `prisma validate` y banco
  Playwright de soporte/panel con autenticación y transporte adaptados. Evidencia en su PR.
- Sintaxis correcta en los 43 `.mjs` del módulo, configuración de Overleaf y evaluador.
  Prettier 3.7.4 comprueba el módulo completo y los documentos/evaluador modificados;
  `git diff --check` pasa.
- 15 casos nuevos de evaluación (tres por función); **63 casos en total**. El evaluador comprende
  también los esquemas de comentarios y scripts. No se ejecutaron con proveedores reales.

## Comandos

Las dependencias externas de pruebas se instalaron en `/tmp/aemcicd-ia-pruebas`, sin modificar
el monorepo. Se copiaron allí `app/` y `test/` del módulo para ejecutar `node --test test/unit/*.test.mjs`.
Las instrucciones y adaptadores están en
[`test/interfaz/README.md`](../../../services/web/modules/aemcicd-ai/test/interfaz/README.md).

La instancia de pruebas usa el proyecto Compose `aemcicd-ia-fase2` en `localhost:18182`. Su
Mongo/Redis y cuenta `admin@example.test` son ficticios. Al recrear el contenedor, los proyectos
sin volumen perdían su historial; se creó un proyecto nuevo para la comprobación final. El
compose entregado incluye un volumen propio para evitar esa pérdida al repetirla.

El segundo navegador debe abrir el documento antes de revisar. La barra lateral conserva su
estado entre pestañas: pulsar una pestaña ya abierta la cierra. La prueba respeta ese estado y
los hilos que Overleaf pliega según la selección; no sustituye el control de cambios ni lo simula.

## Lo que queda sin verificar

- Consultas reales a Azure/Anthropic/OpenAI y calidad de la batería de modelos: se usaron
  transportes simulados o fixtures revisados, sin leer claves reales ni consumir crédito externo.
- Colaboración entre cuentas distintas y el motor history-ot en el servidor completo; se
  verificaron dos pestañas de la misma cuenta, y ambas variantes de comentarios en el banco.
- Sesiones reales HTTPS entre los subdominios de producción; CORS/CSRF se comprobaron contra
  la instancia local, y el componente público de soporte mediante el banco de la plataforma.
- Restauración efectiva del respaldo de producción en una instancia aislada. Se confirmó su
  existencia en Blob Storage, no una restauración completa.

La migración PostgreSQL, la recepción persistida de los totales, los PRs y los despliegues ya
se completaron; véase [la evidencia de producción](despliegue.md). La prueba del conector no
certifica por sí sola las sesiones de soporte ni la calidad de las respuestas de los modelos.

La declaración refleja acciones registradas (incluye envíos a revisión y scripts guardados);
no certifica qué se aceptó finalmente. Su texto lo explica y pide ajustarla al uso incorporado.
El filtro estático del script tampoco constituye un aislamiento completo de Python.

## Capturas

Instancia Overleaf real, con modelos simulados:

- [Panel claro](capturas/overleaf/panel-real-light.png) y [oscuro](capturas/overleaf/panel-real-dark.png).
- [Log real](capturas/overleaf/log-real.png), [propuesta](capturas/overleaf/propuesta-real.png),
  [revisión](capturas/overleaf/revision-real.png) y [segunda pestaña](capturas/overleaf/segunda-pestana-real.png).
- [Jurado](capturas/overleaf/jurado-real.png).
- [Selección clara](capturas/overleaf/seleccion-real-light.png) y [oscura](capturas/overleaf/seleccion-real-dark.png).
- [Guardar sin ejecutar](capturas/overleaf/grafica-antes-de-ejecutar.png) y
  [PDF subido tras ejecutar](capturas/overleaf/grafica-pdf-subido.png).

El directorio `capturas/banco/` contiene las capturas de componentes con adaptadores, identificadas
como entorno simulado; conserva las evidencias anteriores de la fase 1 en su propio directorio.
