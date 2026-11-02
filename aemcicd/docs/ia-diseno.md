# IA en LaTeX AEMCiCD: documento de diseño

**Estado:** fase base y fases 1 y 2 desplegadas en producción. IA habilitada para estudiantes, con activación individual opcional. La fase 3 sigue planificada; no hay una fase 4 definida.
**Actualizado:** 2 de noviembre de 2026.
**Evidencia:** [despliegue y comprobaciones de producción](ia-fase-2/despliegue.md).
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

| Tema                | Decisión                                                                                                                                                                                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Proveedores         | **Dos fuentes de crédito** (sección 6): API de Claude (Anthropic), ~$500 al mes, con el cupo «API de Claude» del Programa IA cerrado para reservarlos; y API de OpenAI, **$380 por ciclo** (del 6 de cada mes al 6 del siguiente; $62 prorrateados hasta el 6 de noviembre). |
| Modelos             | Mezcla aproximada **80 % modelos rápidos / 20 % modelos avanzados**, elegida por función (sección 5). Rápidos: Claude Haiku 5.5 y GPT-6 Luna. Avanzados: Claude Sonnet 5.5, GPT-6.1 Terra y GPT-6.1 Sol. No se usan Opus ni GPT-6 Astra.                                     |
| Crédito             | **$1 de IA por estudiante al mes**, medido por **costo real** (no por número de consultas), con **barra de saldo** visible. Se reinicia el día 1 de cada mes y no se acumula.                                                                                                |
| Precio del programa | Sin cambios: $2/mes o $10/semestre.                                                                                                                                                                                                                                          |
| Uso opcional        | La IA se activa por estudiante, tras leer un aviso corto. Quien no la activa no envía consultas a los proveedores de IA.                                                                                                                                                     |
| Datos               | Solo análisis interno de uso, sin contenido. **Las métricas no se venden ni se entregan a terceros**, tampoco a la universidad. El contexto de cada consulta sí se procesa por el proveedor de IA elegido (sección 9).                                                       |
| Soporte             | Asistente de soporte en la plataforma y en el editor; **no** en WhatsApp.                                                                                                                                                                                                    |

## 3. Funciones y fases

Selección de la directiva: áreas 1 a 7 completas; del área 8, coherencia de notación y de código a
algoritmo; área 9 completa; del área 11, las instrucciones del proyecto; del área 12, el asistente
de soporte y la medición del piloto.

### Resumen

| Fase                             | Cuándo                    | Áreas                                                                                                                                                           |
| -------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Base**                         | Primera semana de trabajo | 9 (registro de uso), 12 (medición del piloto) y la infraestructura común                                                                                        |
| **Fase 1: piloto**               | Mediados de noviembre     | 1 (ayuda con LaTeX), 2 (escritura, sin cambios con seguimiento), 11 (instrucciones del proyecto)                                                                |
| **Fase 2: antes del 1 de enero** | Diciembre                 | 2 (cambios con seguimiento), 3 (revisión académica), 7 (importar desde Prism y Word), 9 (declaración de uso), 12 (asistente de soporte), gráficas estilo Origin |
| **Fase 3: próximo semestre**     | Enero y febrero           | 4 (investigación), 5 (aprendizaje), 6 (trabajo en equipo), 7 (Beamer, pósteres, exportar a Word), 8 (coherencia de notación, de código a algoritmo)             |

### Base (primero, debajo de todo)

- Módulo de IA aislado en el fork, con conexión a los API de Claude y de OpenAI **solo desde el
  servidor**, y cambio automático de proveedor si uno falla o agota su presupuesto.
- Evaluación comparativa inicial (sección 5) para decidir qué modelo atiende cada función.
- Crédito de $1 al mes por estudiante, con barra de saldo y tope global de seguridad.
- **Registro de uso de IA** de cada proyecto (área 9).
- **👍/👎** en cada respuesta y eventos de medición sin contenido (área 12).
- Interruptor para apagar la IA en todo el servidor sin reinstalar.

### Fase 1: piloto (desplegada)

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

Implementación: catálogo `FUNCIONES`, lector del proyecto en el servidor, estimación previa del
chat y propuestas JSON verificadas. El README del módulo especifica las rutas y el contrato
completo de cambios: `{explicacion, cambios: [{archivo, antes, despues}]}`. El servidor verifica
pertenencia, texto exacto, selección y conservación de comandos/fórmulas; añade coordenadas y una
huella SHA-256. Los bloques de un archivo se agrupan para aplicarse juntos. Antes de aplicar,
servidor y cliente vuelven a ubicar el texto original **por su contenido**: si el estudiante o un
compañero siguieron escribiendo en otra parte del archivo, el cambio se aplica igual; solo se
rechaza si ese texto cambió o quedó repetido. La huella solo se usa para inserciones puras
(`antes: ""`), que no tienen texto que buscar. El contenido del proyecto llega a la IA tal cual
(sin entidades HTML: `&` y `<` son LaTeX); solo se neutralizan los cierres de las etiquetas de
datos (`</documento` → `<\/documento`). Se rechaza una propuesta que introduzca entidades HTML,
y la respuesta JSON se acepta aunque venga entre cercas ```json. La escritura se hace mediante CodeMirror,
con la misma vía colaborativa del editor, y luego se registra la ruta aceptada. No se guardan
prompts, imágenes ni respuestas.

El selector rasteriza en el navegador las imágenes y los PDF de una página a PNG de hasta
1600 px; el servidor valida la firma, dimensiones y máximo de 5 MiB del resultado. No se envía
el PDF original. Los proyectos completos tienen un límite configurable de 150 000 tokens
estimados; si se excede, no se envía un contexto parcial. La estimación incluye la alternativa
y se vuelve a comprobar al confirmar; un costo mayor requiere una nueva confirmación.

La verificación local cubre Mongo temporal, peticiones HTTP simuladas y componentes reales;
la fase 2 amplía la comprobación a Overleaf completo con Mongo/Redis y colaboración entre
pestañas. En producción se comprobaron arranque, importación Word y compilación PDF. Siguen
pendientes la batería con las API reales y la colaboración entre cuentas distintas. Las
capturas y comandos están en `services/web/modules/aemcicd-ai/test/interfaz/` y en la
[comprobación de fase 2](ia-fase-2/verificacion.md).

### Fase 2: desplegada el 2 de noviembre de 2026

Unida a `ext-ce` y desplegada como imagen `a5`, junto con la plataforma y el conector de
`latex-server`. `latex-sync` envía automáticamente el mes actual y el anterior cada cinco
minutos aproximadamente; se confirmó su recepción en producción. Evidencia y límites en
[la comprobación local](ia-fase-2/verificacion.md) y [el despliegue](ia-fase-2/despliegue.md).

- **Cambios con seguimiento** (área 2): la IA propone sus cambios como cambios con seguimiento
  del módulo `track-changes`; el estudiante y sus compañeros los aceptan o rechazan uno por uno.
- **Revisión académica** (área 3): revisor tipo jurado con comentarios en el margen; ortografía y
  gramática en español e inglés con contexto técnico; lista de chequeo de entrega.
- **Importar proyectos de Prism y de Word** (área 7): la IA arregla lo que no compile tras la
  importación.
- **Declaración de uso de IA** (área 9): ver la sección 8.
- **Asistente de soporte** (área 12): en `plataforma.aemcicd.org/latex` y en el panel del editor.
- **Gráficas estilo Origin** (sección 7).

Implementación: los parches conservan el formato estricto de la fase 1, pero se envían como
operaciones colaborativas con seguimiento nativo y comentario «IA, pedido por …». La identidad
OT es la del estudiante real. No se inventa un autor robot. Cada cambio se acepta/rechaza por
separado en el Panel de revisión. Las observaciones del jurado usan
`{explicacion, comentarios:[{archivo,cita,comentario}]}`; la cita debe ser literal, única y vigente.
Las gráficas usan `{explicacion,script}`; el servidor antepone datos originales y ruta derivada del
evento. Guardar el script y ejecutarlo son acciones distintas del estudiante.

La declaración es determinista, delimitada por `% AEMCICD-IA-DECLARACION-INICIO` y
`% AEMCICD-IA-DECLARACION-FIN`. Se propone, valida y aplica por el editor. El registro refleja
propuestas enviadas a revisión, observaciones publicadas y scripts guardados; no conoce su
aceptación posterior ni certifica que estén en la versión final. La declaración lo explica y pide
ajustarla a los usos efectivamente incorporados.

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
  - `POST /project/:id/aemcicd-ai/consulta` y `/foto` (NDJSON).
  - `GET /aemcicd-ai/estado` (incluye saldo) y `POST /aemcicd-ai/activar`.
  - `POST /aemcicd-ai/eventos/:id/valoracion` (👍/👎).
  - `GET|POST|DELETE /project/:id/aemcicd-ai/registro`.
  - `POST /project/:id/aemcicd-ai/estimacion` y `/validar-cambio`.
  - `GET|POST /project/:id/aemcicd-ai/instrucciones`.
- Textos de la interfaz en `aemcicd/locales/es.json`, como el resto de la traducción.

### Proveedores

Una interfaz común (`responder(peticion) → flujo de texto + uso`) con dos implementaciones:

- **Claude:** AI SDK con `@ai-sdk/anthropic`, streaming y **caché de prompts** explícita.
- **OpenAI:** AI SDK con `@ai-sdk/openai` (API Responses), con streaming; la caché de entrada es
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

| Variable                        | Uso                                                    | Valor inicial             |
| ------------------------------- | ------------------------------------------------------ | ------------------------- |
| `AEMCICD_AI_ENABLED`            | Interruptor general                                    | `true`                    |
| `ANTHROPIC_API_KEY`             | Clave del API de Claude, solo para LaTeX               | Key Vault                 |
| `OPENAI_API_KEY`                | Clave del API de OpenAI, solo para LaTeX               | Key Vault                 |
| `AEMCICD_AI_MONTHLY_CREDIT_USD` | Crédito por estudiante                                 | `1`                       |
| `AEMCICD_AI_BUDGET_CLAUDE_USD`  | Tope mensual del servidor con Claude (ciclo del día 1) | `450`                     |
| `AEMCICD_AI_BUDGET_OPENAI_USD`  | Tope del servidor con OpenAI (ciclo del día 6)         | `340`                     |
| `AEMCICD_AI_ROUTES`             | Proveedor y modelo de cada función (sección 5)         | archivo JSON en la imagen |

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

### Asignación (tras la evaluación del 1 de noviembre de 2026)

| Nivel                            | Funciones                                                                                                                           | Modelo principal                  | Alternativa                       |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | --------------------------------- |
| **Rápido**                       | Errores y advertencias, fórmulas desde texto, tablas desde Excel, ortografía, soporte, de código a algoritmo, resumen del historial | GPT-6.1 Terra, esfuerzo bajo      | Claude Haiku 5.5, esfuerzo bajo   |
| **Avanzado, proyecto completo**  | Chat con el proyecto, revisor tipo jurado, coherencia de notación, Beamer y pósteres, importaciones                                 | GPT-6.1 Terra, esfuerzo medio     | Claude Sonnet 5.5, esfuerzo medio |
| **Avanzado, escritura y visión** | Reescribir selección, esqueletos, foto a LaTeX, gráficas estilo Origin                                                              | Claude Sonnet 5.5, esfuerzo medio | GPT-6.1 Sol, esfuerzo medio       |

El **esfuerzo** es cuánto razona el modelo antes de responder. Ese razonamiento no se ve, pero se
cobra como salida: Claude Haiku 5.5 y Sonnet 5.5 razonan por defecto (medio y alto).

Resultado de la evaluación (20 casos, misma instrucción que el servidor, esfuerzo por defecto):

| Modelo            | Costo por consulta | Errores encontrados al revisar                                                                             |
| ----------------- | ------------------ | ---------------------------------------------------------------------------------------------------------- |
| GPT-6 Luna        | $0,0002            | Una corrección que vuelve a fallar (`\textbf` con un párrafo dentro) y un ajuste de Overleaf que no existe |
| Claude Haiku 5.5  | $0,0004            | Afirma que `amssymb` carga `amsmath` (falso); el diagrama TikZ se cortó por el límite de salida            |
| GPT-6.1 Terra     | $0,0016            | Ninguno                                                                                                    |
| Claude Sonnet 5.5 | $0,0081            | Ninguno; respuestas más completas, pero cinco veces más caras que Terra y un diagrama cortado              |
| GPT-6.1 Sol       | $0,0028            | Sistema de ecuaciones con `cases` y `&=`, que no alinea como dice                                          |

Segunda ronda con el esfuerzo ajustado (Terra y Haiku bajo, Sonnet y Sol medio): ninguna
respuesta cortada, Terra bajó a $0,0011 por consulta y responde en 1 segundo en lugar de 2,4.
Persistían dos imprecisiones por no conocer el servidor (pedir que se «seleccione Biber» y nombrar
los menús en inglés) y Haiku usó una librería de TikZ sin cargarla; las instrucciones ahora
describen el servidor y exigen código que compile tal cual.

Por eso el nivel rápido pasa de Luna a Terra: cuesta ocho veces más, pero sigue en unos $0,32
por estudiante al mes con 200 consultas, y la función más usada (corregir errores) no puede
proponer arreglos que no compilan. El límite de salida sube de 1500 a 4000 tokens.

La asignación vive en un archivo de configuración (`AEMCICD_AI_ROUTES`) y se cambia sin tocar
código.

### Evaluación comparativa (base)

Antes de abrir la fase 1 se prueba un conjunto de casos reales y anónimos (errores de
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

| Modelo            | Entrada | Entrada en caché | Salida |
| ----------------- | ------- | ---------------- | ------ |
| Claude Haiku 5.5  | $0,10   | $0,01            | $0,50  |
| GPT-6 Luna        | $0,10   | $0,01            | $0,50  |
| GPT-6.1 Terra     | $1,00   | $0,05            | $5,00  |
| GPT-6.1 Sol       | $2,00   | $0,10            | $10,00 |
| Claude Sonnet 5.5 | $2,00   | $0,20            | $10,00 |

Precios de lista de noviembre de 2026; en OpenAI, hasta 272 000 tokens de entrada por consulta.
La búsqueda web (bibliografía, fase 3) cuesta unos $10 por cada 1.000 búsquedas y también se
descuenta del crédito. Los precios se guardan en la configuración del módulo para actualizarlos
sin cambiar código.

### Dos fuentes de crédito

| Fuente        | Monto                                                   | Ciclo                                | Tope del servidor |
| ------------- | ------------------------------------------------------- | ------------------------------------ | ----------------- |
| API de Claude | ~$500 al mes                                            | Mes calendario                       | $450              |
| API de OpenAI | $380 (equivale a 19 asientos estándar de ChatGPT a $20) | Del 6 de cada mes al 6 del siguiente | $340              |
| **Total**     | **~$880**                                               |                                      | **$790**          |

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
| ----------- | ------------ | ---------------------------- |
| 100         | $100         | Sí, sobra mucho              |
| 400         | $400         | Sí                           |
| 790         | $790         | Es el límite                 |

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

Las políticas comerciales de ambos proveedores excluyen por defecto el entrenamiento con
datos del API. Esto no equivale a retención cero: Anthropic indica eliminación ordinaria dentro
de 30 días, con excepciones; OpenAI mantiene registros de seguridad hasta 30 días, con
excepciones. El módulo envía `store: false` a OpenAI. Las condiciones detalladas, incluida la
retención por seguridad u obligación legal, están en las fuentes oficiales consultadas el
2 de noviembre de 2026: [Anthropic: entrenamiento](https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training),
[Anthropic: retención](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data)
y [OpenAI: controles de datos](https://developers.openai.com/api/docs/guides/your-data).
Los términos públicos enlazan esas fuentes. Las claves están en Key Vault, pero las consultas
salen del módulo hacia los API directos de Anthropic y OpenAI, no hacia modelos de Azure.

### Qué guarda la AEMCiCD

| Dato                   | Dónde              | Contenido                                                                                                                      | Quién lo ve                                     |
| ---------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| Saldo mensual          | Mongo del servidor | Usuario, mes, gastado y reservado                                                                                              | El estudiante (su barra)                        |
| Eventos de uso         | Mongo del servidor | Identificador interno, función, proveedor, modelo, tokens, costo, 👍/👎, fecha. **Sin el texto** de documentos ni de preguntas | Agregado, en el panel de la plataforma          |
| Registro del proyecto  | Mongo del servidor | Resumen breve de cada acción aceptada                                                                                          | Estudiante y colaboradores                      |
| Conversación del panel | Navegador          | Texto de la conversación                                                                                                       | Solo el estudiante; no se guarda en el servidor |

### Política de datos del programa

1. **Qué se analiza:** solo métricas de uso del programa y de la IA (funciones usadas, crédito
   gastado, 👍/👎, renovaciones), sin el contenido de documentos ni de preguntas.
2. **Para qué:** solo decisiones internas de la AEMCiCD: ampliar la oferta, ajustar el crédito o
   los precios, priorizar funciones.
3. **Quién lo ve:** la directiva y los responsables del programa, en forma agregada, desde el
   panel de la plataforma.
4. **Lo que no se hace:** las métricas de uso **no se venden ni se entregan a terceros**, tampoco
   a la universidad, ni siquiera de forma anónima. El envío del contexto al proveedor de IA
   para responder una consulta es el tratamiento explicado arriba.
5. **Única excepción:** una orden de autoridad competente. Se entrega solo lo que la orden exija y
   se avisa al estudiante, salvo que la orden lo prohíba.
6. **Registro de uso de IA:** solo lo ven el estudiante y sus colaboradores; la AEMCiCD no lo
   consulta; se borra con el proyecto.

El aviso se presenta antes de activar la IA y enlaza a los términos públicos. Esta descripción
del funcionamiento no sustituye una revisión jurídica del programa.

### Medición del piloto en la plataforma

- El conector (`latex-sync`) ya enlaza el servidor con la plataforma. Envía automáticamente
  **totales mensuales**: estudiantes que usan la IA, consultas y costo por función, por proveedor
  y por modelo, porcentaje de 👍 por modelo, cuántos agotan el crédito y el saldo de cada fuente
  de crédito.
- El panel `/programa-latex/ia` muestra esas cifras y la fecha de recepción para decidir la oferta.
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

El servicio está habilitado para estudiantes, pero cada estudiante activa la IA de forma opcional.
Los términos se versionan conjuntamente en la API y el frontend de la plataforma; no se
reescriben aceptaciones anteriores. Al actualizar su texto se publica una nueva versión.

Contenido de los términos y del aviso:

- **Términos del Programa LaTeX:** la IA es un beneficio opcional sujeto a disponibilidad; crédito
  mensual de $1 no acumulable; uso académico responsable; la responsabilidad sobre la declaración
  de uso de IA es del estudiante.
- **Aviso de privacidad** del programa: qué se envía a Anthropic y a OpenAI, qué se guarda y la política de
  datos de la sección 9.
- **Mensaje y flyer:** «IA incluida, de uso opcional. Tus consultas se procesan por Anthropic u
  OpenAI; AEMCiCD no vende tu información ni entrega métricas de uso a la universidad».

## 12. Riesgos

| Riesgo                                          | Mitigación                                                                                     |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Gasto mayor que los créditos                    | Crédito por estudiante, tope por proveedor y límite en cada consola                            |
| Cambia o se retira el crédito de OpenAI         | Todo funciona solo con Claude; se ajusta el tope o el crédito por estudiante                   |
| Resultados distintos según el proveedor         | Evaluación comparativa, 👍/👎 por modelo y botón «Probar con otro modelo»                      |
| Las funciones de proyecto completo gastan mucho | Caché de prompts, estimación previa, Haiku cuando alcanza                                      |
| La IA inventa referencias o comandos            | Bibliografía verificada contra el DOI; todo cambio se revisa antes de aplicarse                |
| Uso para hacer tareas completas                 | Presentarla como asistente de LaTeX y escritura; registro y declaración de uso                 |
| Actualizaciones de Extended CE rompen el módulo | Módulo aislado y pruebas propias; probar cada versión antes de construir la imagen             |
| Un proveedor no disponible                      | Cambio automático al otro; si ambos fallan, mensaje claro y el editor sigue funcionando sin IA |
| Desconfianza sobre los datos                    | Política de la sección 9 escrita en el aviso y en la comunicación                              |

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

## 14. Seguimiento tras el despliegue

1. Completar la evaluación de calidad de las funciones de fase 2 con proveedores reales.
2. Comprobar colaboración entre cuentas distintas y soporte HTTPS entre subdominios con sesiones reales.
3. Revisar periódicamente las políticas de retención, los presupuestos y las métricas del piloto.
4. Implementar la fase 3. Las claves, la ejecución explícita de Pyodide y el envío de totales ya
   están configurados o comprobados; no son pendientes de implantación.
