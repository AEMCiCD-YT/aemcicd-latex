import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import RailPanelHeader from "@/features/ide-react/components/rail/rail-panel-header";
import { useProjectContext } from "@/shared/context/project-context";
import MaterialIcon from "@/shared/components/material-icon";
import OLButton from "@/shared/components/ol/ol-button";
import { FullSizeLoadingSpinner } from "@/shared/components/loading-spinner";
import withErrorBoundary from "@/infrastructure/error-boundary";
import {
  EstadoIA,
  Saldo,
  activar,
  consultar,
  leerEstado,
  valorar,
} from "../api";
import Respuesta from "./respuesta";
import "../../stylesheets/aemcicd-ai.scss";

export type Turno = {
  id: number;
  pregunta: string;
  texto: string;
  estado: "escribiendo" | "lista" | "error";
  eventoId?: string;
  modelo?: string;
  costo?: number;
  error?: string;
  valoracion?: 1 | -1 | null;
  alternativa?: boolean;
};

const dinero = (n: number) =>
  new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);

function BarraSaldo({ saldo }: { saldo: Saldo }) {
  const usado = Math.min(
    100,
    Math.round((saldo.gastado / saldo.credito) * 100),
  );
  const renueva = new Date(saldo.renuevaEl).toLocaleDateString("es-EC", {
    day: "numeric",
    month: "long",
    timeZone: "America/Guayaquil",
  });
  return (
    <div className="aemcicd-ai-saldo">
      <div className="aemcicd-ai-saldo-texto">
        Te quedan <strong>{dinero(saldo.disponible)}</strong> de{" "}
        {dinero(saldo.credito)} este mes
      </div>
      <div
        className="aemcicd-ai-saldo-barra"
        role="progressbar"
        aria-label="Crédito de IA usado"
        aria-valuenow={usado}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div style={{ width: `${100 - usado}%` }} />
      </div>
      <div className="aemcicd-ai-saldo-renueva">Se renueva el {renueva}</div>
    </div>
  );
}

function Activacion({
  version,
  alActivar,
}: {
  version: string;
  alActivar: () => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const enviar = async () => {
    setEnviando(true);
    setError("");
    try {
      await activar(version);
      alActivar();
    } catch {
      setError("No se pudo activar. Inténtalo de nuevo.");
      setEnviando(false);
    }
  };
  return (
    <div className="aemcicd-ai-activacion">
      <h5>Asistente de IA del programa</h5>
      <p>
        Incluido en tu inscripción, con <strong>$1 de crédito al mes</strong>.
        Te ayuda a corregir errores, escribir fórmulas y mejorar tu documento;
        tú decides qué aplicar.
      </p>
      <ul>
        <li>
          Lo que le preguntes, y el texto que elijas incluir, se envía a{" "}
          <strong>Anthropic</strong> o a <strong>OpenAI</strong> para generar la
          respuesta. Ninguno de los dos lo usa para entrenar sus modelos.
        </li>
        <li>
          La AEMCiCD solo mide el uso (qué funciones, cuánto crédito, 👍/👎),
          sin el contenido de tus documentos ni de tus preguntas. Esos datos{" "}
          <strong>no se venden ni se entregan a nadie</strong>.
        </li>
        <li>
          La IA puede equivocarse. Revisa lo que propone. Declarar el uso de IA
          en tus trabajos es tu responsabilidad.
        </li>
      </ul>
      <p className="aemcicd-ai-nota">
        Detalles en los{" "}
        <a
          href="https://plataforma.aemcicd.org/latex/terminos"
          target="_blank"
          rel="noreferrer"
        >
          términos del programa
        </a>
        .
      </p>
      {error && <p className="text-danger">{error}</p>}
      <OLButton variant="primary" onClick={enviar} isLoading={enviando}>
        Activar la IA
      </OLButton>
    </div>
  );
}

function AiPanel() {
  const { projectId } = useProjectContext();
  const [estado, setEstado] = useState<EstadoIA | null>(null);
  const [errorEstado, setErrorEstado] = useState(false);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [pregunta, setPregunta] = useState("");
  const control = useRef<AbortController | null>(null);
  const fin = useRef<HTMLDivElement>(null);
  const siguienteId = useRef(1);

  const cargar = useCallback(() => {
    setErrorEstado(false);
    leerEstado()
      .then(setEstado)
      .catch(() => setErrorEstado(true));
  }, []);

  useEffect(() => {
    cargar();
    return () => control.current?.abort();
  }, [cargar]);

  useEffect(() => {
    fin.current?.scrollIntoView({ block: "end" });
  }, [turnos]);

  const ocupado = turnos.some((t) => t.estado === "escribiendo");

  const actualizar = (id: number, cambio: (t: Turno) => Partial<Turno>) =>
    setTurnos((ts) =>
      ts.map((t) => (t.id === id ? { ...t, ...cambio(t) } : t)),
    );

  const preguntar = async (texto: string, preferir?: "alternativa") => {
    const id = siguienteId.current++;
    setTurnos((ts) => [
      ...ts,
      {
        id,
        pregunta: texto,
        texto: "",
        estado: "escribiendo",
        alternativa: !!preferir,
      },
    ]);
    control.current = new AbortController();
    try {
      const r = await consultar(
        projectId,
        { funcion: "pregunta", entrada: { pregunta: texto }, preferir },
        (trozo) => actualizar(id, (t) => ({ texto: t.texto + trozo })),
        control.current.signal,
      );
      if (r.tipo === "fin") {
        actualizar(id, () => ({
          estado: "lista",
          eventoId: r.eventoId,
          modelo: r.modelo,
          costo: r.costo,
        }));
        setEstado((e) => (e ? { ...e, saldo: r.saldo } : e));
      } else {
        actualizar(id, () => ({ estado: "error", error: r.mensaje }));
        if (r.codigo === "sin_saldo" || r.codigo === "no_activada") cargar();
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        actualizar(id, () => ({ estado: "error", error: "Cancelada." }));
      } else {
        actualizar(id, () => ({
          estado: "error",
          error: "No hay conexión con el servidor.",
        }));
      }
    }
  };

  const enviar = (e: Pick<FormEvent, "preventDefault">) => {
    e.preventDefault();
    const texto = pregunta.trim();
    if (!texto || ocupado) return;
    setPregunta("");
    preguntar(texto);
  };

  const alValorar = async (t: Turno, valor: 1 | -1) => {
    if (!t.eventoId) return;
    const nuevo = t.valoracion === valor ? null : valor;
    actualizar(t.id, () => ({ valoracion: nuevo }));
    try {
      await valorar(t.eventoId, nuevo);
    } catch {
      actualizar(t.id, () => ({ valoracion: t.valoracion }));
    }
  };

  let contenido;
  if (errorEstado) {
    contenido = (
      <div className="aemcicd-ai-mensaje">
        No se pudo cargar la IA.{" "}
        <OLButton variant="link" onClick={cargar}>
          Reintentar
        </OLButton>
      </div>
    );
  } else if (!estado) {
    contenido = <FullSizeLoadingSpinner delay={300} />;
  } else if (!estado.habilitada) {
    contenido = (
      <div className="aemcicd-ai-mensaje">
        La IA no está disponible en este momento.
      </div>
    );
  } else if (!estado.activada) {
    contenido = <Activacion version={estado.versionAviso} alActivar={cargar} />;
  } else {
    contenido = (
      <>
        {estado.saldo && <BarraSaldo saldo={estado.saldo} />}
        <div className="aemcicd-ai-turnos">
          {turnos.length === 0 && (
            <div className="aemcicd-ai-vacio">
              <MaterialIcon type="smart_toy" />
              <p>
                Pregúntame sobre LaTeX: un error, un paquete, cómo armar una
                tabla o una fórmula.
              </p>
            </div>
          )}
          {turnos.map((t) => (
            <Respuesta
              key={t.id}
              turno={t}
              alValorar={(v) => alValorar(t, v)}
              alProbarOtro={() => preguntar(t.pregunta, "alternativa")}
              ocupado={ocupado}
            />
          ))}
          <div ref={fin} />
        </div>
        <form className="aemcicd-ai-formulario" onSubmit={enviar}>
          <textarea
            className="form-control"
            rows={3}
            maxLength={4000}
            placeholder="Escribe tu pregunta…"
            aria-label="Pregunta para la IA"
            value={pregunta}
            onChange={(e) => setPregunta(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) enviar(e);
            }}
          />
          {ocupado ? (
            <OLButton
              variant="secondary"
              onClick={() => control.current?.abort()}
            >
              Detener
            </OLButton>
          ) : (
            <OLButton
              type="submit"
              variant="primary"
              disabled={!pregunta.trim()}
            >
              Preguntar
            </OLButton>
          )}
        </form>
      </>
    );
  }

  return (
    <div className="aemcicd-ai-panel">
      <RailPanelHeader title="Asistente de IA" />
      <div className="aemcicd-ai-cuerpo">{contenido}</div>
    </div>
  );
}

export default withErrorBoundary(AiPanel);
