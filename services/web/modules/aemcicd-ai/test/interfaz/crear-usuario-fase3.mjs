// Solo para la instancia local desechable del banco; nunca ejecutar en producción.
if (
  process.env.OVERLEAF_SITE_URL !== 'http://localhost:18183' ||
  process.env.OPENAI_API_KEY !== 'clave-falsa-local' ||
  process.env.ANTHROPIC_API_KEY !== 'clave-falsa-local'
)
  throw new Error('Este script requiere la instancia local con claves falsas.')
const { default: Registro } =
  await import('../../../../app/src/Features/User/UserRegistrationHandler.mjs')
const { db } = await import('../../../../app/src/infrastructure/mongodb.mjs')
const email = 'admin@example.test'
let user = await db.users.findOne({ email })
if (!user)
  user = await Registro.promises.registerNewUser({
    email,
    password: 'PruebaLocalFase3!2026',
    analyticsId: crypto.randomUUID(),
    first_name: 'Prueba',
    last_name: 'Local',
  })
await db.users.updateOne(
  { _id: user._id },
  { $set: { isAdmin: true, email_confirmed_at: new Date() } }
)
console.log('Usuario ficticio preparado para el banco local.')
process.exit(0)
