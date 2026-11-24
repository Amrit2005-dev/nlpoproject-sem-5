"""Detection helpers for Telugu/Hindi/English code-mixed questions."""

from __future__ import annotations

import re
from typing import Literal


Register = Literal["formal", "casual"]

LANGUAGE_NAMES = {
    "en": "English",
    "te": "Telugu",
    "hi": "Hindi",
    "te-rom": "Telugu (romanized)",
    "hi-rom": "Hindi (romanized)",
}

TELUGU_MARKERS = {
    "meeku", "naaku", "nenu", "meeru", "emiti", "emi", "kavali", "cheppu",
    "ela", "ekkada", "enduku", "endhuku", "cheyyi", "chey", "unnaru", "undi",
    "ledu", "kada", "chala", "bagundi", "telusu", "teliyadu", "gurinchi",
    "lo", "loni", "tho", "kosam", "ante", "avunu", "sari", "ippudu", "cheyyandi",
    "andhi", "andi", "gaaru", "garu",
}

HINDI_MARKERS = {
    "aap", "aapko", "mujhe", "mera", "meri", "kya", "kaise", "kaisa", "kahan",
    "kyun", "kyon", "hai", "hain", "tha", "thi", "nahi", "nahin", "haan",
    "chahiye", "bata", "batao", "karo", "karna", "kar", "raha", "rahi", "bahut",
    "thoda", "abhi", "kuch", "sab", "bhi", "matlab", "samajh", "kripya",
    "hindi", "hind", "mein", "ka", "ki", "ke", "se", "dikhao", "bataiye",
}

CASUAL_MARKERS = {
    "yaar", "bro", "dude", "hey", "hi", "yo", "plz", "pls", "gonna", "wanna",
    "lol", "ra", "ba", "anna", "akka", "bhai", "arre", "abey",
}

FORMAL_MARKERS = {
    "kindly", "please", "regards", "sir", "madam", "sincerely", "request",
    "would", "could", "may", "hereby", "respectfully", "andi", "gaaru", "garu",
    "aap", "aapko", "kripya", "dhanyavaad",
}

VALID_OVERRIDES = {
    "en": ["en"],
    "te": ["te"],
    "hi": ["hi"],
    "te-rom": ["te-rom"],
    "hi-rom": ["hi-rom"],
    "te-rom|en": ["te-rom", "en"],
    "hi-rom|en": ["hi-rom", "en"],
    "te|en": ["te", "en"],
    "hi|en": ["hi", "en"],
}

TOKEN_RE = re.compile(r"[\w']+", re.UNICODE)


def detect_scripts(text: str) -> dict[str, int]:
    counts = {"telugu": 0, "devanagari": 0, "latin": 0, "other": 0}
    for token in TOKEN_RE.findall(text):
        scripts = set()
        for char in token:
            code = ord(char)
            if 0x0C00 <= code <= 0x0C7F:
                scripts.add("telugu")
            elif 0x0900 <= code <= 0x097F:
                scripts.add("devanagari")
            elif char.isascii() and char.isalpha():
                scripts.add("latin")
            elif char.isalpha():
                scripts.add("other")
        for script in scripts:
            counts[script] += 1
    return counts


def detect_register(text: str) -> Register:
    words = {word.lower() for word in TOKEN_RE.findall(text)}
    formal_hits = len(words & FORMAL_MARKERS)
    casual_hits = len(words & CASUAL_MARKERS)
    if formal_hits > casual_hits:
        return "formal"
    if casual_hits > formal_hits:
        return "casual"
    if len(words) >= 12 and not re.search(r"[!?]{2,}|\.\.\.|:\)|😊|😂", text):
        return "formal"
    return "casual"


def detect_language(text: str, override: str | None = None) -> dict:
    text = (text or "").strip()
    scripts = detect_scripts(text)
    register = detect_register(text)

    if override:
        codes = VALID_OVERRIDES.get(override.strip())
        if codes:
            return {
                "languages": codes,
                "code_mixed": len(codes) > 1,
                "register": register,
                "method": "manual",
                "confidence": 1.0,
                "label": " + ".join(LANGUAGE_NAMES.get(code, code) for code in codes),
                "script_counts": scripts,
            }

    if scripts["telugu"] or scripts["devanagari"]:
        languages: list[str] = []
        if scripts["telugu"]:
            languages.append("te")
        if scripts["devanagari"]:
            languages.append("hi")
        if scripts["latin"]:
            languages.append("en")
        return {
            "languages": languages,
            "code_mixed": len(languages) > 1,
            "register": register,
            "method": "script",
            "confidence": 0.99,
            "label": " + ".join(LANGUAGE_NAMES.get(code, code) for code in languages),
            "script_counts": scripts,
        }

    words = {word.lower() for word in TOKEN_RE.findall(text)}
    telugu_hits = len(words & TELUGU_MARKERS)
    hindi_hits = len(words & HINDI_MARKERS)

    if telugu_hits or hindi_hits:
        if telugu_hits >= hindi_hits:
            languages = ["te-rom", "en"] if telugu_hits >= 1 else ["te-rom"]
        else:
            languages = ["hi-rom", "en"] if hindi_hits >= 1 else ["hi-rom"]
        if telugu_hits and hindi_hits:
            languages = ["te-rom", "hi-rom", "en"]
        return {
            "languages": languages,
            "code_mixed": len(languages) > 1,
            "register": register,
            "method": "heuristic",
            "confidence": min(0.95, 0.70 + 0.05 * max(telugu_hits, hindi_hits)),
            "label": " + ".join(LANGUAGE_NAMES.get(code, code) for code in languages),
            "script_counts": scripts,
        }

    return {
        "languages": ["en"],
        "code_mixed": False,
        "register": register,
        "method": "heuristic",
        "confidence": 0.75,
        "label": "English",
        "script_counts": scripts,
    }
