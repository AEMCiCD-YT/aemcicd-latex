import express from 'express'

// Hook previo al parser global de Overleaf. Solo esta ruta admite el base64 de una foto;
// sesión, CSRF y autorización se siguen comprobando en el router habitual.
export function cuerpoFoto(app) {
  app.use(/^\/project\/[a-f\d]{24}\/aemcicd-ai\/foto\/?$/i, (req, res, next) =>
    express.json({ limit: '28mb', strict: true, inflate: false })(
      req,
      res,
      err => {
        if (!err) return next()
        res.status(err.status === 413 ? 413 : 400).json({
          codigo: 'entrada',
          mensaje:
            err.status === 413
              ? 'La imagen supera el tamaño permitido.'
              : 'La imagen no tiene un formato válido.',
        })
      }
    )
  )
}
