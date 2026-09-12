"""
CivicAI Nexus department classification.

IMPORTANT:
The department names in this file are the canonical department names used
by the frontend, backend, database, officers and grievance routing.

Never introduce alternate names such as:
    Water Supply Department
    Water Services
    Sanitation Department
    Public Works Department

Use the canonical names below.
"""

from __future__ import annotations

import re
from typing import Dict, List


CANONICAL_DEPARTMENTS: List[str] = [
    "Municipal Corporation",
    "Police",
    "Health",
    "Education",
    "Electricity",
    "Water Supply",
    "Roads & Highways",
    "Sanitation & Waste Management",
    "Agriculture",
    "Housing",
    "Revenue & Land Records",
    "Food & Civil Supplies",
    "Transport",
    "Labour & Employment",
    "Women & Child Welfare",
    "Environment & Forest",
    "Social Welfare",
    "Public Works",
    "Rural Development / Panchayat",
    "e-Governance",
    "Drainage & Sewerage",
]


# Legacy names that may still exist in old MongoDB documents,
# old seed data, or old model outputs.
LEGACY_DEPARTMENT_MAP = {
    "water services": "Water Supply",
    "water supply department": "Water Supply",
    "water department": "Water Supply",

    "sanitation department": "Sanitation & Waste Management",
    "waste management": "Sanitation & Waste Management",
    "waste management department": "Sanitation & Waste Management",

    "public works department": "Public Works",
    "pwd": "Public Works",

    "electricity department": "Electricity",

    "traffic police department": "Police",
    "traffic department": "Police",
    "police department": "Police",

    "public safety department": "Police",
    "public safety": "Police",

    "road department": "Roads & Highways",
    "roads department": "Roads & Highways",
    "highways department": "Roads & Highways",

    "drainage department": "Drainage & Sewerage",
    "sewerage department": "Drainage & Sewerage",

    "general administration": "Municipal Corporation",
    "general administration department": "Municipal Corporation",
}


def normalize_department(value: str | None) -> str | None:
    """
    Convert any AI/database/frontend department value to the canonical name.
    """

    if value is None:
        return None

    value = str(value).strip()

    if not value:
        return None

    # Exact canonical match first.
    for department in CANONICAL_DEPARTMENTS:
        if value.casefold() == department.casefold():
            return department

    # Legacy exact match.
    legacy = LEGACY_DEPARTMENT_MAP.get(
        value.casefold()
    )

    if legacy:
        return legacy

    # Remove punctuation/spacing differences for safer matching.
    simplified = re.sub(
        r"[^a-z0-9]+",
        " ",
        value.casefold(),
    ).strip()

    simplified_map = {
        re.sub(
            r"[^a-z0-9]+",
            " ",
            key.casefold(),
        ).strip(): mapped
        for key, mapped in LEGACY_DEPARTMENT_MAP.items()
    }

    if simplified in simplified_map:
        return simplified_map[simplified]

    # Common AI-generated phrases.
    if "water" in simplified:
        return "Water Supply"

    if (
        "garbage" in simplified
        or "waste" in simplified
        or "sanitation" in simplified
    ):
        return "Sanitation & Waste Management"

    if (
        "drainage" in simplified
        or "sewerage" in simplified
        or "sewer" in simplified
    ):
        return "Drainage & Sewerage"

    if (
        "electric" in simplified
        or "power supply" in simplified
    ):
        return "Electricity"

    if (
        "road" in simplified
        or "highway" in simplified
        or "pothole" in simplified
    ):
        return "Roads & Highways"

    if (
        "police" in simplified
        or "traffic" in simplified
        or "crime" in simplified
        or "safety" in simplified
    ):
        return "Police"

    return None


KEYWORDS: Dict[str, List[str]] = {
    "Water Supply": [
        "water supply",
        "drinking water",
        "water not coming",
        "no water",
        "water shortage",
        "water connection",
        "water pipeline",
        "water pipe",
        "water pressure",
        "low water pressure",
        "water leakage",
        "water leak",
        "tap water",
        "potable water",
        "குடிநீர்",
        "தண்ணீர்",
        "நீர்",
        "குடிநீர் வரவில்லை",
        "தண்ணீர் வரவில்லை",
        "தண்ணீர் இல்லை",
        "पानी",
        "पेयजल",
        "पानी नहीं",
        "पानी नहीं आ रहा",
        "വെള്ളം",
        "കുടിവെള്ളം",
    ],

    "Sanitation & Waste Management": [
        "garbage",
        "waste",
        "trash",
        "rubbish",
        "dustbin",
        "dumping",
        "litter",
        "solid waste",
        "waste collection",
        "garbage collection",
        "garbage vehicle",
        "குப்பை",
        "கழிவு",
        "குப்பைகள்",
        "कचरा",
        "कूड़ा",
        "अपशिष्ट",
        "മാലിന്യം",
        "ചവറ്",
    ],

    "Drainage & Sewerage": [
        "drainage",
        "drain",
        "blocked drain",
        "drain blocked",
        "sewer",
        "sewerage",
        "sewage",
        "sewage overflow",
        "storm water drain",
        "stormwater",
        "waterlogging",
        "water logging",
        "stagnant water",
        "கழிவுநீர்",
        "வடிகால்",
        "சாக்கடை",
        "நீர் தேக்கம்",
        "नाली",
        "सीवर",
        "जलभराव",
        "नाला",
        "ഡ്രെയിൻ",
        "മലിനജലം",
    ],

    "Electricity": [
        "electricity",
        "power cut",
        "power outage",
        "blackout",
        "current",
        "electric pole",
        "power pole",
        "transformer",
        "voltage",
        "electric wire",
        "street light",
        "streetlight",
        "lamp post",
        "மின்சாரம்",
        "மின்தடை",
        "மின்கம்பம்",
        "மின்னழுத்தம்",
        "बिजली",
        "बिजली कटौती",
        "ट्रांसफॉर्मर",
        "विद्युत",
        "വൈദ്യുതി",
        "വൈദ്യുതി മുടക്കം",
        "ട്രാൻസ്ഫോർമർ",
    ],

    "Roads & Highways": [
        "road",
        "roads",
        "pothole",
        "highway",
        "road damage",
        "broken road",
        "damaged road",
        "footpath",
        "pavement",
        "road surface",
        "மோசமான சாலை",
        "சாலை",
        "குண்டும் குழியும்",
        "சாலையில் பள்ளம்",
        "सड़क",
        "गड्ढा",
        "खराब सड़क",
        "റോഡ്",
        "കുഴി",
        "തകർന്ന റോഡ്",
    ],

    "Police": [
        "police",
        "crime",
        "theft",
        "stolen",
        "robbery",
        "threat",
        "threatening",
        "harassment",
        "accident",
        "traffic violation",
        "illegal parking",
        "traffic signal",
        "signal violation",
        "முட்டுக்கட்டை",
        "திருட்டு",
        "மிரட்டல்",
        "காவல்",
        "போலீஸ்",
        "குற்றம்",
        "चोरी",
        "धमकी",
        "पुलिस",
        "अपराध",
        "ട്രാഫിക്",
        "പോലീസ്",
        "മോഷണം",
    ],

    "Health": [
        "hospital",
        "health centre",
        "health center",
        "doctor",
        "clinic",
        "medicine",
        "medical",
        "ambulance",
        "vaccination",
        "healthcare",
        "மருத்துவமனை",
        "மருத்துவர்",
        "மருந்து",
        "தடுப்பூசி",
        "अस्पताल",
        "डॉक्टर",
        "दवा",
        "टीका",
        "ആശുപത്രി",
        "ഡോക്ടർ",
        "മരുന്ന്",
        "വാക്സിൻ",
    ],

    "Education": [
        "school",
        "college",
        "university",
        "student",
        "scholarship",
        "certificate",
        "teacher",
        "classroom",
        "education",
        "exam",
        "பள்ளி",
        "கல்லூரி",
        "மாணவர்",
        "கல்வி",
        "உதவித்தொகை",
        "சான்றிதழ்",
        "स्कूल",
        "कॉलेज",
        "छात्र",
        "शिक्षा",
        "छात्रवृत्ति",
        "प्रमाणपत्र",
        "സ്കൂൾ",
        "കോളേജ്",
        "വിദ്യാഭ്യാസം",
        "സ്കോളർഷിപ്പ്",
    ],

    "Agriculture": [
        "farmer",
        "farming",
        "agriculture",
        "crop",
        "irrigation",
        "fertilizer",
        "pesticide",
        "harvest",
        "விவசாயம்",
        "விவசாயி",
        "பயிர்",
        "உரங்கள்",
        "किसान",
        "खेती",
        "फसल",
        "कृषि",
        "കർഷകൻ",
        "കൃഷി",
        "വിള",
    ],

    "Housing": [
        "house",
        "housing",
        "building",
        "construction permission",
        "building approval",
        "rental housing",
        "residential building",
        "வீடு",
        "குடியிருப்பு",
        "கட்டிடம்",
        "வீட்டு அனுமதி",
        "मकान",
        "आवास",
        "भवन",
        "घर",
        "വീട്",
        "ഭവനം",
        "കെട്ടിടം",
    ],

    "Revenue & Land Records": [
        "land record",
        "land records",
        "patta",
        "property record",
        "survey",
        "land survey",
        "revenue",
        "property tax record",
        "title deed",
        "பட்டா",
        "நில ஆவணம்",
        "நில அளவை",
        "வருவாய்",
        "भूमि रिकॉर्ड",
        "पट्टा",
        "जमीन",
        "भू-अभिलेख",
        "ഭൂമി രേഖ",
        "പട്ടയം",
    ],

    "Food & Civil Supplies": [
        "ration",
        "ration card",
        "public distribution",
        "pds",
        "food supply",
        "fair price shop",
        "rice allocation",
        "wheat allocation",
        "ரேஷன்",
        "ரேஷன் அட்டை",
        "பொது விநியோகம்",
        "உணவு பொருள்",
        "राशन",
        "राशन कार्ड",
        "खाद्य वितरण",
        "സൗജന്യ റേഷൻ",
        "റേഷൻ കാർഡ്",
    ],

    "Transport": [
        "bus",
        "bus service",
        "bus stop",
        "public transport",
        "transport service",
        "government bus",
        "bus route",
        "பேருந்து",
        "பேருந்து நிறுத்தம்",
        "போக்குவரத்து",
        "बस",
        "बस सेवा",
        "बस स्टॉप",
        "परिवहन",
        "ബസ്",
        "ബസ് സ്റ്റോപ്പ്",
        "ഗതാഗതം",
    ],

    "Labour & Employment": [
        "labour",
        "worker",
        "employment",
        "salary",
        "wages",
        "minimum wage",
        "job",
        "unpaid wages",
        "தொழிலாளர்",
        "வேலை",
        "ஊதியம்",
        "சம்பளம்",
        "श्रमिक",
        "रोजगार",
        "वेतन",
        "मजदूरी",
        "തൊഴിലാളി",
        "തൊഴിൽ",
        "ശമ്പളം",
    ],

    "Women & Child Welfare": [
        "women welfare",
        "child welfare",
        "child protection",
        "women protection",
        "child abuse",
        "domestic violence",
        "anganwadi",
        "பெண்கள் நலன்",
        "குழந்தைகள் நலன்",
        "பெண்கள் பாதுகாப்பு",
        "குழந்தைகள் பாதுகாப்பு",
        "महिला कल्याण",
        "बाल कल्याण",
        "महिला सुरक्षा",
        "बाल सुरक्षा",
        "വനിതാ ക്ഷേമം",
        "ശിശു ക്ഷേമം",
    ],

    "Environment & Forest": [
        "environment",
        "forest",
        "tree cutting",
        "illegal tree cutting",
        "pollution",
        "air pollution",
        "environmental pollution",
        "wildlife",
        "மரம் வெட்டுதல்",
        "சுற்றுச்சூழல்",
        "மாசு",
        "காடு",
        "पेड़ काटना",
        "पर्यावरण",
        "प्रदूषण",
        "वन",
        "മരം മുറിക്കൽ",
        "പരിസ്ഥിതി",
        "മലിനീകരണം",
        "വനം",
    ],

    "Social Welfare": [
        "social welfare",
        "pension",
        "senior citizen",
        "disability benefit",
        "social assistance",
        "welfare scheme",
        "widow pension",
        "முதியோர் உதவி",
        "ஊனமுற்றோர் உதவி",
        "சமூக நலன்",
        "ஓய்வூதியம்",
        "पेंशन",
        "सामाजिक कल्याण",
        "विकलांग सहायता",
        "वृद्धावस्था",
        "സാമൂഹിക ക്ഷേമം",
        "പെൻഷൻ",
        "വികലാംഗ സഹായം",
    ],

    "Public Works": [
        "public works",
        "government building maintenance",
        "government building repair",
        "public building",
        "government infrastructure",
        "culvert",
        "bridge maintenance",
        "பொதுப்பணி",
        "அரசு கட்டிடம் பராமரிப்பு",
        "அரசு உள்கட்டமைப்பு",
        "सार्वजनिक निर्माण",
        "सरकारी भवन",
        "सरकारी बुनियादी ढांचा",
        "പൊതുമരാമത്ത്",
        "സർക്കാർ കെട്ടിടം",
    ],

    "Rural Development / Panchayat": [
        "panchayat",
        "village development",
        "rural development",
        "village road",
        "panchayat office",
        "village administration",
        "கிராம பஞ்சாயத்து",
        "ஊராட்சி",
        "கிராம வளர்ச்சி",
        "पंचायत",
        "ग्राम पंचायत",
        "ग्रामीण विकास",
        "गांव विकास",
        "പഞ്ചായത്ത്",
        "ഗ്രാമ വികസനം",
    ],

    "e-Governance": [
        "online government service",
        "e governance",
        "egovernance",
        "government portal",
        "online application",
        "digital government service",
        "online certificate",
        "website not working",
        "portal not working",
        "ஆன்லைன் அரசு சேவை",
        "அரசு இணையதளம்",
        "ஆன்லைன் விண்ணப்பம்",
        "ऑनलाइन सरकारी सेवा",
        "सरकारी पोर्टल",
        "ऑनलाइन आवेदन",
        "ഇ ഗവേണൻസ്",
        "സർക്കാർ പോർട്ടൽ",
        "ഓൺലൈൻ അപേക്ഷ",
    ],

    "Municipal Corporation": [
        "municipality",
        "municipal corporation",
        "street cleaning",
        "public toilet",
        "local civic service",
        "municipal service",
        "street maintenance",
        "civic amenity",
        "மாநகராட்சி",
        "நகராட்சி",
        "தெரு சுத்தம்",
        "பொது கழிப்பிடம்",
        "नगर निगम",
        "नगरपालिका",
        "सड़क सफाई",
        "सार्वजनिक शौचालय",
        "മുനിസിപ്പാലിറ്റി",
        "നഗരസഭ",
        "തെരുവ് വൃത്തിയാക്കൽ",
    ],
}


def _normalise_text(text: str) -> str:
    text = text or ""

    text = text.casefold()

    # Preserve Unicode letters while normalising whitespace.
    text = re.sub(
        r"\s+",
        " ",
        text,
    )

    return text.strip()


def _keyword_score(
    text: str,
    keywords: List[str],
) -> int:
    score = 0

    for keyword in keywords:
        keyword_normalized = _normalise_text(
            keyword
        )

        if keyword_normalized in text:
            score += 1

    return score


def classify_complaint(text: str) -> dict:
    """
    Deterministic multilingual classifier.

    Strong civic phrases are checked first.
    The returned department is ALWAYS one of CANONICAL_DEPARTMENTS.
    """

    normalized_text = _normalise_text(text)

    scores: Dict[str, int] = {
        department: 0
        for department in CANONICAL_DEPARTMENTS
    }

    for department, keywords in KEYWORDS.items():
        scores[department] = _keyword_score(
            normalized_text,
            keywords,
        )

    # Very strong direct phrases.
    direct_rules = [
        (
            "Water Supply",
            [
                "water not coming",
                "no water",
                "drinking water",
                "water supply",
                "குடிநீர் வரவில்லை",
                "தண்ணீர் வரவில்லை",
                "தண்ணீர் இல்லை",
                "pani nahi aa raha",
                "पानी नहीं आ रहा",
                "കുടിവെള്ളം",
            ],
        ),
        (
            "Sanitation & Waste Management",
            [
                "garbage not collected",
                "waste not collected",
                "garbage collection",
                "குப்பை சேகரிப்பு",
                "குப்பை அகற்றப்படவில்லை",
                "कचरा नहीं उठाया",
                "മാലിന്യം ശേഖരിക്കുന്നില്ല",
            ],
        ),
        (
            "Drainage & Sewerage",
            [
                "blocked drain",
                "drain blocked",
                "sewage overflow",
                "waterlogging",
                "வடிகால் அடைப்பு",
                "சாக்கடை அடைப்பு",
                "நீர் தேக்கம்",
                "नाली बंद",
                "जलभराव",
                "ഡ്രെയിൻ ബ്ലോക്ക്",
            ],
        ),
    ]

    for department, phrases in direct_rules:
        for phrase in phrases:
            if _normalise_text(phrase) in normalized_text:
                scores[department] += 100

    best_department = max(
        scores,
        key=scores.get,
    )

    best_score = scores[best_department]

    if best_score <= 0:
        best_department = "Municipal Corporation"

    # Convert department scores into a simple confidence value.
    sorted_scores = sorted(
        scores.items(),
        key=lambda item: item[1],
        reverse=True,
    )

    top_score = sorted_scores[0][1]

    second_score = (
        sorted_scores[1][1]
        if len(sorted_scores) > 1
        else 0
    )

    if top_score <= 0:
        confidence = 0.25
    else:
        margin = top_score - second_score

        confidence = min(
            0.98,
            0.55
            + min(top_score, 5) * 0.05
            + min(margin, 5) * 0.05,
        )

    return {
        "category": _department_to_category(
            best_department
        ),
        "department": best_department,
        "scores": scores,
        "confidence": round(
            confidence,
            3,
        ),
    }


def _department_to_category(
    department: str,
) -> str:
    mapping = {
        "Water Supply": "WATER",
        "Sanitation & Waste Management": "WASTE",
        "Drainage & Sewerage": "DRAINAGE",
        "Electricity": "ELECTRICITY",
        "Roads & Highways": "ROAD",
        "Police": "POLICE",
        "Health": "HEALTH",
        "Education": "EDUCATION",
        "Agriculture": "AGRICULTURE",
        "Housing": "HOUSING",
        "Revenue & Land Records": "REVENUE",
        "Food & Civil Supplies": "FOOD",
        "Transport": "TRANSPORT",
        "Labour & Employment": "LABOUR",
        "Women & Child Welfare": "WOMEN_CHILD",
        "Environment & Forest": "ENVIRONMENT",
        "Social Welfare": "SOCIAL_WELFARE",
        "Public Works": "PUBLIC_WORKS",
        "Rural Development / Panchayat": "RURAL_DEVELOPMENT",
        "e-Governance": "E_GOVERNANCE",
        "Municipal Corporation": "MUNICIPAL",
    }

    return mapping.get(
        department,
        "MUNICIPAL",
    )