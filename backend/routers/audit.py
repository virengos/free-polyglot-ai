"""
Audit router – Open-Source License Compliance & Feature Originality Check.

Two endpoints:
  GET /api/audit/licenses    – scans installed Python packages and classifies their licenses
  GET /api/audit/compliance  – returns a static feature-originality checklist
"""

from fastapi import APIRouter
import importlib.metadata

router = APIRouter(prefix="/api/audit", tags=["audit"])

# ── License classification ────────────────────────────────────────────────────
# Licenses that are clearly permissive / OSS-compatible for this project
_APPROVED_KEYWORDS = {
    "mit", "apache", "bsd", "isc", "python software foundation",
    "psf", "unlicense", "public domain",
    "cc0", "zlib", "artistic",
}
# Weak copyleft: compatible with MIT when used unmodified as a library dependency,
# but requires attribution and replaceability — flag for review.
_WEAK_COPYLEFT_KEYWORDS = {
    "lgpl", "mozilla public license", "mpl", "eupl",
}
# Strong copyleft: may require the entire application to be released under the
# same licence — flag as restricted.
_RESTRICTED_KEYWORDS = {
    "agpl", "sspl", "cddl",
    # plain GPL (without 'lesser') — match carefully to avoid catching lgpl
}


def _classify_license(raw: str) -> str:
    """Return 'approved', 'review', or 'restricted' based on the raw license string."""
    low = raw.lower()

    # Strong copyleft check first (agpl, sspl, cddl, bare gpl)
    for kw in _RESTRICTED_KEYWORDS:
        if kw in low:
            return "restricted"
    # Bare GPL — match ' gpl' or 'gnu general public license' but not 'lgpl'
    if (" gpl" in low or low.startswith("gpl") or "gnu general public license" in low) and "lesser" not in low:
        return "restricted"

    # Weak copyleft — usable but needs attribution note
    for kw in _WEAK_COPYLEFT_KEYWORDS:
        if kw in low:
            return "review"

    for kw in _APPROVED_KEYWORDS:
        if kw in low:
            return "approved"
    return "review"


def _extract_license(dist: importlib.metadata.Distribution) -> str:
    """Best-effort extraction of a human-readable license string."""
    meta = dist.metadata

    # 1) The "License" metadata field
    lic = meta.get("License")
    if lic and lic.strip() and lic.strip() not in ("-", "UNKNOWN", "None"):
        return lic.strip()

    # 2) Classifier triad: "License :: OSI Approved :: MIT License"
    classifiers = meta.get_all("Classifier") or []
    for c in classifiers:
        if c.startswith("License ::"):
            parts = [p.strip() for p in c.split("::")]
            if len(parts) >= 3:
                return parts[-1]

    return "Unknown"


@router.get("/licenses")
def get_license_audit():
    """
    Scan all installed Python packages and return their license information,
    classified as approved / review / restricted.
    """
    packages = []
    for dist in sorted(importlib.metadata.distributions(), key=lambda d: (d.metadata["Name"] or "").lower()):
        meta = dist.metadata
        name = meta.get("Name") or "unknown"
        version = meta.get("Version") or "unknown"
        home = meta.get("Home-page") or meta.get("Project-URL") or ""
        lic_raw = _extract_license(dist)
        status = _classify_license(lic_raw)
        packages.append({
            "name": name,
            "version": version,
            "license": lic_raw,
            "status": status,
            "home": home,
        })

    approved = sum(1 for p in packages if p["status"] == "approved")
    review = sum(1 for p in packages if p["status"] == "review")
    restricted = sum(1 for p in packages if p["status"] == "restricted")

    return {
        "packages": packages,
        "summary": {
            "total": len(packages),
            "approved": approved,
            "review": review,
            "restricted": restricted,
            "overall": "pass" if restricted == 0 and review == 0 else (
                "warning" if restricted == 0 else "fail"
            ),
        },
    }


# ── Feature-originality compliance checklist ─────────────────────────────────
# Each entry documents a feature, which commercial product it resembles,
# and how our implementation is original / differentiated.

_COMPLIANCE_ITEMS = [
    {
        "id": "spaced-repetition",
        "feature": "Spaced-repetition scheduling",
        "reference": "Anki (AnkiDroid / AnkiApp)",
        "reference_license": "Open-source (AGPL-3.0 for Anki desktop)",
        "our_approach": (
            "We implement the SM-2 algorithm, which is a published, non-proprietary algorithm "
            "created by Piotr Woźniak and placed in the public domain. No proprietary Anki "
            "scheduling code or UI components are used."
        ),
        "status": "pass",
        "risk": "low",
    },
    {
        "id": "flashcard-ui",
        "feature": "Flip-card / Flashcard UI",
        "reference": "Quizlet, Anki",
        "reference_license": "Quizlet – proprietary; Anki – AGPL-3.0",
        "our_approach": (
            "Card-flip interaction is a common UI pattern with no copyright protection. "
            "Our component is written from scratch using Tailwind CSS and Framer Motion, "
            "with a distinct visual design. No Quizlet or Anki CSS/JS assets are reused."
        ),
        "status": "pass",
        "risk": "low",
    },
    {
        "id": "multiple-choice",
        "feature": "Multiple-choice vocabulary quiz",
        "reference": "Duolingo",
        "reference_license": "Proprietary",
        "our_approach": (
            "Multiple-choice is a standard pedagogical format, not copyrightable. "
            "Distractor generation uses a custom SQL query over the user's own vocabulary, "
            "not Duolingo's proprietary distractor algorithm. Visual design is independently created."
        ),
        "status": "pass",
        "risk": "low",
    },
    {
        "id": "write-exercise",
        "feature": "Type-the-translation exercise",
        "reference": "Duolingo",
        "reference_license": "Proprietary",
        "our_approach": (
            "Free-form text input for translation is a decades-old educational technique. "
            "Our implementation uses fuzzy string matching (Python difflib) rather than "
            "Duolingo's proprietary answer-checking logic."
        ),
        "status": "pass",
        "risk": "low",
    },
    {
        "id": "example-sentences",
        "feature": "Context-sensitive example sentences",
        "reference": "Reverso Context",
        "reference_license": "Proprietary",
        "our_approach": (
            "Example sentences are generated on-demand by the Mistral AI API "
            "using our own prompts. We do not scrape or mirror Reverso's database. "
            "Each sentence is freshly generated and not cached from any third-party corpus."
        ),
        "status": "pass",
        "risk": "low",
    },
    {
        "id": "ai-image-generation",
        "feature": "Vocabulary image illustrations",
        "reference": "Quizlet (image search), Duolingo (licensed artwork)",
        "reference_license": "Proprietary",
        "our_approach": (
            "Images are generated via the Mistral AI image API and stored locally. "
            "We do not use Quizlet's image search API or Duolingo's licensed illustration "
            "assets. AI-generated images are novel artifacts owned by the operator."
        ),
        "status": "pass",
        "risk": "low",
    },
    {
        "id": "tts",
        "feature": "Text-to-speech pronunciation",
        "reference": "Quizlet, Google Translate",
        "reference_license": "Quizlet – proprietary; Google TTS – proprietary / restricted",
        "our_approach": (
            "We use Microsoft Edge TTS via the 'edge-tts' library (LGPLv3). "
            "LGPLv3 is a weak-copyleft licence: it permits use in non-LGPL projects "
            "without relicensing our code, provided we (a) give attribution, "
            "(b) do not modify the library source, and (c) allow users to replace it. "
            "All three conditions are met: edge-tts is listed in requirements.txt and "
            "in the README Third-Party Dependencies section with the full licence link; "
            "we call its public API without modification; and it can be freely swapped "
            "by editing requirements.txt. No Google Cloud TTS API keys or Quizlet audio "
            "assets are used."
        ),
        "status": "pass",
        "risk": "low",
    },
    {
        "id": "word-categories",
        "feature": "Vocabulary organised by grammar categories & topics",
        "reference": "Babbel, Pimsleur",
        "reference_license": "Proprietary",
        "our_approach": (
            "Categorisation (Verbs, Nouns, Food, Animals, …) follows standard lexical taxonomy "
            "used in linguistics and language education since the 19th century. "
            "Category assignments are determined by our own AI prompts, not copied from any "
            "proprietary course database."
        ),
        "status": "pass",
        "risk": "low",
    },
    {
        "id": "progress-tracking",
        "feature": "Daily word goal & progress statistics",
        "reference": "Duolingo (streaks), Quizlet (study progress)",
        "reference_license": "Proprietary",
        "our_approach": (
            "Daily targets and progress metrics are generic software features. "
            "Our implementation tracks raw review counts in an open SQLite database "
            "with no proprietary gamification algorithms copied from Duolingo or Quizlet."
        ),
        "status": "pass",
        "risk": "low",
    },
    {
        "id": "favorites",
        "feature": "Star / Favourite vocabulary items",
        "reference": "Quizlet (starred terms)",
        "reference_license": "Proprietary",
        "our_approach": (
            "Bookmarking/starring items is a universal UI pattern with no IP protection. "
            "Our implementation stores a boolean flag in the local database. "
            "No Quizlet API or data structures are reused."
        ),
        "status": "pass",
        "risk": "low",
    },
]


@router.get("/compliance")
def get_compliance_check():
    """
    Return a static feature-originality compliance checklist.
    Each item documents a feature, the commercial app it resembles,
    and how our implementation is independently developed.
    """
    pass_count = sum(1 for i in _COMPLIANCE_ITEMS if i["status"] == "pass")
    warn_count = sum(1 for i in _COMPLIANCE_ITEMS if i["status"] == "warning")
    fail_count = sum(1 for i in _COMPLIANCE_ITEMS if i["status"] == "fail")

    return {
        "items": _COMPLIANCE_ITEMS,
        "summary": {
            "total": len(_COMPLIANCE_ITEMS),
            "pass": pass_count,
            "warning": warn_count,
            "fail": fail_count,
            "overall": "pass" if fail_count == 0 and warn_count == 0 else (
                "warning" if fail_count == 0 else "fail"
            ),
        },
    }
