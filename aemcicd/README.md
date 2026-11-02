# LaTeX AEMCiCD: cambios propios sobre Overleaf Extended CE

Este fork de [yu-i-i/overleaf-cep](https://github.com/yu-i-i/overleaf-cep) contiene los cambios de la AEMCiCD.
Los despliega [AEMCiCD-YT/latex-server](https://github.com/AEMCiCD-YT/latex-server), y las cuentas las gestiona
[AEMCiCD-YT/aemcicd-platform](https://github.com/AEMCiCD-YT/aemcicd-platform).

El código modificado se publica aquí, como pide la AGPL, y el pie de página del servidor enlaza a este repositorio.

## Qué cambia

| Cambio                                                                                                                                                                                                       | Archivos                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Traducción completa al español (2 635 textos que Overleaf no tenía)                                                                                                                                          | `aemcicd/locales/es.json`, fusionado en `services/web/locales/es.json`                                                                               |
| Colores de la asociación: acento rojo oscuro (contraste 5:1 con blanco) y enlaces en el azul de la marca                                                                                                     | `frontend/stylesheets/foundations/colors.scss`, `components/nav.scss`, `components/tabs.scss`, `components/radio-chip.scss`, `abstracts/mixins.scss` |
| Logo y favicons de la AEMCiCD                                                                                                                                                                                | `services/web/public/img/aemcicd/`, `services/web/public/favicon*`, `apple-touch-icon.png`                                                           |
| Aviso para cuentas suspendidas, configurable (`OVERLEAF_SUSPENDED_ACCOUNT_TEXT`)                                                                                                                             | `server-ce/config/settings.js`, `UserPagesController.mjs`, `views/user/accountSuspended.pug`                                                         |
| Asistente de IA (módulo `aemcicd-ai`), con la dependencia `@ai-sdk/anthropic` y la variable `aemcicdAiEnabled`                                                                                               | `services/web/modules/aemcicd-ai/`, `config/settings.defaults.js`, `ExpressLocals.mjs`, `types/exposed-settings.ts`, `package.json`, `yarn.lock`     |
| Fase 1 de IA: registrar el botón en Logs, las acciones de selección y su contexto compartido mediante las extensiones existentes; es el único archivo de Overleaf modificado fuera del módulo para esta fase | `services/web/config/settings.defaults.js` (`pdfLogEntryHeaderActionComponents`, `editorFloatingMenuActions`, `rootContextProviders`)                |
| Fase 2: extensión del menú de importación y aviso al retirar la declaración                                                                                                                                  | `services/web/config/settings.defaults.js` (`projectImportMenuComponents`, `sourceEditorExtensions`)                                                 |
| Fase 2: conservar seguimiento nativo durante la operación y sincronización; restaurar la elección del usuario                                                                                                | `services/web/frontend/js/features/ide-react/editor/document-container.ts` (`withTrackedChanges`)                                                    |
| Fase 2: punto de extensión genérico para importar proyectos desde el módulo                                                                                                                                  | `services/web/frontend/js/features/project-list/components/new-project-button.tsx`                                                                   |
| Fase 2: habilitar la conversión nativa de Word en CE, cuya imagen base carece de Pandoc y ZIP                                                                                                                | `aemcicd/Dockerfile` (`pandoc`, `zip`, `ENABLE_PANDOC_CONVERSIONS=true`, sobrescribible en ejecución)                                                |
| Fase 2: explicar la exportación ZIP de Prism usando la subida nativa                                                                                                                                         | `services/web/frontend/js/features/project-list/components/new-project-button/upload-project-modal.tsx` (prop opcional `descripcion`)                |
| El envío de correo ya no escribe la configuración SMTP (con la contraseña) en el log                                                                                                                         | `app/src/Features/Email/EmailSender.mjs`                                                                                                             |

Fuera del módulo, la fase 3 modifica:

| Archivo                                                                                                       | Motivo                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `services/web/config/settings.defaults.js`                                                                    | Registrar las extensiones `historyToolbarActionComponents` y `templateGalleryActionComponents`                                                |
| `services/web/frontend/js/features/history/components/diff-view/toolbar/toolbar.tsx`                          | Renderizar la acción de IA con el intervalo de versiones seleccionado, sin sustituir el historial                                             |
| `services/web/modules/template-gallery/frontend/js/features/template-gallery/components/template-gallery.tsx` | Mostrar los puntos de partida del programa dentro de la galería nativa                                                                        |
| `services/web/package.json`                                                                                   | Pasar `pdfjs-dist` 5.1.91 de desarrollo a producción para extraer texto en el servidor; misma versión y resolución, sin regenerar `yarn.lock` |
| `aemcicd/Dockerfile`                                                                                          | Habilitar la galería nativa mediante `OVERLEAF_TEMPLATE_GALLERY=true`, sobrescribible en ejecución                                            |

Los textos concretos, como el pie, el aviso de suspensión y la URL del logo, se configuran en
`latex-server/personalizacion/variables.env`, no aquí.

## Asistente de IA

Módulo propio `services/web/modules/aemcicd-ai` (fase base: crédito, dos proveedores, medición y
panel en el editor; fase 1 desplegada: diagnósticos, escritura, visión, contexto
del proyecto, instrucciones y propuestas aplicables; fase 2: seguimiento, revisión, importación,
declaración y gráficas, con soporte y panel agregado en la plataforma). Documentación en su [README](../services/web/modules/aemcicd-ai/README.md);
Estado: base y fases 1 y 2 en producción, IA disponible para estudiantes con activación individual;
fase 3 implementada para revisión en `ia-fase-3`, todavía sin desplegar. [Despliegue y límites de verificación](docs/ia-fase-2/despliegue.md).
Diseño en [`docs/ia-diseno.md`](docs/ia-diseno.md); evaluación comparativa de modelos en
[`ia-eval/`](ia-eval/README.md).

La fase 3 incorpora bibliografía, citas, PDF, tutor, historial, equipo, presentaciones y
notación; la descarga Word y las plantillas usan capacidades nativas, sin modelo.
[Validación y límites de fase 3](docs/ia-fase-3/verificacion.md).

## Imagen

`aemcicd/Dockerfile` parte de la imagen publicada de Extended CE (`BASE`) y le copia encima los cambios. Luego
recompila el frontend y las vistas. No hace falta construir Overleaf completo.

Para construirla en el registro de la plataforma, desde Azure Cloud Shell y en la raíz del repositorio (no hace
falta Docker local):

```bash
az acr build --registry acraemcicdplatform --file aemcicd/Dockerfile --image latex-aemcicd:6.3.0-ext-v5.1-a1 .
```

La etiqueta es `<versión de Extended CE>-a<revisión propia>`. Para cada cambio de este fork, sube la revisión
(`-a2`, `-a3`…) y pon la misma etiqueta en `CEP_IMAGE` de `latex-server/servidor/instalar.sh`.

Para probarla en local:

```bash
docker build -f aemcicd/Dockerfile -t latex-aemcicd:dev .
```

## Actualizar a una versión nueva de Extended CE

1. Une la etiqueta nueva de `yu-i-i/overleaf-cep` en la rama `ext-ce` del fork. Si hay conflicto en
   `services/web/locales/es.json`, quédate con la versión de upstream.
2. Ejecuta `python3 aemcicd/merge-locales.py`. El script lista los textos nuevos que faltan. Tradúcelos en
   `aemcicd/locales/es.json`, compruébalos con
   `python3 aemcicd/check-translations.py services/web/locales/en.json aemcicd/locales/es.json` y vuelve a
   ejecutar el script.
3. Cambia `BASE` en `aemcicd/Dockerfile` y construye la imagen con la etiqueta nueva.
4. Revisa los cambios de `colors.scss` y de la vista de cuenta suspendida si upstream tocó esos archivos.
