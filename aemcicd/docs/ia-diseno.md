# IA en LaTeX AEMCiCD: documento de diseño

**Estado:** propuesta para revisión de la directiva. Todavía no hay código.
**Fecha:** 1 de noviembre de 2026.
**Alcance:** servidor `latex.aemcicd.org` (este fork de Overleaf Extended CE) y la plataforma
`plataforma.aemcicd.org` (panel del Programa LaTeX).

## 1. Objetivo

Añadir un asistente de IA (Claude y GPT) dentro del editor LaTeX del programa, como **beneficio incluido**
en el piloto, sin subir el precio ($2 al mes o $10 por semestre).

La IA ayuda a **escribir LaTeX y a mejorar el documento**: no es un generador de tareas. El
estudiante siempre decide: la IA propone y él acepta o rechaza.

Contexto: OpenAI cierra Prism (editor LaTeX con IA) el **1 de enero de 2027**. La fase 2 termina
antes de esa fecha para recibir a quienes se queden sin herramienta.

## 2. Decisiones ya tomadas

| Tema | Decisión |
|---|---|
| Proveedores | **Dos fuentes de crédito** (sección 6): API de Claude (Anthropic), ~$500 al mes, con el cupo «API de Claude» del Programa IA cerrado para reservarlos; y API de OpenAI, **$380 por ciclo** (del 6 de cada mes al 6 del siguiente; $62 prorrateados hasta el 6 de noviembre). |
| Modelos | Mezcla aproximada **80 % modelos rápidos / 20 % modelos avanzados**, elegida por función (sección 5). Rápidos: Claude Haiku 5.5 y GPT-6 Luna. Avanzados: Claude Sonnet 5.5, GPT-6.1 Terra y GPT-6.1 Sol. No se usan Opus ni GPT-6 Astra. |
| Crédito | **$1 de IA por estudiante al mes**, medido por **costo real** (no por número de consultas), con **barra de saldo** visible. Se reinicia el día 1 de cada mes y no se acumula. |
| Precio del programa | Sin cambios: $2/mes o $10/semestre. |
| Uso opcional | La IA se activa por estudiante, tras leer un aviso corto. Quien no la activa no envía nada a Anthropic. |
| Datos | Solo análisis interno de uso, sin contenido. **No se venden ni se entregan a nadie**, tampoco a la universidad (sección 9). |
| Soporte | Asistente de soporte en la plataforma y en el editor; **no** en WhatsApp. |

## 3. Funciones y fases

Selección de la directiva: áreas 1 a 7 completas; del área 8, coherencia de notación y de código a
algoritmo; área 9 completa; del área 11, las instrucciones del proyecto; del área 12, el asistente
de soporte y la medición del piloto.

### Resumen

| Fase | Cuándo | Áreas |
|---|---|---|
| **Base** | Primera semana de trabajo | 9 (registro de uso), 12 (medición del piloto) y la infraestructura común |
| **Fase 1: piloto** | Mediados de noviembre | 1 (ayuda con LaTeX), 2 (escritura, sin cambios con seguimiento), 11 (instrucciones del proyecto) |
| **Fase 2: antes del 1 de enero** | Diciembre | 2 (cambios con seguimiento), 3 (revisión académica), 7 (importar desde Prism y Word), 9 (declaración de uso), 12 (asistente de soporte), gráficas estilo Origin |
| **Fase 3: próximo semestre** | Enero y febrero | 4 (investigación), 5 (aprendizaje), 6 (trabajo en equipo), 7 (Beamer, pósteres, exportar a Word), 8 (coherencia de notación, de código a algoritmo) |

### Base (primero, debajo de todo)

- Módulo de IA aislado en el fork, con conexión a los API de Claude y de OpenAI **solo desde el
  servidor**, y cambio automático de proveedor si uno falla o agota su presupuesto.
- Evaluación comparativa inicial (sección 5) para decidir qué modelo atiende cada función.
- Crédito de $1 al mes por estudiante, con barra de saldo y tope global de seguridad.
- **Registro de uso de IA** de cada proyecto (área 9).
- **👍/👎** en cada respuesta y eventos de medición sin contenido (área 12).
- Interruptor para apagar la IA en todo el servidor sin reinstalar.

### Fase 1: piloto (mediados de noviembre)

**Área 1, ayuda con LaTeX**
- **Corregir errores con un clic:** botón en cada error del log que lo explica en español y
  propone el arreglo.
- **Advertencias:** lo mismo para avisos como `Overfull \hbox` o paquetes en conflicto.
- **Fórmulas desde texto:** «integral de 0 a infinito de e a la menos x al cuadrado» → LaTeX.
- **Foto o PDF a LaTeX:** foto del cuaderno o la pizarra → ecuación, tabla o diagrama.
- **Tablas desde Excel:** se pegan los datos y sale la tabla con `booktabs`.

**Área 2, escritura**
- **Chat con el proyecto:** conoce todos los archivos, no solo el abierto.
- **Reescribir la selección:** mejorar la redacción, dar tono académico, resumir, ampliar,
  traducir entre español e inglés.
- **Esqueletos de documentos:** informe de laboratorio, capítulos de tesis, etc.
- **Instrucciones del proyecto** (área 11): archivo `ia-instrucciones.md` en el proyecto
  («informe de Bioquímica, en inglés, formato IEEE»), que se añade a cada consulta.

En la fase 1 las propuestas se muestran como **diferencias** en el panel, con «Aplicar» y
«Descartar».

### Fase 2: antes del 1 de enero (diciembre)

- **Cambios con seguimiento** (área 2): la IA propone sus cambios como cambios con seguimiento
  del módulo `track-changes`; el estudiante y sus compañeros los aceptan o rechazan uno por uno.
- **Revisión académica** (área 3): revisor tipo jurado con comentarios en el margen; ortografía y
  gramática en español e inglés con contexto técnico; lista de chequeo de entrega.
- **Importar proyectos de Prism y de Word** (área 7): la IA arregla lo que no compile tras la
  importación.
- **Declaración de uso de IA** (área 9): ver la sección 8.
- **Asistente de soporte** (área 12): en `plataforma.aemcicd.org/latex` y en el panel del editor.
- **Gráficas estilo Origin** (sección 7).

### Fase 3: próximo semestre (enero y febrero)

- **Investigación** (área 4): bibliografía verificada contra el DOI, citas faltantes, chat con
  los PDF del proyecto.
- **Aprendizaje** (área 5): modo tutor de LaTeX y plantillas de la AEMCiCD y de las carreras.
- **Trabajo en equipo** (área 6): resumen de cambios a partir del historial; la IA como revisora
  del grupo.
- **Presentaciones** (área 7): de informe a Beamer y a póster (tikzposter o beamerposter);
  exportar a Word.
- **Matemáticas y ciencia** (área 8): coherencia de notación entre capítulos; de código (Python,
  C) a pseudocódigo con `algorithm2e` o a listado formateado.

### Fuera de alcance

- Autocompletado mientras se escribe: consume créditos de forma continua.
- Verificación simbólica de cálculos, accesibilidad, ayuda a Tesorería y glosario personal.
- Que la IA escriba por su cuenta en el documento sin que el estudiante lo pida y lo acepte.

## 4. Arquitectura

```
Navegador (panel de IA, React)
   │  fetch con la sesión y el token CSRF de Overleaf
   ▼
web de Overleaf: módulo services/web/modules/aemcicd-ai
   ├─ comprueba sesión, permiso sobre el proyecto, IA activada y saldo
   ├─ arma el contexto (selección, archivos, log, instrucciones del proyecto)
   ├─ elige proveedor y modelo, y limita max_tokens según el saldo
   ├─ llama al API (claves solo en el servidor)
   ├─ cobra el costo real y guarda el evento (sin contenido)
   └─ devuelve la respuesta en streaming
   ▼
API de Claude (Anthropic)  ·  API de OpenAI
```

### Módulo `aemcicd-ai`

- Vive aislado en `services/web/modules/aemcicd-ai`, como los demás cambios del fork, para que
  las actualizaciones de Extended CE choquen lo menos posible.
- Se registra en `moduleImportSequence` de `server-ce/config/settings.js`.
- Partes:
  - `app/src/`: router, controlador, proveedores (`proveedores/claude.mjs`,
    `proveedores/openai.mjs`), enrutador de modelos, cálculo de costo, crédito, registro y eventos.
  - `frontend/js/`: panel lateral de IA, botón en los errores del log, barra de saldo, diálogos.
  - `test/`: pruebas unitarias con proveedores simulados (sin gastar créditos).
- Rutas (todas requieren sesión; las de proyecto, permiso de lectura o escritura según la acción):
  - `POST /project/:id/ai/:funcion` (respuesta en streaming).
  - `GET /ai/saldo`.
  - `POST /ai/activar`.
  - `POST /ai/eventos/:id/valoracion` (👍/👎).
  - `GET|DELETE /project/:id/ai/registro`.
- Textos de la interfaz en `aemcicd/locales/es.json`, como el resto de la traducción.

### Proveedores

Una interfaz común (`responder(peticion) → flujo de texto + uso`) con dos implementaciones:

- **Claude:** SDK oficial `@anthropic-ai/sdk`, con streaming y **caché de prompts** explícita.
- **OpenAI:** SDK oficial `openai` (API Responses), con streaming; la caché de entrada es
  automática.

En ambos:

- En las funciones que leen todo el proyecto, la caché abarata mucho las preguntas siguientes
  sobre el mismo proyecto (la parte cacheada cuesta entre el 5 % y el 10 % del precio normal).
- Imágenes (foto a LaTeX): tamaño máximo y reducción en el navegador antes de enviar.
- Ante sobrecarga, un solo reintento; si vuelve a fallar, se pasa al otro proveedor con el
  modelo equivalente.
- Los prompts se escriben una vez y se adaptan al formato de cada proveedor; las pruebas los
  ejecutan contra ambos simulados.

### Configuración (variables del contenedor)

| Variable | Uso | Valor inicial |
|---|---|---|
| `AEMCICD_AI_ENABLED` | Interruptor general | `true` |
| `ANTHROPIC_API_KEY` | Clave del API de Claude, solo para LaTeX | Key Vault |
| `OPENAI_API_KEY` | Clave del API de OpenAI, solo para LaTeX | Key Vault |
| `AEMCICD_AI_MONTHLY_CREDIT_USD` | Crédito por estudiante | `1` |
| `AEMCICD_AI_BUDGET_CLAUDE_USD` | Tope mensual del servidor con Claude (ciclo del día 1) | `450` |
| `AEMCICD_AI_BUDGET_OPENAI_USD` | Tope del servidor con OpenAI (ciclo del día 6) | `340` |
| `AEMCICD_AI_ROUTES` | Proveedor y modelo de cada función (sección 5) | archivo JSON en la imagen |

### Las claves de los API

- Una clave **solo para LaTeX** en cada consola (Anthropic y OpenAI; en OpenAI, un proyecto
  propio «LaTeX AEMCiCD»), cada una con **límite de gasto mensual**. Es un segundo tope,
  independiente del nuestro.
- **No se comparten por chat ni se guardan en el repositorio.** La persona responsable las guarda
  directamente en el Key Vault de la plataforma:

  ```bash
  az keyvault secret set --vault-name kv-aemcicd-platform-prod -n latex-ai-anthropic-key --value '<clave>'
  az keyvault secret set --vault-name kv-aemcicd-platform-prod -n latex-ai-openai-key --value '<clave>'
  ```

- `latex-server/servidor/instalar-remoto.sh` las lee del Key Vault y las pasa como parámetros
  protegidos, igual que `latex-smtp-password`. `instalar.sh` las escribe en la configuración del
  Toolkit (solo legible por root). Si falta una, la IA funciona solo con el otro proveedor.
- Rotación: se guarda una versión nueva en el Key Vault y se vuelve a ejecutar
  `instalar-remoto.sh`.

## 5. Modelos por función

### Asignación inicial

| Nivel | Funciones | Modelo inicial | Alternativa |
|---|---|---|---|
| **Rápido** | Errores y advertencias, fórmulas desde texto, tablas desde Excel, ortografía, soporte, de código a algoritmo, resumen del historial | GPT-6 Luna | Claude Haiku 5.5 |
| **Avanzado, proyecto completo** | Chat con el proyecto, revisor tipo jurado, coherencia de notación, Beamer y pósteres, importaciones | GPT-6.1 Terra | Claude Sonnet 5.5 |
| **Avanzado, escritura y visión** | Reescribir selección, esqueletos, foto a LaTeX, gráficas estilo Origin | Claude Sonnet 5.5 | GPT-6.1 Sol |

Criterios de esta asignación inicial:

- Los modelos rápidos de ambos cuestan lo mismo; se empieza por OpenAI para usar su crédito, que
  vence cada ciclo.
- Las funciones que leen todo el proyecto son las que más tokens gastan: GPT-6.1 Terra cuesta la
  mitad que Sonnet o Sol.
- Para la escritura y la visión se empieza por Sonnet, que consume el crédito de Claude.

La asignación vive en un archivo de configuración (`AEMCICD_AI_ROUTES`) y se cambia sin tocar
código.

### Evaluación comparativa (base)

Antes de abrir la fase 1 se prueba un conjunto de unos 40 casos reales y anónimos (errores de
compilación, fórmulas, fotos de cuaderno, tablas, párrafos para reescribir) con los modelos de
cada nivel. Se compara si compila, si es correcto, la calidad del español y el costo, y se ajusta
la tabla de arriba. Durante el piloto, el 👍/👎 por modelo confirma o corrige esa elección.

### Reglas del enrutador

1. Usa el modelo asignado a la función.
2. Si ese proveedor falla, agotó su presupuesto del ciclo o está apagado, usa la alternativa.
3. Si el saldo del estudiante no alcanza para el modelo avanzado, ofrece hacerlo con uno rápido o
   esperar al mes siguiente.
4. Botón **«Probar con otro modelo»** en cada respuesta: repite la consulta con la alternativa
   (se cobra aparte). Sirve también para medir cuál prefieren los estudiantes.

El reparto 80/20 entre rápidos y avanzados se mide en el panel y se ajusta moviendo funciones de
nivel.

## 6. Crédito de $1 al mes

### Precios de referencia (por millón de tokens)

| Modelo | Entrada | Entrada en caché | Salida |
|---|---|---|---|
| Claude Haiku 5.5 | $0,10 | $0,01 | $0,50 |
| GPT-6 Luna | $0,10 | $0,01 | $0,50 |
| GPT-6.1 Terra | $1,00 | $0,05 | $5,00 |
| GPT-6.1 Sol | $2,00 | $0,10 | $10,00 |
| Claude Sonnet 5.5 | $2,00 | $0,20 | $10,00 |

Precios de lista de noviembre de 2026; en OpenAI, hasta 272 000 tokens de entrada por consulta.
La búsqueda web (bibliografía, fase 3) cuesta unos $10 por cada 1.000 búsquedas y también se
descuenta del crédito. Los precios se guardan en la configuración del módulo para actualizarlos
sin cambiar código.

### Dos fuentes de crédito

| Fuente | Monto | Ciclo | Tope del servidor |
|---|---|---|---|
| API de Claude | ~$500 al mes | Mes calendario | $450 |
| API de OpenAI | $380 (equivale a 19 asientos estándar de ChatGPT a $20) | Del 6 de cada mes al 6 del siguiente | $340 |
| **Total** | **~$880** | | **$790** |

- Del 1 al 6 de noviembre OpenAI tiene solo $62 prorrateados. La IA abre a mediados de mes, así
  que no afecta al piloto.
- Si cambia el número de asientos, cambia el crédito de OpenAI: se ajusta
  `AEMCICD_AI_BUDGET_OPENAI_USD`.
- Cada proveedor lleva su propio contador y su propio ciclo. El crédito del estudiante es uno
  solo, en dólares, sin importar qué proveedor responda.
- El margen de ~10 % entre crédito y tope cubre diferencias de redondeo y consultas en curso.

### Cómo se cobra

1. **Antes** de llamar al API se calcula el costo máximo posible: tokens de entrada contados más
   `max_tokens` de salida. Si supera el saldo, se reduce `max_tokens` o se rechaza la consulta con
   un mensaje claro.
2. Ese máximo se **reserva** en el saldo, de forma atómica en Mongo, para que dos pestañas a la
   vez no se pasen del tope.
3. **Después**, con el uso real que devuelve el API (incluidos los tokens de caché), se cobra el
   costo exacto y se libera el resto de la reserva.
4. Si un proveedor llega a su tope del ciclo, el enrutador pasa al otro y se avisa a la
   directiva por correo. Si ambos llegan al tope, la IA se pausa hasta que se renueve alguno.

Los importes se guardan en **micro-dólares enteros** para evitar errores de redondeo.

### Barra de saldo

- En el panel de IA: «Te quedan $0,62 de $1,00 este mes · se renueva el 1 de diciembre».
- Cada respuesta indica su costo aproximado.
- Las funciones que leen todo el proyecto muestran una estimación antes de ejecutarse.

### Proyección de costo

Uso típico (~200 consultas al mes, mezcla 80/20): unos **$0,67 por estudiante al mes** con solo
Claude, y algo menos con la asignación de la sección 5, porque las funciones de proyecto completo
pasan a GPT-6.1 Terra.

El máximo posible es $1 por estudiante:

| Estudiantes | Gasto máximo | Dentro de los ~$790 de topes |
|---|---|---|
| 100 | $100 | Sí, sobra mucho |
| 400 | $400 | Sí |
| 790 | $790 | Es el límite |

En la práctica será menos, porque no todos agotan su crédito.

### Qué hacer con el crédito adicional

Con OpenAI, el presupuesto casi se duplica. Propuesta:

- **Piloto:** mantener **$1 por estudiante**. Lo que sobre queda como colchón y permite que las
  funciones de proyecto completo y las gráficas estilo Origin no agoten el crédito de Claude.
- **Después del piloto,** con el gasto real del panel, decidir entre:
  - subir el crédito a $1,50 o $2, o
  - aceptar más estudiantes con el mismo crédito.

Los créditos de ambos proveedores vencen cada ciclo: lo que no se usa no se acumula.

## 7. Gráficas estilo Origin (fase 2)

OriginLab no puede usarse (licencia de pago, solo Windows, no se ejecuta en el servidor). Se
reproduce su resultado con Python:

- Estilo **«AEMCiCD-Origin»** para matplotlib: marcas hacia adentro en los cuatro lados, marco
  grueso, tipografía y paleta similares.
- Ajustes de curvas con tabla de parámetros: lineal con R², exponencial, gaussiana, lorentziana,
  Michaelis-Menten y ecuaciones propias (SciPy).
- Gráficas de laboratorio: calibración (Beer-Lambert), titulación con punto de equivalencia,
  UV-Vis, IR con eje invertido, DRX, cinética, Arrhenius, detección de picos, corrección de línea
  base, doble eje Y y barras de error.
- Datos desde Excel pegado o archivos CSV/TXT de los equipos.

Flujo:

1. El estudiante sube sus datos y pide la gráfica.
2. Claude escribe el script y lo guarda en el proyecto (por ejemplo, `graficas/calibracion.py`).
3. El script se ejecuta con el **ejecutor de Python de Extended CE** (`modules/python-runner`,
   Pyodide en el navegador del estudiante), sin costo de servidor.
4. Sale una figura vectorial en PDF, lista para `\includegraphics`. Si cambian los datos, se
   vuelve a ejecutar.

El script **solo se ejecuta cuando el estudiante lo pide**, nunca automáticamente.

**Por verificar antes de construir:** si `python-runner` puede escribir archivos de salida en el
proyecto o si hay que añadir ese paso en `aemcicd-ai`, y qué paquetes de Pyodide (NumPy, SciPy,
matplotlib) carga.

## 8. Registro y declaración de uso de IA

### Registro de uso (base)

- Cada acción aceptada queda registrada en el proyecto: fecha, persona, función y un resumen
  breve, por ejemplo «corrigió un error en `cap2.tex`» o «reescribió un párrafo de la
  introducción».
- **Solo lo ven** el estudiante y los colaboradores del proyecto. La AEMCiCD no lo consulta.
- Se borra al borrar el proyecto y puede vaciarse desde el panel.

### Declaración de uso (fase 2)

- **No se inserta sola.** Botón «Generar declaración de uso de IA», que la arma a partir del
  registro y la inserta como una sección normal del documento.
- El estudiante puede **editarla o borrarla**. Al generarla y al borrarla aparece este aviso:

  > Algunas materias, revistas y la normativa de la universidad exigen declarar el uso de IA. Si
  > la borras, lo haces bajo tu responsabilidad.

- Borrar la declaración **no** borra el registro, así que puede volver a generarse.
- Los términos dirán que la declaración es una ayuda y que **declarar o no el uso de IA es
  responsabilidad del estudiante**.

## 9. Datos y privacidad

### Qué se envía a Anthropic y a OpenAI

Solo lo necesario para cada consulta: la selección, los archivos o el log que use la función, las
instrucciones del proyecto y, en su caso, la imagen. Solo de estudiantes que activaron la IA, y
solo al proveedor que atienda esa consulta.

Según los términos comerciales de ambos API, estos datos no se usan para entrenar sus modelos. La
retención vigente de cada proveedor se revisará y se citará en el aviso de privacidad antes del
lanzamiento. El aviso nombra a los dos proveedores.

### Qué guarda la AEMCiCD

| Dato | Dónde | Contenido | Quién lo ve |
|---|---|---|---|
| Saldo mensual | Mongo del servidor | Usuario, mes, gastado y reservado | El estudiante (su barra) |
| Eventos de uso | Mongo del servidor | Identificador interno, función, proveedor, modelo, tokens, costo, 👍/👎, fecha. **Sin el texto** de documentos ni de preguntas | Agregado, en el panel de la plataforma |
| Registro del proyecto | Mongo del servidor | Resumen breve de cada acción aceptada | Estudiante y colaboradores |
| Conversación del panel | Navegador | Texto de la conversación | Solo el estudiante; no se guarda en el servidor |

### Política de datos del programa

1. **Qué se analiza:** solo métricas de uso del programa y de la IA (funciones usadas, crédito
   gastado, 👍/👎, renovaciones), sin el contenido de documentos ni de preguntas.
2. **Para qué:** solo decisiones internas de la AEMCiCD: ampliar la oferta, ajustar el crédito o
   los precios, priorizar funciones.
3. **Quién lo ve:** la directiva y los responsables del programa, en forma agregada, desde el
   panel de la plataforma.
4. **Lo que no se hace:** los datos **no se venden ni se entregan a nadie**, tampoco a la
   universidad, ni siquiera de forma anónima.
5. **Única excepción:** una orden de autoridad competente. Se entrega solo lo que la orden exija y
   se avisa al estudiante, salvo que la orden lo prohíba.
6. **Registro de uso de IA:** solo lo ven el estudiante y sus colaboradores; la AEMCiCD no lo
   consulta; se borra con el proyecto.

Esto cumple el principio de finalidad informada de la LOPDP siempre que el aviso de privacidad lo
diga **antes** de activar la IA.

### Medición del piloto en la plataforma

- El conector (`latex-sync`) ya enlaza el servidor con la plataforma. Se amplía para enviar
  **totales mensuales**: estudiantes que usan la IA, consultas y costo por función, por proveedor
  y por modelo, porcentaje de 👍 por modelo, cuántos agotan el crédito y el saldo de cada fuente
  de crédito.
- El panel `/programa-latex` de la plataforma muestra esas cifras para decidir la oferta.
- Ningún dato individual sale del servidor LaTeX hacia la plataforma.

## 10. Seguridad

- **Las claves nunca llegan al navegador.** Todas las llamadas pasan por el módulo.
- **Permisos:** cada ruta comprueba sesión, token CSRF y permiso sobre el proyecto. Quien solo
  puede leer un proyecto puede preguntar, pero no aplicar cambios.
- **Contenido no confiable:** un documento puede traer texto escrito para manipular a la IA. El
  contenido va marcado como datos; la IA no ejecuta nada, no tiene acceso a la red salvo la
  búsqueda web de la fase 3, y toda modificación necesita la aprobación del estudiante.
- **Scripts de Python:** se ejecutan solo en el navegador del estudiante (Pyodide), cuando él lo
  pide.
- **Abuso:** tamaño máximo por consulta, una consulta a la vez por estudiante y límite por minuto,
  además del crédito.
- **Cuentas suspendidas** por el conector pierden también la IA.

## 11. Cambios en términos, aviso y comunicación

Antes de activar la IA:

- **Términos del Programa LaTeX:** la IA es un beneficio opcional sujeto a disponibilidad; crédito
  mensual de $1 no acumulable; uso académico responsable; la responsabilidad sobre la declaración
  de uso de IA es del estudiante.
- **Aviso de privacidad** del programa: qué se envía a Anthropic y a OpenAI, qué se guarda y la política de
  datos de la sección 9.
- **Mensaje y flyer:** «IA incluida» y la línea «Tus documentos y tu uso de la IA no se venden ni
  se entregan a nadie».

## 12. Riesgos

| Riesgo | Mitigación |
|---|---|
| Gasto mayor que los créditos | Crédito por estudiante, tope por proveedor y límite en cada consola |
| Cambia o se retira el crédito de OpenAI | Todo funciona solo con Claude; se ajusta el tope o el crédito por estudiante |
| Resultados distintos según el proveedor | Evaluación comparativa, 👍/👎 por modelo y botón «Probar con otro modelo» |
| Las funciones de proyecto completo gastan mucho | Caché de prompts, estimación previa, Haiku cuando alcanza |
| La IA inventa referencias o comandos | Bibliografía verificada contra el DOI; todo cambio se revisa antes de aplicarse |
| Uso para hacer tareas completas | Presentarla como asistente de LaTeX y escritura; registro y declaración de uso |
| Actualizaciones de Extended CE rompen el módulo | Módulo aislado y pruebas propias; probar cada versión antes de construir la imagen |
| Un proveedor no disponible | Cambio automático al otro; si ambos fallan, mensaje claro y el editor sigue funcionando sin IA |
| Desconfianza sobre los datos | Política de la sección 9 escrita en el aviso y en la comunicación |

## 13. Mantenimiento y despliegue

- El módulo se construye dentro de la imagen del fork (`aemcicd/Dockerfile`) y se despliega como
  hasta ahora: `az acr build`, fijar el digest en `latex-server/servidor/instalar.sh` y ejecutar
  `instalar-remoto.sh`.
- Las pruebas usan proveedores simulados; una prueba manual con las claves reales se hace en
  producción con una cuenta de prueba antes de abrir la IA a los estudiantes.
- Los modelos cambian con frecuencia: cuando un proveedor anuncie el retiro de uno, se cambia en
  `AEMCICD_AI_ROUTES` y se repite la evaluación comparativa.
- Cada actualización de Extended CE: fusionar, pasar las pruebas del módulo, probar el panel y
  recién entonces construir la imagen.
- Revisión mensual en el panel: costo total, reparto entre modelos, 👍/👎 y funciones poco usadas.

## 14. Pendientes antes de empezar

1. Luz verde de la directiva a este documento.
2. Claves de los API de Claude y de OpenAI solo para LaTeX, con límite de gasto mensual,
   guardadas en el Key Vault como `latex-ai-anthropic-key` y `latex-ai-openai-key` (sección 4).
3. Verificar la retención de datos vigente de ambos API para el aviso de privacidad.
4. Verificar cómo escribe archivos `python-runner` (sección 7), antes de la fase 2.
