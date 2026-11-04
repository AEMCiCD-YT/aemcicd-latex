# Agente del documento: despliegue de producción

Instalado el **3 de noviembre de 2026** en `latex.aemcicd.org`. La IA sigue habilitada para
estudiantes (`AEMCICD_AI_ONLY_ADMINS=false`), con $1 de crédito mensual y los topes de $450
(Claude) y $340 (OpenAI). No cambiaron variables, secretos ni el contrato con la plataforma.

## Versiones

| Imagen                           | Origen                                                                  | Digest                                                                    | Estado                                  |
| -------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------- |
| `6.3.0-ext-v5.1-agente-32c05de1` | [PR 10](https://github.com/AEMCiCD-YT/aemcicd-latex/pull/10), ACR `cjk` | `sha256:af5f82c0…78be`                                                    | Instalada y sustituida                  |
| `6.3.0-ext-v5.1-agente-5af185e8` | [PR 11](https://github.com/AEMCiCD-YT/aemcicd-latex/pull/11), ACR `cjm` | `sha256:bf5809d4…cb25`                                                    | Fijada; sustituida antes de comprobarla |
| `6.3.0-ext-v5.1-agente-669d2381` | [PR 12](https://github.com/AEMCiCD-YT/aemcicd-latex/pull/12), ACR `cjn` | `sha256:87eccfb064ac223282c40344431e17765e417b0d386f73f2c5b9787a20d79a83` | **En producción**                       |

Una primera construcción etiquetada `agente-11f29294` se hizo desde `ext-ce` antes del merge del
PR 10 y contiene el código de la fase 3; nunca se fijó en el instalador.

Respaldo previo a la primera instalación: `backups/2026-11-03T1719Z` (`remoto.sh backup`,
«backup terminado»).

## Comprobaciones en producción

- `remoto.sh comando`: el servicio de compilación (CLSI) arranca con
  `unset ANTHROPIC_API_KEY OPENAI_API_KEY` y existe `pdf-hijo.mjs` (lectura de PDF aislada).
- `remoto.sh ia-estado`: habilitada, dos proveedores, «aemcicd-ai: listo».
- Con los modelos reales:
  - TikZ sin bibliotecas: «Arreglar los errores con IA» corrigió los errores con una propuesta
    aplicable (GPT-6.1 Terra, $0,0023).
  - «La tabla se sale del margen» en un archivo sin tablas: el agente lo indicó sin proponer
    cambios.
  - PDF de 7 páginas con destino «Reemplazar todo main.tex»: transcripción completa que compila
    (Claude Sonnet 5.5, $0,1366).

## Problemas encontrados y corregidos el mismo día

- `agente-32c05de1`: «Consultar con este costo» rechazaba los PDF de varias páginas, porque la
  estimación no contaba las etiquetas de página. Corregido en el PR 11; si el costo cambia entre
  estimar y confirmar, el panel muestra la estimación nueva.
- `agente-5af185e8`: con un PDF adjunto, «reemplázalo» no podía sustituir el archivo completo.
  El PR 12 añade el destino «Reemplazar todo el archivo» y permite al agente reescribirlo cuando
  se le pide expresamente.

## Pendiente

- Casos `agente-*` ejecutados el 4 de noviembre: 7 de 8 correctas ([informe](../../ia-eval/informes/2026-11-04-agente.md)); repetir el de la tabla con la instrucción nueva.
- Probar el flujo con estudiantes en un proyecto con capítulos (`\input`) y tablas reales.
