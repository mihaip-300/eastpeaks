"""Filter and normalise runs and lifts; merge connected segments of the same run.

Rules (HANDOFF 5.2 step 2):
- keep downhill runs (LineString geometry) and lifts that are operating;
- normalise difficulty to the 7 values in CLAUDE.md;
- merge segments with the same name, difficulty and resort only when they form a
  simple chain whose ends are within MERGE_TOLERANCE_M; unnamed segments and
  branching groups are left as they are.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field

import numpy as np

from .config import DIFFICULTIES, MERGE_TOLERANCE_M

# Every value of OSM `piste:difficulty` in use, plus OpenSkiMap's own set
# (which adds `extreme`). Anything else maps to `unknown`.
DIFFICULTY_MAP = {
    "novice": "novice",
    "easy": "easy",
    "intermediate": "intermediate",
    "advanced": "advanced",
    "expert": "expert",
    "extreme": "expert",
    "freeride": "freeride",
}

INACTIVE_STATUS = {"abandoned", "disused", "proposed", "planned", "construction"}


def normalize_difficulty(value: object) -> str:
    if not isinstance(value, str):
        return "unknown"
    result = DIFFICULTY_MAP.get(value.strip().lower(), "unknown")
    assert result in DIFFICULTIES
    return result


def is_active(props: dict) -> bool:
    return (props.get("status") or "operating") not in INACTIVE_STATUS


@dataclass
class Segment:
    """A line in a projected (metric) CRS; z is OpenSkiMap's elevation, if present."""

    ids: list[str]
    name: str | None
    difficulty: str
    resort: str
    xy: np.ndarray  # (n, 2) metres
    z: np.ndarray | None = None  # (n,) metres, OpenSkiMap elevation
    props: dict = field(default_factory=dict)

    @property
    def start(self) -> np.ndarray:
        return self.xy[0]

    @property
    def end(self) -> np.ndarray:
        return self.xy[-1]

    def reversed(self) -> "Segment":
        return Segment(
            self.ids, self.name, self.difficulty, self.resort, self.xy[::-1].copy(),
            None if self.z is None else self.z[::-1].copy(), self.props,
        )


def _ends_touch(a: Segment, b: Segment, tol: float) -> list[tuple[str, str]]:
    """Which ends of a and b are within tol: list of ('start'|'end', 'start'|'end')."""
    pairs = []
    for ea, pa in (("start", a.start), ("end", a.end)):
        for eb, pb in (("start", b.start), ("end", b.end)):
            if float(np.hypot(*(pa - pb))) <= tol:
                pairs.append((ea, eb))
    return pairs


def _chain(segments: list[Segment], tol: float) -> Segment | None:
    """Join segments into one line if they form a simple chain, else None."""
    n = len(segments)
    links: dict[tuple[int, str], list[tuple[int, str]]] = defaultdict(list)
    for i in range(n):
        for j in range(i + 1, n):
            for ea, eb in _ends_touch(segments[i], segments[j], tol):
                links[(i, ea)].append((j, eb))
                links[(j, eb)].append((i, ea))
    # Simple chain: no end touches more than one other end, exactly 2 free ends overall.
    if any(len(v) > 1 for v in links.values()):
        return None
    free = [(i, e) for i in range(n) for e in ("start", "end") if not links.get((i, e))]
    if len(free) != 2:
        return None  # a cycle, or disconnected pieces

    i, e = free[0]
    current = segments[i] if e == "start" else segments[i].reversed()
    used = {i}
    xy, z, ids = [current.xy], [current.z], list(current.ids)
    tail = (i, "end" if e == "start" else "start")
    while len(used) < n:
        (j, ej), = links[tail]
        nxt = segments[j] if ej == "start" else segments[j].reversed()
        used.add(j)
        xy.append(nxt.xy[1:])
        z.append(None if nxt.z is None else nxt.z[1:])
        ids.extend(nxt.ids)
        tail = (j, "end" if ej == "start" else "start")
    first = segments[0]
    zs = None if any(v is None for v in z) else np.concatenate(z)
    return Segment(ids, first.name, first.difficulty, first.resort, np.vstack(xy), zs, first.props)


def components(segments: list[Segment], tol: float) -> list[list[Segment]]:
    """Group segments whose ends touch (union-find)."""
    parent = list(range(len(segments)))

    def find(k: int) -> int:
        while parent[k] != k:
            parent[k] = parent[parent[k]]
            k = parent[k]
        return k

    for i in range(len(segments)):
        for j in range(i + 1, len(segments)):
            if _ends_touch(segments[i], segments[j], tol):
                parent[find(i)] = find(j)
    groups: dict[int, list[Segment]] = defaultdict(list)
    for k, seg in enumerate(segments):
        groups[find(k)].append(seg)
    return list(groups.values())


def merge_runs(segments: list[Segment], tol: float = MERGE_TOLERANCE_M) -> list[Segment]:
    """Merge connected same-name/same-difficulty segments per resort."""
    out: list[Segment] = []
    groups: dict[tuple, list[Segment]] = defaultdict(list)
    for seg in segments:
        if seg.name:
            groups[(seg.resort, seg.name.strip().lower(), seg.difficulty)].append(seg)
        else:
            out.append(seg)
    for group in groups.values():
        for comp in components(group, tol):
            if len(comp) == 1:
                out.append(comp[0])
                continue
            merged = _chain(comp, tol)
            out.extend([merged] if merged is not None else comp)
    return out
