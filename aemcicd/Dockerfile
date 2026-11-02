# Imagen de LaTeX AEMCiCD: la imagen publicada de Overleaf Extended CE con los cambios de este
# fork encima (textos, colores, logo, aviso de cuenta suspendida, asistente de IA). Solo se
# recompilan el frontend y las vistas, así que no hace falta construir Overleaf completo.
#   docker build -f aemcicd/Dockerfile -t latex-aemcicd .
# Al actualizar Extended CE: unir la etiqueta nueva de yu-i-i/overleaf-cep en este fork, cambiar
# BASE a la misma versión, ejecutar aemcicd/merge-locales.py y construir (aemcicd/README.md).
ARG BASE=overleafcep/sharelatex:6.3.0-ext-v5.1

# ---------- Frontend (webpack) ----------
# En una etapa aparte: instalar las dependencias de desarrollo cambia las de producción, y la
# imagen no trae compilador para los módulos nativos (no se recompilan: --mode=skip-build).
FROM ${BASE} AS frontend
# La configuración dice a webpack qué componentes de módulos incluir (overleafModuleImports).
COPY services/web/config /overleaf/services/web/config
COPY services/web/frontend /overleaf/services/web/frontend
COPY services/web/locales /overleaf/services/web/locales
COPY services/web/modules /overleaf/services/web/modules
COPY services/web/public /overleaf/services/web/public
RUN cd /overleaf/services/web \
 && export CYPRESS_INSTALL_BINARY=0 \
 && yarn install --mode=skip-build \
 && NODE_OPTIONS="$NODE_OPTIONS --max-old-space-size=6144" yarn run webpack:production

# ---------- Imagen final ----------
FROM ${BASE}
# El importador Word nativo de CLSI necesita Pandoc y ZIP también en modo CE (ejecutor local).
# El valor puede sobrescribirse al ejecutar la imagen. No modifica latex-server.
# La galería nativa debe estar disponible para las plantillas del programa. Ambos valores
# pueden sobrescribirse explícitamente al ejecutar la imagen.
ENV ENABLE_PANDOC_CONVERSIONS=true OVERLEAF_TEMPLATE_GALLERY=true
RUN apt-get update \
 && apt-get install -y --no-install-recommends pandoc zip \
 && rm -rf /var/lib/apt/lists/*
# Dependencias de producción: el fork añade @ai-sdk/anthropic a services/web. Sin scripts de
# instalación, porque la imagen no trae compilador y los módulos nativos ya vienen compilados.
COPY yarn.lock /overleaf/yarn.lock
COPY services/web/package.json /overleaf/services/web/package.json
RUN cd /overleaf && YARN_ENABLE_SCRIPTS=false yarn workspaces focus --all --production
COPY services/web/app /overleaf/services/web/app
COPY services/web/config /overleaf/services/web/config
COPY services/web/locales /overleaf/services/web/locales
COPY services/web/modules /overleaf/services/web/modules
COPY --from=frontend /overleaf/services/web/public /overleaf/services/web/public
COPY server-ce/config/settings.js /etc/overleaf/settings.js
# Las vistas .pug se sirven precompiladas a .js: regenerarlas con los cambios.
RUN cd /overleaf/services/web && yarn run precompile-pug

LABEL org.opencontainers.image.source="https://github.com/AEMCiCD-YT/aemcicd-latex"
