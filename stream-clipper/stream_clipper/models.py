"""Tipos compartidos del pipeline: transcripción, marcas y candidatos a clip."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class Word:
    text: str
    start: float
    end: float


@dataclass
class Segment:
    text: str
    start: float
    end: float
    words: list[Word] = field(default_factory=list)


@dataclass
class Transcript:
    language: str
    segments: list[Segment]

    @property
    def words(self) -> list[Word]:
        return [w for seg in self.segments for w in seg.words]

    def to_dict(self) -> dict[str, Any]:
        return {
            "language": self.language,
            "segments": [
                {
                    "start": s.start,
                    "end": s.end,
                    "text": s.text,
                    "words": [{"w": w.text, "s": w.start, "e": w.end} for w in s.words],
                }
                for s in self.segments
            ],
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Transcript":
        segments = [
            Segment(
                text=s["text"],
                start=float(s["start"]),
                end=float(s["end"]),
                words=[Word(text=w["w"], start=float(w["s"]), end=float(w["e"])) for w in s.get("words", [])],
            )
            for s in data.get("segments", [])
        ]
        return cls(language=data.get("language", "es"), segments=segments)


@dataclass
class Marker:
    time: float
    label: str = ""


@dataclass
class ClipCandidate:
    start: float
    end: float
    score: float
    hook_time: float
    hook_text: str
    signals: dict[str, Any] = field(default_factory=dict)

    @property
    def duration(self) -> float:
        return self.end - self.start

    def overlap_ratio(self, other: "ClipCandidate") -> float:
        inter = min(self.end, other.end) - max(self.start, other.start)
        if inter <= 0:
            return 0.0
        return inter / min(self.duration, other.duration)
