"""Latin transliteration of Cyrillic run and lift names, per country.

Romanian readers can't use "Шилигарник"; the page shows "Shiligarnik" and keeps
the original as `name_local`. Bulgaria uses the official Streamlined System
(Transliteration Act, 2009). Serbia and North Macedonia get their own tables
when those resorts are added.
"""

from __future__ import annotations

import re

_BG = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ж": "zh", "з": "z",
    "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p",
    "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "ts", "ч": "ch",
    "ш": "sh", "щ": "sht", "ъ": "a", "ь": "y", "ю": "yu", "я": "ya",
}

TABLES = {"BG": _BG}

_CYRILLIC = re.compile(r"[Ѐ-ӿ]")


def has_cyrillic(text: str) -> bool:
    return bool(_CYRILLIC.search(text))


def _word(word: str, table: dict[str, str]) -> str:
    # Streamlined System: "-ия" at the end of a word is "ia", not "iya".
    lower = word.lower()
    tail = ""
    if table is _BG and lower.endswith("ия") and len(lower) > 2:
        word, tail = word[:-2], ("IA" if word[-2:].isupper() else "ia")
    out = []
    for i, ch in enumerate(word):
        latin = table.get(ch.lower())
        if latin is None:
            out.append(ch)
        elif ch.isupper():
            # "Ш" -> "Sh" at the start or in mixed case, "SH" inside an all-caps word.
            all_caps = word.isupper() and len(word) > 1
            out.append(latin.upper() if all_caps else latin.capitalize())
        else:
            out.append(latin)
    return "".join(out) + tail


def to_latin(text: str | None, country: str) -> str | None:
    """Transliterate if the country has a table and the text is Cyrillic, else return it unchanged."""
    table = TABLES.get(country)
    if not text or table is None or not has_cyrillic(text):
        return text
    return re.sub(r"[Ѐ-ӿ]+", lambda m: _word(m.group(0), table), text)
