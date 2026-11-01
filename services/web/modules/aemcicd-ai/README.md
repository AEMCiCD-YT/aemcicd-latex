# aemcicd-ai: asistente de IA de LaTeX AEMCiCD

Módulo propio del fork. El diseño completo está en [`aemcicd/docs/ia-diseno.md`](../../../../aemcicd/docs/ia-diseno.md).
Este módulo contiene la **fase base** y la **fase 1** (implementada para revisión; no implica despliegue):

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

Las imágenes y los PDF de una sola página se rasterizan en el navegador a PNG de hasta 1600 px
por lado. El PDF original no se envía al servidor; el selector rechaza documentos de varias
páginas. El servidor comprueba firma de PNG/JPEG/WebP, dimensiones, base64 y límite de 5 MiB,
sin confiar en el MIME ni en el nombre recibido. Solo `/foto` usa un parser JSON de 7 MiB para
admitir el base64; los demás límites de Express permanecen intactos. La imagen se envía como
bloque de imagen del AI SDK. No se guarda en archivos, eventos ni Mongo.

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
El cliente abre el archivo, espera a que se una el editor y vuelve a comprobar la huella y los
permisos antes de despachar una operación CodeMirror. ShareJS y el historial reciben esa misma
edición. Una edición concurrente exige repetir la consulta. El servidor nunca escribe una
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
| `POST /project/:id/aemcicd-ai/validar-cambio`    | escribir; comprueba evento propio y huella reciente, sin modificar contenido                   |
| `GET /project/:id/aemcicd-ai/registro`           | leer el proyecto                                                                               |
| `POST`/`DELETE /project/:id/aemcicd-ai/registro` | escribir en el proyecto                                                                        |

## Datos en Mongo

`aemcicdAiUsuarios`, `aemcicdAiCreditos`, `aemcicdAiPresupuestos`, `aemcicdAiEventos` y
`aemcicdAiRegistro`. Ninguna guarda el texto de documentos ni de preguntas. El registro de un
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
