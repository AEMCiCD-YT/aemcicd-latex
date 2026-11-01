import type { LogEntry } from '@/features/pdf-preview/util/types'
import OLButton from '@/shared/components/ol/ol-button'
import getMeta from '@/utils/meta'
import { useSolicitudIA } from '../solicitud-context'
import { useFileTreePathContext } from '@/features/file-tree/contexts/file-tree-path'

export default function CorregirLog({ logEntry }: { logEntry?: LogEntry }) {
  const { abrir, ocupado } = useSolicitudIA()
  const { findEntityByPath } = useFileTreePathContext()
  if (
    !getMeta('ol-ExposedSettings')?.aemcicdAiEnabled ||
    !logEntry ||
    !['error', 'warning', 'typesetting'].includes(logEntry.level)
  )
    return null
  const archivo = logEntry.file?.replace(/^\.\//, '')
  const enProyecto = archivo && findEntityByPath(archivo)?.type === 'doc'
  return (
    <OLButton
      size="sm"
      variant="secondary"
      disabled={ocupado}
      onClick={() =>
        abrir({
          funcion:
            logEntry.level === 'error'
              ? 'corregir_error'
              : 'corregir_advertencia',
          titulo: `Corregir: ${logEntry.message || logEntry.raw || 'diagnóstico de compilación'}`,
          entrada: {
            mensaje:
              logEntry.message ||
              logEntry.raw ||
              logEntry.content ||
              'Diagnóstico de compilación',
            bruto: [
              logEntry.raw || logEntry.content || '',
              !enProyecto && logEntry.file
                ? `Ubicación del log: ${logEntry.file}, línea ${logEntry.line ?? '?'}`
                : '',
            ]
              .filter(Boolean)
              .join('\n'),
            ...(enProyecto && logEntry.line
              ? {
                  archivo,
                  linea: logEntry.line,
                }
              : {}),
          },
        })
      }
    >
      Corregir con IA
    </OLButton>
  )
}
