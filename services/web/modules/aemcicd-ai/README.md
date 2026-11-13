# aemcicd-ai: asistente de IA de LaTeX AEMCiCD

Módulo propio del fork. El diseño completo está en [`aemcicd/docs/ia-diseno.md`](../../../../aemcicd/docs/ia-diseno.md).
Este módulo contiene la **fase base** y las **fases 1, 2 y 3**, desplegadas en producción
([evidencia y límites](../../../../aemcicd/docs/ia-fase-3/despliegue.md)):

- conexión con Claude y OpenAI solo desde el servidor (`app/src/proveedores.mjs`);
- enrutador por nivel, con cambio automático al otro proveedor (`enrutador.mjs`, `servicio.mjs`);
- crédito mensual por estudiante y presupuesto por proveedor, con reservas atómicas en Mongo
  (`saldos.mjs`);
- eventos de medición sin contenido, 👍/👎 y registro de uso de IA por proyecto;
- panel «Asistente de IA» en la barra lateral del editor, con activación, barra de saldo,
  preguntas sobre LaTeX y «Probar con otro modelo» (`frontend/`).

## Fase 1: funciones e interfaz

| Función                                  | Nivel       | Acceso                                                                                               |
| ---------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------- |
| `corregir_error`, `corregir_advertencia` | `rapido`    | «Corregir con IA» en errores, advertencias y avisos tipográficos de los Logs                         |
| `formula_texto`, `tabla_excel`           | `rapido`    | Acciones rápidas del panel, que rellenan una consulta editable                                       |
| `esqueleto`                              | `escritura` | Acción rápida del panel                                                                              |
| `foto_latex`                             | `escritura` | Selector «Foto o PDF a LaTeX»                                                                        |
| `reescribir`                             | `escritura` | Menú flotante de la selección: mejorar, tono académico, resumir, ampliar, traducir al inglés/español |
| `chat_proyecto`                          | `proyecto`  | Casilla «Usar todo el proyecto», con estimación y confirmación antes de consultar                    |

`pregunta` continúa funcionando. Todas pasan por `servicio.consultar()`, con crédito, cambio de
proveedor, costo real, valoración y eventos comunes. Un bloqueo temporal en la activación del
estudiante limita a una consulta simultánea entre pestañas y procesos; solo guarda identificador
y caducidad, y se libera incluso si falla la consulta.

El servidor lee los documentos recientes mediante `DocumentUpdaterHandler.getDocument()` y
obtiene su pertenencia y ruta desde el árbol de `ProjectGetter`. El navegador solo elige rutas,
posiciones, pregunta, selección, diagnóstico e imagen; no suministra el contexto del proyecto.
Para los diagnósticos se incluyen hasta 31 líneas alrededor de la línea indicada. El chat incluye
`.tex`, `.bib`, `.cls`, `.sty`, `.md` y `.txt`, con el documento principal primero. Si supera el
límite, se rechaza completo antes de llamar al modelo. El bloque estable lleva la opción de caché
de Anthropic; la pregunta queda fuera de ese bloque.

Si existe `ia-instrucciones.md` en la raíz, se añade como datos a cada consulta (máximo 2000
caracteres; si se excede, se pide reducirlo). El panel permite crear una plantilla mediante la
vía de creación de archivos de Overleaf, que también avisa a los colaboradores. No sobrescribe
un archivo existente.

Las imágenes se reducen en el navegador a 1600 px por lado. Un PDF se convierte en el navegador
en imágenes JPEG de sus páginas (hasta 20 por consulta; si tiene más, el estudiante elige el
rango). El PDF original no se envía al servidor. El servidor comprueba firma de PNG/JPEG/WebP,
dimensiones, base64, 5 MiB por página y 20 MiB en total, sin confiar en el MIME ni en el nombre
recibido. Solo `/foto` usa un parser JSON de 28 MiB; los demás límites de Express permanecen
intactos. La salida máxima crece con las páginas (3000 tokens por página) y, con más de dos
páginas, el panel muestra el costo máximo antes de enviar (`soloEstimar` + `paginas`, sin
reenviar las imágenes). Las imágenes no se guardan en archivos, eventos ni Mongo.

## Agente del documento (chat del panel)

El chat del panel usa la función `agente` (ruta `rapido`, o `proyecto` con «Todo el proyecto»).
El navegador indica solo **qué** mirar; el servidor lee el texto:

- `archivo`, `cursor` y, si hay selección, `desde`/`hasta` del archivo abierto. El servidor
  envía el archivo completo (o ±150 líneas del cursor si pasa de 60 000 caracteres) y su
  preámbulo, para poder añadir `\usepackage` o `\usetikzlibrary`.
- `errores`: hasta 10 diagnósticos de la última compilación (errores, advertencias y cajas
  `Overfull`), con unas líneas alrededor si están en otro archivo.
- `historial`: los últimos turnos del chat (no se guardan en el servidor; máximo 16 000
  caracteres).

Los cambios solo pueden tocar texto que la IA vio, o insertar en el cursor (`antes: ""`, con la
huella del archivo). Al pulsar «Aplicar», el panel recompila y, si quedan errores, ofrece
«Seguir arreglando» (hasta tres veces). Sobre la lista del log aparece «Arreglar los errores con
IA», que abre el chat con todos los errores. Las funciones fijas (fase 2 y 3, atajos, «Aprender
LaTeX», instrucciones del proyecto) están en la pestaña «Herramientas».

## Fase 2: revisión, gráficas y plataforma

| Función               | Nivel       | Acceso                                                                                                |
| --------------------- | ----------- | ----------------------------------------------------------------------------------------------------- |
| `revisor_jurado`      | `proyecto`  | Revisión y entrega › Revisor tipo jurado; cada observación se publica al pulsar «Añadir al margen»    |
| `revisar_entrega`     | `rapido`    | Revisión y entrega › Revisar antes de entregar; lista de chequeo y propuestas de ortografía/gramática |
| `revisar_importacion` | `proyecto`  | Revisión y entrega › Revisar importación, después de importar y recompilar                            |
| `grafica_datos`       | `escritura` | Gráfica desde datos; datos pegados o ruta CSV/TSV/TXT del proyecto                                    |
| `soporte`             | `rapido`    | Plataforma `/latex#soporte`, enlazada desde el editor                                                 |

Las tres revisiones leen el proyecto completo en el servidor, con etiquetas de datos, límite sin
recortes silenciosos y caché de Anthropic. Exigen aceptar la estimación antes de consultar, incluso
la revisión rápida. El soporte usa solo una base de ayuda pública: no recibe el proyecto, sus
instrucciones ni datos privados de cuentas. Todas las llamadas pasan por `servicio.consultar()`.

Las propuestas muestran **Enviar a revisión**. El contenedor del editor activa temporalmente el
seguimiento nativo con la identidad real del solicitante y conserva esa identidad hasta enviar las
operaciones pendientes. Restaura después la última elección del interruptor de seguimiento. Cada
cambio mantiene su aceptación/rechazo individual en Control de cambios; un comentario nativo
indica **«IA, pedido por …»**. No se inventan usuarios robot ni se fuerza una identidad que el
servidor rechazaría. Se admiten comentarios legacy y history-ot. Publicar un comentario requiere
permiso de comentar; proponer cambios requiere escritura y seguimiento. Si falla la identificación,
la propuesta sigue en revisión y el panel muestra un aviso.

El jurado devuelve JSON estricto `{explicacion, comentarios: [{archivo, cita, comentario}]}` (máximo
12). El servidor comprueba pertenencia, ruta, cita literal y única y contenido actual, también al
publicarla. No se publican observaciones automáticamente ni se guardan respuestas en eventos.

Las gráficas devuelven JSON estricto `{explicacion, script}`. El servidor antepone los datos
originales, estilo Matplotlib y `ruta_pdf`; el nombre deriva del evento propio de `grafica_datos`:
`graficas/grafica-EVENTO.py` y `.pdf`. Guardar crea el documento por `EditorController`, sin
sobrescribir scripts modificados. La ejecución es otro clic y reutiliza **PythonExecutionProvider**
y el ejecutor Pyodide de Extended CE, que sube sus resultados al proyecto. El filtro estático de
código rechaza patrones obvios de red/ejecución dinámica; **no es un aislamiento completo**. Revisa
el script, columnas, ajuste, incertidumbres y unidades antes de ejecutarlo. El panel no promete
que cualquier script generado vaya a funcionar.

Nuevo proyecto ofrece **Importar desde Prism (ZIP)** y la opción nativa **Documento Word**. Prism reutiliza la
subida ZIP nativa; Word, la conversión DOCX de CLSI con su validación, permisos y limpieza. El archivo importado se abre antes de cualquier consulta de IA:
recompila y pide «Revisar importación». La imagen del fork instala Pandoc y ZIP, ausentes en la base, y establece `ENABLE_PANDOC_CONVERSIONS=true` para el conversor nativo de CLSI. Puedes sobrescribirlo al ejecutar la imagen; también habilita las conversiones nativas que controla esa variable. En producción, `latex-server` fija esta misma imagen para Pandoc y configura el grupo de conversiones sin el init de Overleaf, manteniendo su aislamiento.

**Registro de uso › Generar declaración** produce una sección LaTeX determinista (sin costo ni
modelo), delimitada por `% AEMCICD-IA-DECLARACION-INICIO` / `-FIN`. Se valida de nuevo contra el
registro y documento actuales antes de aplicar. Puedes actualizarla, retirarla o editarla como texto
normal. El aviso de responsabilidad aparece en el panel y al quitar la marca desde CodeMirror.
El registro incluye envíos a revisión, comentarios publicados y scripts guardados: **no certifica
la aceptación final ni su presencia en la versión entregada**. Retirar la sección no borra el registro.

La plataforma está desplegada desde el [PR #79](https://github.com/AEMCiCD-YT/aemcicd-platform/pull/79):
soporte con la sesión LaTeX del estudiante y panel agregado `/programa-latex/ia`. Solo se concede
CORS con credenciales a `https://plataforma.aemcicd.org` para soporte, sesión de soporte y resumen.
Se agrega ese origen a la comprobación global de Overleaf; los POST conservan CSRF y las demás
rutas no obtienen permisos CORS. El resumen exige administrador del servidor; la plataforma exige
además permisos de lectura/gestión del programa. No transmite documentos ni identificadores de
usuarios/proyectos. Puede traerse con un clic del administrador o cargarse como JSON de
`ia-resumen`. Además, `latex-sync` envía automáticamente los totales del mes actual y del
anterior cada cinco minutos aproximadamente, por HTTPS y con su token existente. El conector
se implementó y desplegó en `latex-server`; la plataforma confirmó ambos meses en producción.
La IA permanece habilitada para estudiantes mediante `AEMCICD_AI_ENABLED=true` y
`AEMCICD_AI_ONLY_ADMINS=false`, conservados en la configuración versionada de `latex-server`.
Cada estudiante debe activarla en su panel antes de consultar.

## Fase 3: investigación, aprendizaje y trabajo en equipo

Desplegada el 2 de noviembre de 2026, tras unir el PR 7 a `ext-ce`. Es la última fase prevista.
Conserva proveedores, crédito, topes, eventos sin contenido y revisión humana.

| Función                   | Nivel      | Interfaz                                                                                                                                 |
| ------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `bibliografia_verificada` | `rapido`   | Investigación y PDF: tema o hasta cinco DOI, y `.bib` propio; consulta Crossref, verifica DOI y propone BibTeX construido en el servidor |
| `citas_faltantes`         | `rapido`   | Investigación y PDF: revisa respaldo y claves; rechaza claves de cita literales nuevas que no existen en los `.bib` enviados             |
| `chat_pdf`                | `proyecto` | Selector de hasta tres PDF propios; texto extraído en el servidor y etiquetado por ruta/página, sin OCR ni lectura de figuras            |
| `tutor_latex`             | `rapido`   | Modo Aprender LaTeX y menú de selección; explicación, ejemplo y ejercicio                                                                |
| `resumen_cambios`         | `rapido`   | Botón junto al Historial o intervalo en el panel; diferencias nativas sin metadatos de autores                                           |
| `revision_equipo`         | `proyecto` | Equipo y notación; comentarios revisables con las mismas comprobaciones del jurado                                                       |
| `beamer`, `poster`        | `proyecto` | Presentar y exportar; propuestas de archivo nuevo, sin sobrescribir el original                                                          |
| `coherencia_notacion`     | `proyecto` | Equipo y notación; propuestas mínimas sujetas a revisión                                                                                 |
| `codigo_algoritmo`        | `rapido`   | Menú de selección; documento `.tex` nuevo con `algorithm2e` o `listings`, conservando el código original                                 |

PDF, historial y bibliografía usan `usaContexto`; el proyecto completo conserva `usaProyecto`.
Ambos pasan por la estimación y confirmación del servicio común. Las etiquetas `pagina_pdf`,
`historial` y `referencias_verificadas` tienen el mismo tratamiento de datos no confiables.
Crossref recibe solo el tema o los DOI escritos, nunca archivos ni identificadores añadidos
por el módulo. No se consulta doi.org ni una URL devuelta por el proveedor. No hay búsqueda web
de pago, ni llamadas al AI SDK fuera de `servicio.consultar()` en la aplicación.

Un PDF tiene como máximo 10 MiB, 100 páginas y 500 000 caracteres extraídos; el conjunto conserva
el límite configurable de tokens del proyecto. Un PDF sin texto se rechaza con aviso de OCR.
El historial limita el intervalo a 500 versiones, 20 archivos y 200 000 caracteres. No se recorta
silenciosamente; para archivos binarios y eliminados solo se comunica la operación.

Los documentos generados (Beamer, póster y código a algoritmo) devuelven `{explicacion,contenido}`. El servidor verifica el tipo de documento
LaTeX y deriva el nombre de su evento. «Guardar como archivo nuevo» exige escritura y un evento
propio de esa función y proyecto. Usa `EditorController.addDoc`, nunca una escritura de documento
en Mongo. El guardado se registra como metadatos; el contenido pertenece al proyecto y su historial.
«Descartar» no crea archivos. Un archivo existente con contenido distinto no se sobrescribe.

**Word** usa `useConvertProject` de Overleaf y descarga un DOCX mediante CLSI/Pandoc. **Plantillas**
se muestran en la galería nativa y crean un proyecto nuevo con `createProjectFromSnippet`; no
consumen crédito de IA. Son seis estructuras iniciales, no formatos oficiales de carreras o revistas.
La imagen habilita la galería; puede deshabilitarse explícitamente con `OVERLEAF_TEMPLATE_GALLERY=false`.

Rutas añadidas (sesión y CSRF en las escrituras; permisos nativos sobre el proyecto):

- `GET /project/:id/aemcicd-ai/archivos`: rutas PDF y `.bib`, sin contenido; lectura.
- `POST /project/:id/aemcicd-ai/bibliografia`: crear `referencias.bib` si falta; escritura.
- `POST /project/:id/aemcicd-ai/documento`: guardar Beamer/póster/algoritmo tras decisión del estudiante; escritura.
- `GET /aemcicd-ai/plantillas`: catálogo inicial, con sesión.
- `POST /aemcicd-ai/plantillas/:plantilla`: proyecto nuevo del usuario autenticado, con límite por minuto.

[Pruebas, capturas y límites](../../../../aemcicd/docs/ia-fase-3/verificacion.md).

## Propuestas verificables

Las funciones de cambios devuelven exclusivamente JSON:

```json
{
  "explicacion": "Explicación breve en español, con Markdown opcional.",
  "cambios": [
    {
      "archivo": "main.tex",
      "antes": "La velocidad es v_0.",
      "despues": "La velocidad es $v_0$."
    }
  ]
}
```

No se admiten campos extra, rutas absolutas o con `..`, archivos ajenos al contexto, cambios
superpuestos ni texto original inexistente o ambiguo. Máximo ocho bloques, de 30 000 caracteres
por texto. Una inserción con `antes: ""` requiere un destino explícito validado contra el
documento reciente. Reescribir solo puede reemplazar la selección original y conserva comandos,
argumentos de citas/referencias/etiquetas y fórmulas, incluidos los entornos matemáticos habituales.
Los bloques de un mismo archivo se agrupan en una sola propuesta atómica.

El servidor añade `docId`, `desde`, `hasta` y `huella` (SHA-256 del documento). El panel muestra
«Ver diferencias» y «Aplicar / Descartar»; solo quien tiene escritura ve «Aplicar». Al aplicar,
se comprueban de nuevo evento propio, proyecto y documento reciente en `/validar-cambio`.
El cliente abre el archivo, espera a que se una el editor y vuelve a ubicar el texto original y
comprobar los permisos antes de despachar una operación CodeMirror. ShareJS y el historial reciben
esa misma edición. El texto original se ubica por contenido (`ubicar` en `cambios.mjs` y
`aplicar.ts`): primero en la posición prevista y, si el archivo cambió en otra parte, donde
aparezca una sola vez. Solo una edición que cambie ese texto, o lo repita, exige repetir la
consulta. La huella se usa únicamente para inserciones puras (`antes: ""`).

Las funciones con propuesta piden **salida estructurada** al API (`ESQUEMA_CAMBIOS` en
`cambios.mjs`): el modelo no puede responder fuera del formato. En Claude se fuerza el modo nativo
(`structuredOutputMode: 'outputFormat'`); sin eso el SDK, que no reconoce los modelos 5.5,
enviaría una herramienta forzada que esos modelos rechazan con un 400. «Corregir con IA» recibe
también el preámbulo (del archivo o, si es un capítulo, del documento principal), para poder
proponer el `\usepackage` que falta; los cambios solo pueden tocar el fragmento del error o ese
preámbulo. En «reescribir» se tolera un salto de línea final de más en `antes`.

El contenido del proyecto llega a la IA sin entidades HTML (`&` y `<` son LaTeX); solo se
neutralizan los cierres de nuestras etiquetas de datos. Se rechaza un `despues` con entidades HTML
nuevas (`&amp;`…), y el JSON de la respuesta se acepta también entre cercas ```json. El servidor nunca escribe una
propuesta en Mongo ni mediante document-updater.

Después de editar, se llama al registro existente con `eventoId` y la ruta. Si falla el registro,
el panel ofrece reintentarlo sin volver a aplicar. El registro solo acepta una ruta del proyecto;
los eventos nuevos se vinculan al proyecto y no pueden registrarse en otro.

El JSON de cambios se acumula solo en memoria durante el flujo y se valida antes de mostrarlo.
Si el modelo da un formato inválido o altera una fórmula, se muestra un aviso sin botón de
aplicación; se informa el costo real de la consulta ya realizada. No se conserva la respuesta.

## Configuración (variables del contenedor)

| Variable                                  | Valor por defecto            | Uso                                                                                     |
| ----------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------- |
| `AEMCICD_AI_ENABLED`                      | (apagada)                    | `true` para activar                                                                     |
| `AEMCICD_AI_ONLY_ADMINS`                  | `false`                      | `true`: solo los administradores ven la IA (pruebas en producción)                      |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`     |                              | Claves; con una sola, todo va a ese proveedor                                           |
| `AEMCICD_AI_MONTHLY_CREDIT_USD`           | `1`                          | Crédito por estudiante y mes calendario                                                 |
| `AEMCICD_AI_BUDGET_CLAUDE_USD`            | `450`                        | Tope del servidor con Claude por ciclo                                                  |
| `AEMCICD_AI_BUDGET_OPENAI_USD`            | `340`                        | Tope del servidor con OpenAI por ciclo                                                  |
| `AEMCICD_AI_CYCLE_DAY_CLAUDE` / `_OPENAI` | `1` / `6`                    | Día en que empieza cada ciclo                                                           |
| `AEMCICD_AI_ROUTES`                       | sección 5 del diseño         | JSON con el modelo principal y la alternativa de cada nivel                             |
| `AEMCICD_AI_PRICES`                       | precios de noviembre de 2026 | JSON para corregir o añadir precios                                                     |
| `AEMCICD_AI_ALERT_EMAIL`                  |                              | Correo que recibe el aviso de presupuesto agotado                                       |
| `AEMCICD_AI_MAX_PROJECT_TOKENS`           | `150000`                     | Límite del contexto de texto del proyecto, estimado conservadoramente; nunca se recorta |

En el servidor, las claves vienen del Key Vault y el resto de `latex-server/personalizacion/variables.env`.

El crédito por estudiante, los dos topes y los días de ciclo los fija la plataforma (Programa LaTeX →
Configuración → Asistente de IA). El conector `latex-sync` los guarda con
`node modules/aemcicd-ai/scripts/ajustes.mjs '<json>'` en `aemcicdAiAjustes` y el módulo los relee
cada minuto, sin reiniciar. Las variables de esta tabla solo rigen mientras no lleguen.

La imagen del fork activa `ENABLE_PANDOC_CONVERSIONS=true` e instala Pandoc y ZIP para la conversión nativa de Word. Sobrescribir esa variable con `false` desactiva esas conversiones y sus menús; no desactiva el asistente de IA.

## Rutas

| Ruta                                             | Permiso                                                                                        |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `GET /aemcicd-ai/estado`                         | sesión                                                                                         |
| `POST /aemcicd-ai/activar`                       | sesión                                                                                         |
| `POST /aemcicd-ai/eventos/:id/valoracion`        | sesión, evento propio                                                                          |
| `POST /project/:id/aemcicd-ai/consulta`          | leer el proyecto; respuesta en NDJSON; 12 por minuto                                           |
| `POST /project/:id/aemcicd-ai/foto`              | leer el proyecto; mismo crédito, límite por minuto y NDJSON que `/consulta`                    |
| `POST /project/:id/aemcicd-ai/estimacion`        | leer el proyecto; no llama al modelo ni cobra; devuelve tokens, modelos y cota en microdólares |
| `GET /project/:id/aemcicd-ai/instrucciones`      | leer el proyecto; informa si existe el archivo                                                 |
| `POST /project/:id/aemcicd-ai/instrucciones`     | escribir; crea la plantilla si no existe                                                       |
| `POST /project/:id/aemcicd-ai/validar-cambio`    | escribir; comprueba evento propio y ubica el texto en el documento actual, sin modificarlo     |
| `GET /project/:id/aemcicd-ai/registro`           | leer el proyecto                                                                               |
| `POST`/`DELETE /project/:id/aemcicd-ai/registro` | escribir en el proyecto                                                                        |

Rutas adicionales de fase 2:

| Ruta                                              | Permisos y resultado                                                        |
| ------------------------------------------------- | --------------------------------------------------------------------------- |
| `POST /project/:id/aemcicd-ai/validar-comentario` | escribir; evento propio, cita actual del proyecto; no publica               |
| `POST /project/:id/aemcicd-ai/grafica`            | escribir; evento propio de gráfica, crea script y registra ruta; no ejecuta |
| `POST /project/:id/aemcicd-ai/declaracion`        | escribir; prepara inserción/actualización/retirada, sin modificar documento |
| `GET /aemcicd-ai/soporte/sesion`                  | sesión; estado, saldo y token CSRF; `no-store`                              |
| `POST /aemcicd-ai/soporte`                        | sesión y activación; crédito común, 12/min, CSRF                            |
| `GET /aemcicd-ai/resumen?mes=AAAA-MM`             | administrador; totales de `ia-resumen`, sin contenido ni identificadores    |

## Datos en Mongo

`aemcicdAiUsuarios`, `aemcicdAiCreditos`, `aemcicdAiPresupuestos`, `aemcicdAiEventos`,
`aemcicdAiRegistro` y `aemcicdAiAjustes` (un solo documento con crédito, topes y ciclos). Ninguna guarda el texto de documentos ni de preguntas. El registro de un
proyecto se borra cuando el proyecto se elimina definitivamente (hook `projectExpired`).

Resumen agregado del mes: `node modules/aemcicd-ai/scripts/resumen.mjs [AAAA-MM-DD]`, o desde
la laptop `bash servidor/remoto.sh ia-resumen` en `latex-server`.

## Pruebas

Las pruebas usan MongoDB real y modelos simulados del AI SDK; no gastan créditos. Fuera del
monorepo (sin instalar todo Overleaf):

```bash
mkdir /tmp/ia-pruebas && cd /tmp/ia-pruebas && npm init -y >/dev/null
npm install ai@6.0.170 @ai-sdk/anthropic@3.0.72 @ai-sdk/openai@3.0.54 zod@4 mongodb@6 mongodb-memory-server express@4
cp -r <fork>/services/web/modules/aemcicd-ai/{app,test} . && node --test test/unit/*.test.mjs
```

Con `MONGO_URL` se usa ese Mongo en lugar de uno temporal.

Pruebas de interfaz y capturas sin arrancar Overleaf: [test/interfaz/README.md](test/interfaz/README.md).
Se usan los componentes reales y CodeMirror, con adaptadores del entorno de Overleaf y transporte
simulado. Esto no sustituye una prueba de integración de ShareJS con Mongo y Redis.

## Añadir una función

Cada función es una entrada de `FUNCIONES` en `app/src/funciones.mjs`, con su nivel (`rapido`,
`proyecto` o `escritura`), el máximo de tokens de salida y cómo arma la consulta. El crédito, el
enrutador, los eventos y el 👍/👎 funcionan sin cambios.
