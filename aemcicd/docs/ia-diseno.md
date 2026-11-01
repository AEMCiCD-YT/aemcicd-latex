# IA en LaTeX AEMCiCD: documento de diseño

**Estado:** propuesta para revisión de la directiva. Todavía no hay código.
**Fecha:** 1 de noviembre de 2026.
**Alcance:** servidor `latex.aemcicd.org` (este fork de Overleaf Extended CE) y la plataforma
`plataforma.aemcicd.org` (panel del Programa LaTeX).

## 1. Objetivo

Añadir un asistente de IA (Claude) dentro del editor LaTeX del programa, como **beneficio incluido**
en el piloto, sin subir el precio ($2 al mes o $10 por semestre).

La IA ayuda a **escribir LaTeX y a mejorar el documento**: no es un generador de tareas. El
estudiante siempre decide: la IA propone y él acepta o rechaza.

Contexto: OpenAI cierra Prism (editor LaTeX con IA) el **1 de enero de 2027**. La fase 2 termina
antes de esa fecha para recibir a quienes se queden sin herramienta.

## 2. Decisiones ya tomadas

| Tema | Decisión |
|---|---|
| Proveedor | API de Claude (Anthropic), con los ~$500 mensuales de créditos de la asociación. El cupo «API de Claude» del Programa IA está cerrado para reservar esos créditos. |
| Modelos | Mezcla aproximada **80 % Claude Haiku 5.5 / 20 % Claude Sonnet 5.5**, elegida por función (sección 5). Opus no se usa. |
| Crédito | **$1 de IA por estudiante al mes**, medido por **costo real** (no por número de consultas), con **barra de saldo** visible. Se reinicia el día 1 de cada mes y no se acumula. |
| Precio del programa | Sin cambios: $2/mes o $10/semestre. |
| Uso opcional | La IA se activa por estudiante, tras leer un aviso corto. Quien no la activa no envía nada a Anthropic. |
| Datos | Solo análisis interno de uso, sin contenido. **No se venden ni se entregan a nadie**, tampoco a la universidad (sección 9). |
| Soporte | Asistente de soporte en la plataforma y en el editor; **no** en WhatsApp. |

## 3. Funciones y fases

Selección de la directiva: áreas 1 a 7 completas; del área 8, coherencia de notación y de código a
algoritmo; área 9 completa; del área 11, las instrucciones del proyecto; del área 12, el asistente
de soporte y la medición del piloto.

### Base (primero, debajo de todo)

- Módulo de IA aislado en el fork, con conexión al API **solo desde el servidor**.
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
   ├─ elige el modelo y limita max_tokens según el saldo
   ├─ llama al API de Claude (clave solo en el servidor)
   ├─ cobra el costo real y guarda el evento (sin contenido)
   └─ devuelve la respuesta en streaming
   ▼
API de Claude (Anthropic)
```

### Módulo `aemcicd-ai`

- Vive aislado en `services/web/modules/aemcicd-ai`, como los demás cambios del fork, para que
  las actualizaciones de Extended CE choquen lo menos posible.
- Se registra en `moduleImportSequence` de `server-ce/config/settings.js`.
- Partes:
  - `app/src/`: router, controlador, cliente de Claude, cálculo de costo, crédito, registro y
    eventos.
  - `frontend/js/`: panel lateral de IA, botón en los errores del log, barra de saldo, diálogos.
  - `test/`: pruebas unitarias con el cliente de Claude simulado (sin gastar créditos).
- Rutas (todas requieren sesión; las de proyecto, permiso de lectura o escritura según la acción):
  - `POST /project/:id/ai/:funcion` (respuesta en streaming).
  - `GET /ai/saldo`.
  - `POST /ai/activar`.
  - `POST /ai/eventos/:id/valoracion` (👍/👎).
  - `GET|DELETE /project/:id/ai/registro`.
- Textos de la interfaz en `aemcicd/locales/es.json`, como el resto de la traducción.

### Cliente de Claude

- SDK oficial `@anthropic-ai/sdk`, con streaming.
- **Caché de prompts** para las funciones que leen todo el proyecto: la segunda pregunta sobre el
  mismo proyecto cuesta alrededor del 10 % de la primera en la parte cacheada.
- Imágenes (foto a LaTeX) como bloques de imagen; tamaño máximo y reducción en el navegador antes
  de enviar.
- Reintentos con espera ante sobrecarga; nunca más de uno por consulta.

### Configuración (variables del contenedor)

| Variable | Uso | Valor inicial |
|---|---|---|
| `AEMCICD_AI_ENABLED` | Interruptor general | `true` |
| `ANTHROPIC_API_KEY` | Clave del API, solo para LaTeX | Key Vault |
| `AEMCICD_AI_MONTHLY_CREDIT_USD` | Crédito por estudiante | `1` |
| `AEMCICD_AI_GLOBAL_BUDGET_USD` | Tope mensual de todo el servidor | `450` |
| `AEMCICD_AI_MODEL_FAST` / `_SMART` | Modelos | `claude-haiku-5-5` / `claude-sonnet-5-5` |

### La clave del API

- Se crea en la consola de Anthropic **solo para LaTeX**, con **límite de gasto mensual** propio.
  Es un segundo tope, independiente del nuestro.
- **No se comparte por chat ni se guarda en el repositorio.** La persona responsable la guarda
  directamente en el Key Vault de la plataforma:

  ```bash
  az keyvault secret set --vault-name kv-aemcicd-platform-prod -n latex-ai-anthropic-key --value '<clave>'
  ```

- `latex-server/servidor/instalar-remoto.sh` la lee del Key Vault y la pasa como parámetro
  protegido, igual que `latex-smtp-password`. `instalar.sh` la escribe en la configuración del
  Toolkit (solo legible por root).
- Rotación: se guarda una versión nueva en el Key Vault y se vuelve a ejecutar
  `instalar-remoto.sh`.

## 5. Modelos por función

| Modelo | Funciones |
|---|---|
| **Haiku 5.5** | Errores y advertencias, fórmulas desde texto, tablas desde Excel, ortografía, soporte, de código a algoritmo, resumen del historial |
| **Sonnet 5.5** | Foto a LaTeX, reescribir selección, chat con el proyecto, esqueletos, revisor tipo jurado, coherencia de notación, gráficas estilo Origin, Beamer y pósteres, importaciones |

Si el saldo restante no alcanza para una consulta de Sonnet, se ofrece hacerla con Haiku o
esperar al mes siguiente. El reparto 80/20 se mide en el panel y se ajusta moviendo funciones de
un modelo a otro.

## 6. Crédito de $1 al mes

### Precios de referencia (por millón de tokens)

| Modelo | Entrada | Salida |
|---|---|---|
| Claude Haiku 5.5 | $0,10 | $0,50 |
| Claude Sonnet 5.5 | $2,00 | $10,00 |

La búsqueda web de Claude (bibliografía, fase 3) cuesta unos $10 por cada 1.000 búsquedas y
también se descuenta del crédito. Los precios se guardan en la configuración del módulo para
actualizarlos sin cambiar código.

### Cómo se cobra

1. **Antes** de llamar al API se calcula el costo máximo posible: tokens de entrada contados más
   `max_tokens` de salida. Si supera el saldo, se reduce `max_tokens` o se rechaza la consulta con
   un mensaje claro.
2. Ese máximo se **reserva** en el saldo, de forma atómica en Mongo, para que dos pestañas a la
   vez no se pasen del tope.
3. **Después**, con el uso real que devuelve el API (incluidos los tokens de caché), se cobra el
   costo exacto y se libera el resto de la reserva.
4. Si la suma del mes de todo el servidor llega a `AEMCICD_AI_GLOBAL_BUDGET_USD`, la IA se pausa
   hasta el mes siguiente y se avisa a la directiva por correo.

Los importes se guardan en **micro-dólares enteros** para evitar errores de redondeo.

### Barra de saldo

- En el panel de IA: «Te quedan $0,62 de $1,00 este mes · se renueva el 1 de diciembre».
- Cada respuesta indica su costo aproximado.
- Las funciones que leen todo el proyecto muestran una estimación antes de ejecutarse.

### Proyección de costo

Uso típico (~200 consultas al mes, mezcla 80/20): unos **$0,67 por estudiante al mes**, dentro
del crédito. El máximo posible es $1 por estudiante: con 400 estudiantes, $400 al mes, dentro de
los ~$500 de créditos. En la práctica será menos, porque no todos agotan su crédito.

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

### Qué se envía a Anthropic

Solo lo necesario para cada consulta: la selección, los archivos o el log que use la función, las
instrucciones del proyecto y, en su caso, la imagen. Solo de estudiantes que activaron la IA.
Según los términos comerciales del API de Anthropic, estos datos no se usan para entrenar sus
modelos. La retención vigente se revisará y se citará en el aviso de privacidad antes del
lanzamiento.

### Qué guarda la AEMCiCD

| Dato | Dónde | Contenido | Quién lo ve |
|---|---|---|---|
| Saldo mensual | Mongo del servidor | Usuario, mes, gastado y reservado | El estudiante (su barra) |
| Eventos de uso | Mongo del servidor | Identificador interno, función, modelo, tokens, costo, 👍/👎, fecha. **Sin el texto** de documentos ni de preguntas | Agregado, en el panel de la plataforma |
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
  **totales mensuales**: estudiantes que usan la IA, consultas y costo por función y por modelo,
  porcentaje de 👍, y cuántos agotan el crédito.
- El panel `/programa-latex` de la plataforma muestra esas cifras para decidir la oferta.
- Ningún dato individual sale del servidor LaTeX hacia la plataforma.

## 10. Seguridad

- **La clave nunca llega al navegador.** Todas las llamadas pasan por el módulo.
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
- **Aviso de privacidad** del programa: qué se envía a Anthropic, qué se guarda y la política de
  datos de la sección 9.
- **Mensaje y flyer:** «IA incluida» y la línea «Tus documentos y tu uso de la IA no se venden ni
  se entregan a nadie».

## 12. Riesgos

| Riesgo | Mitigación |
|---|---|
| Gasto mayor que los créditos | Crédito por estudiante, tope global y límite en la consola de Anthropic |
| Las funciones de proyecto completo gastan mucho | Caché de prompts, estimación previa, Haiku cuando alcanza |
| La IA inventa referencias o comandos | Bibliografía verificada contra el DOI; todo cambio se revisa antes de aplicarse |
| Uso para hacer tareas completas | Presentarla como asistente de LaTeX y escritura; registro y declaración de uso |
| Actualizaciones de Extended CE rompen el módulo | Módulo aislado y pruebas propias; probar cada versión antes de construir la imagen |
| Anthropic no disponible | Mensaje claro en el panel; el editor sigue funcionando sin IA |
| Desconfianza sobre los datos | Política de la sección 9 escrita en el aviso y en la comunicación |

## 13. Mantenimiento y despliegue

- El módulo se construye dentro de la imagen del fork (`aemcicd/Dockerfile`) y se despliega como
  hasta ahora: `az acr build`, fijar el digest en `latex-server/servidor/instalar.sh` y ejecutar
  `instalar-remoto.sh`.
- Las pruebas usan un cliente de Claude simulado; una prueba manual con la clave real se hace en
  producción con una cuenta de prueba antes de abrir la IA a los estudiantes.
- Cada actualización de Extended CE: fusionar, pasar las pruebas del módulo, probar el panel y
  recién entonces construir la imagen.
- Revisión mensual en el panel: costo total, reparto entre modelos, 👍/👎 y funciones poco usadas.

## 14. Pendientes antes de empezar

1. Luz verde de la directiva a este documento.
2. Clave del API de Claude solo para LaTeX, con límite de gasto mensual, guardada en el Key Vault
   como `latex-ai-anthropic-key` (sección 4).
3. Verificar la retención de datos vigente del API de Anthropic para el aviso de privacidad.
4. Verificar cómo escribe archivos `python-runner` (sección 7), antes de la fase 2.
