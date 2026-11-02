# Fase 2: despliegue de producción

Comprobaciones realizadas el **2 de noviembre de 2026**. Base y fases 1 y 2 están desplegadas;
la fase 3 sigue planificada. Habilitar el servicio para estudiantes no sustituye su activación
individual opcional en el panel.

## Versiones y configuración

| Parte                    | Versión y evidencia                                                                                                                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fork                     | [PR #5](https://github.com/AEMCiCD-YT/aemcicd-latex/pull/5), merge `d41897bda4fd24a3cbfb98d92c61cb6b35ef2272` en `ext-ce`                                                                                                                                           |
| Imagen                   | ACR `cjc`, `latex-aemcicd:6.3.0-ext-v5.1-a5`, digest `sha256:d990229a7fb22c461f23b85924fbbcca065f709e73e9104c3695d36290993ffd`                                                                                                                                      |
| Instalación del servidor | [latex-server PR #2](https://github.com/AEMCiCD-YT/latex-server/pull/2), imagen fijada por digest y conversión Pandoc aislada con esa imagen                                                                                                                        |
| Conector automático      | [latex-server PR #1](https://github.com/AEMCiCD-YT/latex-server/pull/1), `latex-sync`: cuentas cada minuto; totales del mes actual y anterior cada cinco minutos aproximadamente                                                                                    |
| Acceso de estudiantes    | [latex-server PR #3](https://github.com/AEMCiCD-YT/latex-server/pull/3): `AEMCICD_AI_ENABLED=true`, `AEMCICD_AI_ONLY_ADMINS=false`, verificados en la configuración efectiva del contenedor                                                                         |
| Plataforma               | [PR #79](https://github.com/AEMCiCD-YT/aemcicd-platform/pull/79), commit `faab4a93cb48f7b9967702ca2f0bd90b9be441bf`, promovido a `prod` mediante [Deploy 41435130886](https://github.com/AEMCiCD-YT/aemcicd-platform/actions/runs/41435130886), resultado `success` |
| Crédito                  | $1 mensual por estudiante; se mantienen los topes por proveedor. Las claves existentes permanecen en Key Vault y en el servidor                                                                                                                                     |

Los PRs de documentación posteriores no cambian el digest de la imagen ya instalada. La revisión
de los términos públicos se versiona y despliega desde la plataforma, de forma independiente.

## Comprobado en producción

- Respaldo previo a instalar: `backups/2026-11-02T0652Z`, con `mongo.archive.gz` y
  `overleaf-data.tar.gz` (Mongo, Redis persistido, archivos y configuración). AzCopy confirmó la
  subida; se volvió a listar con la identidad administrada de la VM. No se publican sus contenidos.
- Overleaf `/status`, API `/api/health` y panel `/programa-latex/ia`: HTTP 200.
- Mongo saludable y Redis/Overleaf en ejecución. Misma imagen `a5` tras habilitar estudiantes.
- DOCX sintético convertido por CLSI/Pandoc a ZIP válido con `main.tex`.
- Documento LaTeX sintético compilado a PDF por el compilador aislado; caché de prueba eliminada.
- Migración `20261102100000_latex_ai_summary`: ejecución
  `caj-aemcicd-migrate-prod-wov1qbq`, estado `Succeeded`.
- Receptor `POST /api/integrations/latex/v1/ai/summary`: 401 sin credenciales.
- Conector con su token existente: confirmó envíos de `2026-11` y `2026-10`; servicio con
  `Result=success` y `ExecMainStatus=0`. La API guarda/reemplaza un snapshot mensual; no suma
  dos veces un reintento ni recibe preguntas, documentos o identificadores personales.
- Espacio: el almacén de imágenes de containerd se trasladó de `/var/lib/containerd` a
  `/data/containerd`, con servicios detenidos durante la copia. Tras verificar el arranque se
  retiró la copia antigua. El disco del sistema quedó al 10 %, con 26 GB libres; `/data`, con
  95 GB libres. Se conserva la configuración previa en `/data/latex-server-retroceso/`.

Los términos 1.1 se publicaron con el despliegue de la plataforma. Su revisión posterior amplía
la información de crédito y privacidad; las aceptaciones existentes conservan su versión.

## Pendiente de comprobación

- Calidad y costo observado de la batería de fase 2 con respuestas de proveedores reales.
- Colaboración entre cuentas distintas e history-ot completo; la batería local cubrió dos
  pestañas de una misma cuenta y adaptadores de ambas variantes de revisión.
- Soporte con sesiones reales entre subdominios HTTPS. Las comprobaciones locales de CORS/CSRF
  y el banco de componentes no certifican este recorrido en producción.
- Restauración del respaldo de producción en una instancia aislada.

Véanse [pruebas y capturas locales](verificacion.md). No se hicieron llamadas reales a modelos
como parte de estas comprobaciones de despliegue ni se certifica todo el recorrido de cada función.
