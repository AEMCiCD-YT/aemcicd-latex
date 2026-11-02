import { useState } from 'react'
import MaterialIcon from '@/shared/components/material-icon'
import OLIconButton from '@/shared/components/ol/ol-icon-button'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import Markdown from './markdown'
import type { Turno } from './ai-panel'
import Propuesta from './propuesta'
import Comentario from './comentario'
import Grafica from './grafica'

// Los bloques ```…``` van aparte, con botón de copiar; el resto se muestra como Markdown.
function Texto({ texto, terminado }: { texto: string; terminado: boolean }) {
  const partes = texto.split(/```[a-zA-Z]*\n?/)
  return (
    <>
      {partes.map((p, i) =>
        i % 2 === 1 ? (
          <BloqueCodigo key={i} codigo={p.replace(/\n$/, '')} />
        ) : (
          p.trim() && <Markdown key={i} texto={p} formulas={terminado} />
        )
      )}
    </>
  )
}

function BloqueCodigo({ codigo }: { codigo: string }) {
  const [copiado, setCopiado] = useState(false)
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(codigo)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    } catch {
      // el navegador no permitió copiar
    }
  }
  return (
    <div className="aemcicd-ai-codigo">
      <pre>
        <code>{codigo}</code>
      </pre>
      <OLTooltip
        id="aemcicd-ai-copiar"
        description={copiado ? 'Copiado' : 'Copiar'}
        overlayProps={{ placement: 'left' }}
      >
        <OLIconButton
          size="sm"
          variant="ghost"
          icon={copiado ? 'check' : 'content_copy'}
          accessibilityLabel="Copiar el código"
          onClick={copiar}
        />
      </OLTooltip>
    </div>
  )
}

const NOMBRES: Record<string, string> = {
  'gpt-6-luna': 'GPT-6 Luna',
  'gpt-6.1-terra': 'GPT-6.1 Terra',
  'gpt-6.1-sol': 'GPT-6.1 Sol',
  'claude-haiku-5-5': 'Claude Haiku 5.5',
  'claude-sonnet-5-5': 'Claude Sonnet 5.5',
}

export default function Respuesta({
  turno,
  alValorar,
  alProbarOtro,
  ocupado,
}: {
  turno: Turno
  alValorar: (v: 1 | -1) => void
  alProbarOtro: () => void
  ocupado: boolean
}) {
  return (
    <div className="aemcicd-ai-turno">
      <div className="aemcicd-ai-pregunta">
        {turno.alternativa && (
          <span className="aemcicd-ai-etiqueta">Otro modelo</span>
        )}
        {turno.pregunta}
      </div>
      <div className="aemcicd-ai-respuesta" aria-live="polite">
        {turno.texto && (
          <Texto
            texto={turno.texto}
            terminado={turno.estado !== 'escribiendo'}
          />
        )}
        {turno.estado === 'escribiendo' && !turno.texto && (
          <span className="aemcicd-ai-pensando">Pensando…</span>
        )}
        {turno.estado === 'error' && (
          <p className="aemcicd-ai-error">
            <MaterialIcon type="error" /> {turno.error}
          </p>
        )}
      </div>
      {turno.estado === 'lista' &&
        turno.eventoId &&
        turno.cambios?.map((cambio, i) => (
          <Propuesta key={i} cambio={cambio} eventoId={turno.eventoId!} />
        ))}
      {turno.aviso && (
        <p className="aemcicd-ai-error" role="alert">
          {turno.aviso}
        </p>
      )}
      {turno.estado === 'lista' &&
        turno.eventoId &&
        turno.comentarios?.map((comentario, i) => (
          <Comentario
            key={i}
            comentario={comentario}
            eventoId={turno.eventoId!}
          />
        ))}
      {turno.estado === 'lista' && turno.eventoId && turno.grafica && (
        <Grafica grafica={turno.grafica} eventoId={turno.eventoId} />
      )}
      {turno.estado === 'lista' && (
        <div className="aemcicd-ai-pie">
          <span className="aemcicd-ai-modelo">
            {NOMBRES[turno.modelo ?? ''] ?? turno.modelo} · $
            {(turno.costo ?? 0).toFixed(4)}
          </span>
          <OLIconButton
            size="sm"
            variant="ghost"
            icon="thumb_up"
            className={turno.valoracion === 1 ? 'activo' : undefined}
            aria-pressed={turno.valoracion === 1}
            accessibilityLabel="Útil"
            onClick={() => alValorar(1)}
          />
          <OLIconButton
            size="sm"
            variant="ghost"
            icon="thumb_down"
            className={turno.valoracion === -1 ? 'activo' : undefined}
            aria-pressed={turno.valoracion === -1}
            accessibilityLabel="No útil"
            onClick={() => alValorar(-1)}
          />
          <OLTooltip
            id="aemcicd-ai-otro"
            description="Repetir con el otro proveedor (se cobra aparte)"
            overlayProps={{ placement: 'top' }}
          >
            <OLIconButton
              size="sm"
              variant="ghost"
              icon="shuffle"
              disabled={ocupado}
              accessibilityLabel="Probar con otro modelo"
              onClick={alProbarOtro}
            />
          </OLTooltip>
        </div>
      )}
      {turno.voto && (
        <div
          className={`aemcicd-ai-voto ${turno.voto === 'error' ? 'error' : ''}`}
          role="status"
        >
          {turno.voto === 'guardado' && 'Gracias, tu opinión quedó registrada.'}
          {turno.voto === 'quitado' && 'Opinión retirada.'}
          {turno.voto === 'error' &&
            'No se pudo registrar. Inténtalo de nuevo.'}
        </div>
      )}
    </div>
  )
}
