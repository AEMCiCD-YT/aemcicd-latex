import getMeta from "@/utils/meta";
import { RailElement } from "@/features/ide-react/util/rail-types";
import AiPanel from "./ai-panel";

// Pestaña «IA» en la barra lateral del editor. Solo aparece si la IA está habilitada en el
// servidor (variable AEMCICD_AI_ENABLED y al menos una clave).
const entrada: RailElement = {
  key: "workbench",
  icon: "smart_toy",
  title: "Asistente de IA",
  component: <AiPanel />,
  hide: () => !getMeta("ol-ExposedSettings")?.aemcicdAiEnabled,
};

export default entrada;
