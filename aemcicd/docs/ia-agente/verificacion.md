# Agente del documento y PDF de varias páginas: verificación

Comprobado el **3 de noviembre de 2026** en una imagen local construida desde esta rama
(Overleaf completo con Mongo y Redis). Las respuestas del modelo se simularon con el texto real
del documento; no se llamó a Anthropic ni a OpenAI.

## Caso de las pruebas con usuarios (TikZ que no compila)

Documento con `\node (b) [draw, right=of a]` y `\draw[-{Stealth}]` sin
`\usetikzlibrary{positioning,arrows.meta}`. Proyecto sin declaración de uso de IA, así que los
cambios van a Control de cambios.

| Paso                                    | Resultado                                                                                                                           |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Compilar                                | 2 errores y 1 advertencia de PGF; aparece «Arreglar los errores con IA» encima del log                                              |
| Pulsar el botón                         | Consulta `agente` con `archivo`, `cursor` y los 3 diagnósticos; no envía el texto del documento                                     |
| Enviar a revisión (añade `arrows.meta`) | El chat sigue a la vista; recompila solo y muestra «Sigue habiendo 1 error» con «Seguir arreglando» / «Dejarlo así»                 |
| Seguir arreglando                       | La consulta lleva el historial (2 turnos) y los diagnósticos nuevos; tras aplicar, «Compila sin errores» y el PDF muestra la flecha |
| Pedir un cambio con 3 líneas elegidas   | Chips «main.tex», «3 líneas», «Todo el proyecto»; la consulta lleva `desde`/`hasta` y 4 turnos de historial                         |

## Foto o PDF a LaTeX con varias páginas

PDF de 25 páginas: el panel pide el rango (máximo 20). Con las páginas 2–5 se generan 4 JPEG en
el navegador (el mayor, 27 KB en base64); la estimación real del servidor, sin reenviar las
imágenes, fue de 11 193 tokens y $0,158 de costo máximo con la alternativa. `/foto` recibió las
4 páginas y el `maximoAceptadoMicro` estimado.

## Seguridad

En el contenedor, el proceso web tiene las dos claves y el compilador (CLSI) ninguna:
`/etc/service/clsi-overleaf/run` contiene `unset ANTHROPIC_API_KEY OPENAI_API_KEY`.

## Pruebas automáticas

- 118 pruebas unitarias del módulo (`node --test test/unit/*.test.mjs`).
- Banco aislado (`test/interfaz/pruebas.mjs` y `fase3.mjs`) actualizado a las pestañas
  «Conversación» y «Herramientas», con pruebas del agente, del rango de PDF y de la estimación.
- Recorrido en Overleaf completo: `test/interfaz/agente-overleaf.cjs` (requiere la imagen
  local, el usuario de prueba y TikZ en el TeX Live del contenedor).
- Cuatro casos nuevos en `aemcicd/ia-eval/casos.json` (`agente-*`): TikZ sin bibliotecas,
  tabla que se sale del margen, diagrama insertado en el cursor y pregunta sin cambios. Falta
  ejecutarlos con los modelos reales:

```bash
EVAL_CASOS=agente-tikz-libreria,agente-tabla-margen,agente-diagrama-cursor,agente-solo-pregunta bash aemcicd/ia-eval/evaluar.sh --rutas
```

## Capturas

| Captura                                                   | Qué muestra                                 |
| --------------------------------------------------------- | ------------------------------------------- |
| [Log](capturas/claro-a1-log.png)                          | Botón «Arreglar los errores con IA»         |
| [Seguimiento](capturas/claro-a3-seguimiento.png)          | Recompilación y «Sigue habiendo 1 error»    |
| [Compila (oscuro)](capturas/oscuro-a4-compila.png)        | Segundo intento y «Compila sin errores»     |
| [Contexto](capturas/claro-a5-chips.png)                   | Chips de archivo, selección y proyecto      |
| [Herramientas](capturas/claro-a6-herramientas.png)        | Atajos y funciones de las fases 2 y 3       |
| [Rango de páginas (oscuro)](capturas/oscuro-a7-rango.png) | Elección de páginas de un PDF de 25         |
| [Estimación](capturas/claro-a8-estimacion.png)            | Costo máximo antes de transcribir 4 páginas |
