# aemcicd-ai: asistente de IA de LaTeX AEMCiCD

Módulo propio del fork. El diseño completo está en [`aemcicd/docs/ia-diseno.md`](../../../../aemcicd/docs/ia-diseno.md).
Este módulo contiene la **fase base**:

- conexión con Claude y OpenAI solo desde el servidor (`app/src/proveedores.mjs`);
- enrutador por nivel, con cambio automático al otro proveedor (`enrutador.mjs`, `servicio.mjs`);
- crédito mensual por estudiante y presupuesto por proveedor, con reservas atómicas en Mongo
  (`saldos.mjs`);
- eventos de medición sin contenido, 👍/👎 y registro de uso de IA por proyecto;
- panel «Asistente de IA» en la barra lateral del editor, con activación, barra de saldo,
  preguntas sobre LaTeX y «Probar con otro modelo» (`frontend/`).

## Configuración (variables del contenedor)

| Variable | Valor por defecto | Uso |
|---|---|---|
| `AEMCICD_AI_ENABLED` | (apagada) | `true` para activar |
| `AEMCICD_AI_ONLY_ADMINS` | `false` | `true`: solo los administradores ven la IA (pruebas en producción) |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` | | Claves; con una sola, todo va a ese proveedor |
| `AEMCICD_AI_MONTHLY_CREDIT_USD` | `1` | Crédito por estudiante y mes calendario |
| `AEMCICD_AI_BUDGET_CLAUDE_USD` | `450` | Tope del servidor con Claude por ciclo |
| `AEMCICD_AI_BUDGET_OPENAI_USD` | `340` | Tope del servidor con OpenAI por ciclo |
| `AEMCICD_AI_CYCLE_DAY_CLAUDE` / `_OPENAI` | `1` / `6` | Día en que empieza cada ciclo |
| `AEMCICD_AI_ROUTES` | sección 5 del diseño | JSON con el modelo principal y la alternativa de cada nivel |
| `AEMCICD_AI_PRICES` | precios de noviembre de 2026 | JSON para corregir o añadir precios |
| `AEMCICD_AI_ALERT_EMAIL` | | Correo que recibe el aviso de presupuesto agotado |

En el servidor, las claves vienen del Key Vault y el resto de `latex-server/personalizacion/variables.env`.

## Rutas

| Ruta | Permiso |
|---|---|
| `GET /aemcicd-ai/estado` | sesión |
| `POST /aemcicd-ai/activar` | sesión |
| `POST /aemcicd-ai/eventos/:id/valoracion` | sesión, evento propio |
| `POST /project/:id/aemcicd-ai/consulta` | leer el proyecto; respuesta en NDJSON; 12 por minuto |
| `GET /project/:id/aemcicd-ai/registro` | leer el proyecto |
| `POST`/`DELETE /project/:id/aemcicd-ai/registro` | escribir en el proyecto |

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
npm install ai@6.0.170 @ai-sdk/anthropic@3.0.72 @ai-sdk/openai@3.0.54 zod@4 mongodb@6 mongodb-memory-server
cp -r <fork>/services/web/modules/aemcicd-ai/{app,test} . && node --test test/unit/*.test.mjs
```

Con `MONGO_URL` se usa ese Mongo en lugar de uno temporal.

## Añadir una función

Cada función es una entrada de `FUNCIONES` en `app/src/funciones.mjs`, con su nivel (`rapido`,
`proyecto` o `escritura`), el máximo de tokens de salida y cómo arma la consulta. El crédito, el
enrutador, los eventos y el 👍/👎 funcionan sin cambios.
