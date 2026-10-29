# Imagen de LaTeX AEMCiCD: la imagen publicada de Overleaf Extended CE con los cambios de este
# fork encima (textos, colores, logo, aviso de cuenta suspendida). Solo se recompilan el frontend
# y las vistas, así que no hace falta construir Overleaf completo.
#   docker build -f aemcicd/Dockerfile -t latex-aemcicd .
# Al actualizar Extended CE: unir la etiqueta nueva de yu-i-i/overleaf-cep en este fork, cambiar
# BASE a la misma versión, ejecutar aemcicd/merge-locales.py y construir (aemcicd/README.md).
ARG BASE=overleafcep/sharelatex:6.3.0-ext-v5.1

# ---------- Frontend (webpack) ----------
# En una etapa aparte: instalar las dependencias de desarrollo cambia las de producción, y la
# imagen no trae compilador para los módulos nativos (no se recompilan: --mode=skip-build).
FROM ${BASE} AS frontend
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
COPY services/web/app /overleaf/services/web/app
COPY services/web/locales /overleaf/services/web/locales
COPY services/web/modules /overleaf/services/web/modules
COPY --from=frontend /overleaf/services/web/public /overleaf/services/web/public
COPY server-ce/config/settings.js /etc/overleaf/settings.js
# Las vistas .pug se sirven precompiladas a .js: regenerarlas con los cambios.
RUN cd /overleaf/services/web && yarn run precompile-pug

LABEL org.opencontainers.image.source="https://github.com/AEMCiCD-YT/aemcicd-latex"
