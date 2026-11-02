export default function getMeta(nombre: string): any {
  return nombre === 'ol-ExposedSettings'
    ? { aemcicdAiEnabled: true, enablePandocConversions: true }
    : 'csrf-de-prueba'
}
