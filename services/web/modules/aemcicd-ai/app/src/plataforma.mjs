export const ORIGEN_PLATAFORMA = 'https://plataforma.aemcicd.org'

// Solo la plataforma propia puede leer estos recursos de soporte con la sesión del estudiante.
// Los POST siguen requiriendo CSRF; no se habilitan documentos ni otras rutas entre orígenes.
// `sitio`: URL del propio editor (Settings.siteUrl), que también puede usar estas rutas.
export function corsPlataforma(app, sitio) {
  const propio = sitio ? new URL(sitio).origin : null
  app.use((req, res, next) => {
    if (
      !/^\/aemcicd-ai\/(soporte(?:\/sesion)?|resumen)\/?$/.test(req.path) ||
      !req.headers.origin
    )
      return next()
    // El propio editor también puede usarlas (mismo origen, sin cabeceras CORS).
    if (propio && req.headers.origin === propio) return next()
    if (req.headers.origin !== ORIGEN_PLATAFORMA) return res.sendStatus(403)
    res.setHeader('Access-Control-Allow-Origin', ORIGEN_PLATAFORMA)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Vary', 'Origin')
    res.setHeader('Cache-Control', 'no-store')
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, X-Csrf-Token'
      )
      return res.sendStatus(204)
    }
    next()
  })
}
