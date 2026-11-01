import { Fragment, useState } from "react";
import MaterialIcon from "@/shared/components/material-icon";
import OLIconButton from "@/shared/components/ol/ol-icon-button";
import OLTooltip from "@/shared/components/ol/ol-tooltip";
import type { Turno } from "./ai-panel";

// Muestra el texto con los bloques ```…``` como código, sin interpretar HTML.
function Texto({ texto }: { texto: string }) {
  const partes = texto.split(/```[a-zA-Z]*\n?/);
  return (
    <>
      {partes.map((p, i) =>
        i % 2 === 1 ? (
          <BloqueCodigo key={i} codigo={p.replace(/\n$/, "")} />
        ) : (
          <Fragment key={i}>
            {p && <p className="aemcicd-ai-texto">{p.trim()}</p>}
          </Fragment>
        ),
      )}
    </>
  );
}

function BloqueCodigo({ codigo }: { codigo: string }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      // el navegador no permitió copiar
    }
  };
  return (
    <div className="aemcicd-ai-codigo">
      <pre>
        <code>{codigo}</code>
      </pre>
      <OLTooltip
        id="aemcicd-ai-copiar"
        description={copiado ? "Copiado" : "Copiar"}
        overlayProps={{ placement: "left" }}
      >
        <OLIconButton
          size="sm"
          variant="ghost"
          icon={copiado ? "check" : "content_copy"}
          accessibilityLabel="Copiar el código"
          onClick={copiar}
        />
      </OLTooltip>
    </div>
  );
}

const NOMBRES: Record<string, string> = {
  "gpt-6-luna": "GPT-6 Luna",
  "gpt-6.1-terra": "GPT-6.1 Terra",
  "gpt-6.1-sol": "GPT-6.1 Sol",
  "claude-haiku-5-5": "Claude Haiku 5.5",
  "claude-sonnet-5-5": "Claude Sonnet 5.5",
};

export default function Respuesta({
  turno,
  alValorar,
  alProbarOtro,
  ocupado,
}: {
  turno: Turno;
  alValorar: (v: 1 | -1) => void;
  alProbarOtro: () => void;
  ocupado: boolean;
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
        {turno.texto && <Texto texto={turno.texto} />}
        {turno.estado === "escribiendo" && !turno.texto && (
          <span className="aemcicd-ai-pensando">Pensando…</span>
        )}
        {turno.estado === "error" && (
          <p className="aemcicd-ai-error">
            <MaterialIcon type="error" /> {turno.error}
          </p>
        )}
      </div>
      {turno.estado === "lista" && (
        <div className="aemcicd-ai-pie">
          <span className="aemcicd-ai-modelo">
            {NOMBRES[turno.modelo ?? ""] ?? turno.modelo} · $
            {(turno.costo ?? 0).toFixed(4)}
          </span>
          <OLIconButton
            size="sm"
            variant="ghost"
            icon="thumb_up"
            className={turno.valoracion === 1 ? "activo" : undefined}
            accessibilityLabel="Útil"
            onClick={() => alValorar(1)}
          />
          <OLIconButton
            size="sm"
            variant="ghost"
            icon="thumb_down"
            className={turno.valoracion === -1 ? "activo" : undefined}
            accessibilityLabel="No útil"
            onClick={() => alValorar(-1)}
          />
          <OLTooltip
            id="aemcicd-ai-otro"
            description="Repetir con el otro proveedor (se cobra aparte)"
            overlayProps={{ placement: "top" }}
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
    </div>
  );
}
