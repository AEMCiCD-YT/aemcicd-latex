# Evaluación comparativa de modelos

Ejecuta los casos de `casos.json` con cada modelo (GPT-6 Luna, Claude Haiku 5.5, GPT-6.1 Terra,
Claude Sonnet 5.5 y GPT-6.1 Sol) usando las mismas instrucciones y precios que el servidor, y
genera `informe.html` con las respuestas lado a lado, el costo y el tiempo. Sirve para decidir
qué modelo atiende cada función (sección 5 del diseño).

Desde la laptop (WSL o macOS) o Azure Cloud Shell, con `az login` hecho y Node 20 o superior:

```bash
bash aemcicd/ia-eval/evaluar.sh
```

Solo algunos modelos:

```bash
bash aemcicd/ia-eval/evaluar.sh gpt-6-luna,claude-haiku-5-5
```

Las claves se leen del Key Vault y no se muestran. Los 20 casos con los 5 modelos cuestan
alrededor de $0,40. Para añadir casos reales, agréguelos a `casos.json` sin datos personales.
