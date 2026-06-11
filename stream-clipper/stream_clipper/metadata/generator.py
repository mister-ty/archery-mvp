"""Título, hashtags y descripción del clip.

Base heurística (gratis): el gancho del clip como título + hashtags y CTA de config.
Si hay un proveedor LLM configurado (Ollama local también es gratis), puede refinar
el resultado; cualquier fallo del LLM degrada silenciosamente a la heurística.
"""

from __future__ import annotations

import re

from ..config import AppConfig
from ..llm.provider import get_provider
from ..models import ClipCandidate
from ..utils.log import get_logger

log = get_logger(__name__)

_SPACES_RE = re.compile(r"\s+")


def _clean_hook(hook: str) -> str:
    hook = _SPACES_RE.sub(" ", hook).strip().strip(".,;: ")
    return hook


def _truncate_words(text: str, max_len: int) -> str:
    if len(text) <= max_len:
        return text
    cut = text[: max_len - 1]
    if " " in cut:
        cut = cut.rsplit(" ", 1)[0]
    return cut + "…"


def generate_metadata(candidate: ClipCandidate, transcript_text: str, config: AppConfig) -> dict[str, str]:
    meta = config.metadata
    hook = _clean_hook(candidate.hook_text) or "Momento del stream"

    template = meta.title_templates[0] if meta.title_templates else "{hook}"
    title = _truncate_words(template.format(hook=hook), meta.title_max_len)

    hashtags = " ".join([*meta.hashtags_base, *meta.hashtags_extra])
    cta = meta.cta.format(channel=meta.kick_channel)
    description = f"{cta}\n\n{hashtags}"

    result = {"title": title, "description": description, "hashtags": hashtags}

    provider = get_provider(config.llm)
    enhanced = provider.enhance(
        {
            "hook": hook,
            "transcript": transcript_text[:1500],
            "duration": round(candidate.duration, 1),
            "kick_channel": meta.kick_channel,
            "language": "es",
        }
    )
    if enhanced:
        if enhanced.get("title"):
            result["title"] = _truncate_words(str(enhanced["title"]).strip(), meta.title_max_len)
        if enhanced.get("description"):
            # El CTA y los hashtags no se negocian: siempre presentes
            result["description"] = f"{str(enhanced['description']).strip()}\n\n{cta}\n{hashtags}"
    return result
