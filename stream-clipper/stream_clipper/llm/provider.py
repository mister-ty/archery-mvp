"""Proveedores LLM opcionales para refinar títulos/descripciones.

- none      → no hace nada (default, costo cero).
- ollama    → modelo local gratis vía HTTP (ollama.com). Si no responde, se ignora.
- anthropic → stub documentado para Fase 3 (cuando haya presupuesto de API).

Todo error de proveedor degrada a heurística: el pipeline nunca se cae por el LLM.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any, Protocol

from ..config import LlmConfig
from ..utils.log import get_logger

log = get_logger(__name__)

_PROMPT = """Eres editor de contenido short-form en español para TikTok.
Dado este momento de un stream, devuelve SOLO un JSON con:
- "title": título gancho de máximo 70 caracteres, directo, sin clickbait vacío ni comillas
- "description": 1 frase que complemente al título (sin hashtags, sin CTA)

Gancho del clip: {hook}
Transcripción del clip: {transcript}
"""


class TitleProvider(Protocol):
    def enhance(self, payload: dict[str, Any]) -> dict[str, Any] | None: ...


class NoneProvider:
    def enhance(self, payload: dict[str, Any]) -> dict[str, Any] | None:
        return None


class OllamaProvider:
    def __init__(self, cfg: LlmConfig):
        self.cfg = cfg

    def enhance(self, payload: dict[str, Any]) -> dict[str, Any] | None:
        body = json.dumps(
            {
                "model": self.cfg.model,
                "prompt": _PROMPT.format(hook=payload["hook"], transcript=payload["transcript"]),
                "stream": False,
                "format": "json",
            }
        ).encode()
        request = urllib.request.Request(
            f"{self.cfg.base_url}/api/generate",
            data=body,
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                data = json.loads(response.read())
            return json.loads(data.get("response", "{}"))
        except (urllib.error.URLError, json.JSONDecodeError, TimeoutError, OSError) as exc:
            log.warning("Ollama no disponible (%s); usando metadata heurística", exc)
            return None


class AnthropicProvider:
    """Fase 3: requiere ANTHROPIC_API_KEY y presupuesto. Ver docs/architecture.md."""

    def __init__(self, cfg: LlmConfig):
        raise NotImplementedError(
            "Proveedor 'anthropic' previsto para Fase 3. Usa 'none' u 'ollama' (gratis) por ahora."
        )


def get_provider(cfg: LlmConfig) -> TitleProvider:
    if cfg.provider == "ollama":
        return OllamaProvider(cfg)
    if cfg.provider == "anthropic":
        return AnthropicProvider(cfg)  # lanza NotImplementedError con mensaje claro
    return NoneProvider()
