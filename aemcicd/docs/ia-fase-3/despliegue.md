# Fase 3: despliegue de producción

Publicación comprobada el **2 de noviembre de 2026**. Están desplegadas la fase base y las
fases 1, 2 y 3; esta es la última fase prevista. La IA permanece habilitada para estudiantes,
con activación individual opcional, crédito de $1 mensual y los topes existentes.

## Versiones

| Parte                     | Versión y evidencia                                                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fork                      | [PR 7](https://github.com/AEMCiCD-YT/aemcicd-latex/pull/7), merge `5c83ebff9c` en `ext-ce`                                                                               |
| Código de la imagen       | `8cdc84699f`; los commits posteriores añaden pruebas y documentación                                                                                                     |
| Imagen instalada          | `acraemcicdplatform.azurecr.io/latex-aemcicd:6.3.0-ext-v5.1-fase3-8cdc8469`, ACR `cjg`, digest `sha256:6176fd3802cdf2bd2b74cd98650e835fb6ee19237f85e1d2eeadad11ff331ee4` |
| Instalador y conector     | [latex-server PR 4](https://github.com/AEMCiCD-YT/latex-server/pull/4), merge `943cc71`; instalación terminada con código 0 a las 20:09 UTC                              |
| Plataforma                | [PR 81](https://github.com/AEMCiCD-YT/aemcicd-platform/pull/81), commit `6e86f34c6ba4676d9d308d2cdf44421534f93d47` promovido a `prod`                                    |
| Publicación de plataforma | [Deploy 41508320943](https://github.com/AEMCiCD-YT/aemcicd-platform/actions/runs/41508320943), CI y producción con resultado `success`                                   |
| Términos                  | Versión 1.3 publicada en API y web; las aceptaciones anteriores conservan su versión                                                                                     |

La imagen sustituye `a5` y también se usa para Pandoc en contenedores aislados. La identidad de
la imagen efectiva se comprobó en el contenedor de la VM, además de en ACR y el instalador.
Los PR de documentación posteriores no cambian estos bytes ni requieren reconstruir la imagen.

## Respaldo previo

`backups/2026-11-02T1916Z`, creado antes de actualizar el editor. El procedimiento detuvo
Overleaf, materializó Redis, copió Mongo y los archivos/configuración, reanudó el servicio y
subió el respaldo a Blob Storage. Se listó después usando la identidad administrada de la VM:

- `mongo.archive.gz`: 13 222 bytes.
- `overleaf-data.tar.gz`: 126 808 bytes.

Se verificaron la subida y la presencia de ambos archivos. No se publicaron sus contenidos ni
se restauró este respaldo como parte del despliegue.

## Comprobado en producción

- Mongo saludable, Redis y Overleaf en ejecución. Instalador con estado `Succeeded` y código 0.
- Configuración efectiva: IA habilitada, `soloAdmins=false`, crédito mensual de $1; galería y
  conversiones Pandoc habilitadas. No se rotaron claves ni se cambiaron los topes del programa.
- Carga del catálogo de las diez funciones nuevas y las seis plantillas desde la imagen instalada.
- PDF.js real extrajo texto de un PDF sintético en el servidor. Se consultó correctamente el
  DOI público `10.1038/171737a0` en Crossref desde la VM.
- Una plantilla del programa se compiló a PDF con el TeX Live aislado del servidor; se verificó
  la cabecera PDF de la descarga. Los paquetes de español y `booktabs` están disponibles allí.
- Exportación de esa plantilla a Word mediante CLSI/Pandoc aislado con la imagen nueva: DOCX
  válido, ZIP con `word/document.xml`. Se eliminaron el archivo temporal y la caché sintética.
- Conector instalado con la lista de funciones nueva: la plataforma confirmó la recepción de
  los totales reales agregados de `2026-11` y `2026-10`. Se reenviaron los snapshots existentes
  con el token habitual; no se fabricaron eventos ni consumo. El receptor reemplaza el snapshot
  mensual y no duplica el uso en un reintento.
- `latex-sync.timer` activo y habilitado; servicio con `Result=success` y `ExecMainStatus=0`.
  Se mantiene la sincronización de cuentas y el envío automático de totales aproximadamente
  cada cinco minutos.
- API `/api/health` con base de datos saludable; editor `/status` y `/login` disponibles por
  HTTPS. El receptor de totales rechaza peticiones sin credenciales con 401.
- Formulario público de la API y página de términos con versión 1.3. Playwright comprobó la
  página pública en escritorio y móvil, con los apartados de Crossref/PDF y sin desbordamiento.
- Job habitual de migración/seed `caj-aemcicd-migrate-prod-pnochya`, estado `Succeeded`; esta
  ampliación no añade migraciones de esquema. Revisiones listas: API `0000053`, worker `0000051`,
  web `0000047`.

La plataforma usa el servidor `sha256:e4e10f42a73d5e3c6a54b32c70af7762acaa577bcffeee3da7049c27e1ea69ec`
y la web `sha256:23e97ce4d9437abd72e5e05065f4a0e90366f596b400e582addf01cd79d594fb`.

Estas comprobaciones no crearon cuentas ni proyectos de estudiantes, no leyeron sus documentos
y no llamaron a modelos. El ejercicio de compilación usó únicamente recursos sintéticos del
servicio interno CLSI. Las [110 pruebas del módulo, la interfaz y las capturas locales](verificacion.md)
complementan estas comprobaciones; no se presentan como sesiones autenticadas de producción.

## Pendiente de comprobación

- Calidad y costo observado de las funciones de fases 2 y 3 con proveedores reales; los 93
  casos están preparados, pero no se ejecutaron contra modelos durante esta publicación.
- Colaboración entre cuentas distintas y soporte HTTPS entre subdominios con sesiones reales.
- Restauración del respaldo en una instancia aislada.

Verificar un DOI no certifica respaldo científico. El chat PDF no hace OCR ni interpreta
figuras; las plantillas son puntos de partida editables, no normas oficiales de carreras.
No hay una fase 4 definida: el seguimiento pendiente es de calidad y operación.
