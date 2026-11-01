export default function getMeta(nombre: string): any {
  return nombre === 'ol-ExposedSettings'
    ? { aemcicdAiEnabled: true }
    : 'csrf-de-prueba'
}
