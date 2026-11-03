#!/usr/bin/env bash
# Ejecuta la evaluación comparativa con las claves del Key Vault, sin mostrarlas.
# Requiere: az (con az login), node 20 o superior y npm. Funciona también en Azure Cloud Shell.
#   bash aemcicd/ia-eval/evaluar.sh [modelos separados por coma]
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
KV=${KV:-kv-aemcicd-platform-prod}
command -v node >/dev/null || { echo "ERROR: falta node (20 o superior)" >&2; exit 1; }
[[ -d node_modules ]] || npm install --no-audit --no-fund --silent
ANTHROPIC_API_KEY=$(az keyvault secret show --vault-name "$KV" -n latex-ai-anthropic-key --query value -o tsv 2>/dev/null || true)
OPENAI_API_KEY=$(az keyvault secret show --vault-name "$KV" -n latex-ai-openai-key --query value -o tsv 2>/dev/null || true)
export ANTHROPIC_API_KEY OPENAI_API_KEY
unset ANTHROPIC_BASE_URL OPENAI_BASE_URL
if [[ ${1:-} == --rutas ]]; then
  shift
  node evaluar-rutas.mjs "$@"
else
  node evaluar.mjs "$@"
fi
