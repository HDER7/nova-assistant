# NOVA × OpenJarvis — Cerebro local

NOVA puede usar [OpenJarvis](https://open-jarvis.github.io/OpenJarvis/) (o cualquier
servidor compatible con OpenAI, como Ollama) como **motor de inferencia local**:
100% privado y offline, sin enviar tus datos a la nube. Ideal para trabajo de SOC.

La integración es directa porque OpenJarvis expone un endpoint compatible con OpenAI
(`jarvis serve`) y NOVA ya habla ese protocolo. NOVA solo **enruta la inferencia** al
motor local; sus herramientas, el módulo SOC y la memoria siguen igual.

## 1. Levanta el motor local

**Opción A — OpenJarvis**

```bash
git clone https://github.com/open-jarvis/OpenJarvis.git
cd OpenJarvis
./scripts/quickstart.sh      # instala deps, arranca Ollama + modelo local
jarvis serve --port 8000     # expone el API compatible con OpenAI en :8000/v1
```

**Opción B — Ollama directo**

```bash
ollama serve                 # API compatible con OpenAI en :11434/v1
ollama pull llama3.1:8b
```

## 2. Apunta NOVA al motor

Variables de entorno del backend (valores por defecto entre `{}`):

| Variable | Descripción | Default |
|---|---|---|
| `NOVA_AI_LOCAL_ENABLED` | Habilita el engine "Local" | `true` |
| `NOVA_AI_LOCAL_BASE_URL` | Endpoint OpenAI-compatible | `http://localhost:8000/v1` |
| `NOVA_AI_LOCAL_MODEL` | Modelo a pedir (vacío = OpenJarvis elige) | *(vacío)* |
| `NOVA_AI_LOCAL_API_KEY` | Bearer (OpenJarvis/Ollama lo ignoran) | `local` |
| `NOVA_AI_LOCAL_LABEL` | Etiqueta que ve el usuario | `Local (OpenJarvis)` |

Para Ollama: `NOVA_AI_LOCAL_BASE_URL=http://localhost:11434/v1` y
`NOVA_AI_LOCAL_MODEL=llama3.1:8b`.

## 3. Úsalo

- En el **chat**, abre el desplegable de modelo y elige **"Local (OpenJarvis)"**.
  Esa conversación corre en tu máquina; el resto de modelos siguen usando la nube (Groq).
- En **Ajustes → Motor de IA** ves el estado en vivo: si el motor local responde
  aparece **En línea**; si no, **Sin conexión**.

## Notas

- **Nube vs local**: NOVA está desplegado en Render (nube). Para usar el cerebro local,
  corre NOVA en tu máquina (`docker compose up`) o expón OpenJarvis con un túnel
  (`jarvis tunnel` / cloudflared) y pon esa URL en `NOVA_AI_LOCAL_BASE_URL`.
- **Tool calling**: el bucle agéntico de NOVA envía `tools` también al motor local.
  Modelos como `llama3.1` soportan function-calling vía Ollama; con modelos que no lo
  soporten, NOVA degrada con elegancia a una respuesta directa.
- **Selección por modelo**: además de `local`, puedes pedir `local:<modelo>` para forzar
  un modelo concreto del motor local (p. ej. `local:qwen2.5:7b`).
