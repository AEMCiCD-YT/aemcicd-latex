# LaTeX AEMCiCD: cambios propios sobre Overleaf Extended CE

Este fork de [yu-i-i/overleaf-cep](https://github.com/yu-i-i/overleaf-cep) contiene los cambios de la AEMCiCD.
Los despliega [AEMCiCD-YT/latex-server](https://github.com/AEMCiCD-YT/latex-server), y las cuentas las gestiona
[AEMCiCD-YT/aemcicd-platform](https://github.com/AEMCiCD-YT/aemcicd-platform).

El código modificado se publica aquí, como pide la AGPL, y el pie de página del servidor enlaza a este repositorio.

## Qué cambia

| Cambio | Archivos |
|---|---|
| Traducción completa al español (2 635 textos que Overleaf no tenía) | `aemcicd/locales/es.json`, fusionado en `services/web/locales/es.json` |
| Colores de la asociación: acento rojo oscuro (contraste 5:1 con blanco) y enlaces en el azul de la marca | `frontend/stylesheets/foundations/colors.scss`, `components/nav.scss`, `components/tabs.scss`, `components/radio-chip.scss`, `abstracts/mixins.scss` |
| Logo y favicons de la AEMCiCD | `services/web/public/img/aemcicd/`, `services/web/public/favicon*`, `apple-touch-icon.png` |
| Aviso para cuentas suspendidas, configurable (`OVERLEAF_SUSPENDED_ACCOUNT_TEXT`) | `server-ce/config/settings.js`, `UserPagesController.mjs`, `views/user/accountSuspended.pug` |

Los textos concretos, como el pie, el aviso de suspensión y la URL del logo, se configuran en
`latex-server/personalizacion/variables.env`, no aquí.

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
