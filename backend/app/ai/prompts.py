"""
Prompt construction for the AI grievance-analysis pipeline.

This is the actual fix for department-misclassification: previously each
provider (OpenAI/Gemini/Groq) sent the LLM a completely bare prompt with
no department list, no examples, and no disambiguation guidance — meaning
a confident-but-wrong answer like "Municipal Corporation" for a water
complaint was a syntactically valid canonical department name, so it
sailed straight through normalize_department() with nothing to catch it.

build_analysis_prompt() fixes that by giving the model:
  1. The exact closed list of departments it must choose from
  2. One-line disambiguation notes for the departments that most often
     get confused with each other
  3. A curated set of few-shot examples spanning English/Tamil/Hindi,
     short and detailed complaints, typos/colloquial phrasing, and a few
     explicit "looks like X but is actually Y" negative examples
  4. A required "reason" field so the citizen/officer can see *why* the
     AI made the call it did, not just the raw label
"""

from app.services.classification_service import CANONICAL_DEPARTMENTS


DEPARTMENT_DISAMBIGUATION_NOTES = """
Departments that are frequently confused — read carefully:

- "Water Supply" = the citizen cannot get drinking/tap water, low pressure,
  a broken water pipe/connection. NOT the same as drainage or sewage.
- "Drainage & Sewerage" = blocked drains, sewage overflow, waterlogging,
  stagnant water on streets. This is about water LEAVING/pooling, not
  water supply coming in.
- "Municipal Corporation" = general civic upkeep not covered by a more
  specific department: street cleaning, public toilets, stray animals,
  general local civic service. Use this ONLY when nothing more specific
  fits — it is a fallback, not a default. If the complaint mentions
  water/drainage/roads/electricity by name, use THAT department, not
  Municipal Corporation.
- "Roads & Highways" = potholes, broken road surface, footpaths. If the
  complaint is about a government BUILDING's condition/repair rather than
  a road, prefer "Public Works" instead.
- "Public Works" = government building maintenance, bridges, culverts —
  physical government infrastructure that isn't a road or a home.
- "Police" = crime, theft, threats, traffic violations/accidents. A
  broken traffic SIGNAL LIGHT (the electrical fixture itself) is
  "Electricity", not Police — but someone ignoring a signal is Police.
- "Electricity" = power cuts, broken streetlights, transformers, wiring.
""".strip()


FEW_SHOT_EXAMPLES = [
    # --- Tamil ---
    {
        "language": "Tamil",
        "text": "எங்கள் பகுதியில் குடிநீர் வரவில்லை",
        "department": "Water Supply", "category": "WATER", "priority": "HIGH",
        "reason": "Complaint explicitly says drinking water is not coming to the area — a water-supply outage.",
    },
    {
        "language": "Tamil",
        "text": "3 நாட்களா தண்ணீர் இல்லை, குழந்தைகளுக்கு குடிக்க தண்ணீர் கூட இல்லை",
        "department": "Water Supply", "category": "WATER", "priority": "CRITICAL",
        "reason": "No water for 3 days affecting children's drinking water — severe, ongoing water-supply failure.",
    },
    {
        "language": "Tamil",
        "text": "சாலையில் பெரிய குழி, பைக் விபத்து ஆச்சு",
        "department": "Roads & Highways", "category": "ROAD", "priority": "HIGH",
        "reason": "A large pothole caused a vehicle accident — a road-surface hazard.",
    },
    {
        "language": "Tamil",
        "text": "எங்க தெருவுல வடிகால் அடைப்பு, நாத்தம் அடிக்குது",
        "department": "Drainage & Sewerage", "category": "DRAINAGE", "priority": "MEDIUM",
        "reason": "Blocked street drain causing bad odor — a drainage issue, not water supply.",
    },
    # --- Malayalam ---
    {
        "language": "Malayalam",
        "text": "ഞങ്ങളുടെ പ്രദേശത്ത് കുടിവെള്ളം കിട്ടുന്നില്ല",
        "department": "Water Supply", "category": "WATER", "priority": "HIGH",
        "reason": "Complaint explicitly says drinking water is not available in the area — a water-supply outage.",
    },
    {
        "language": "Malayalam",
        "text": "റോഡിൽ വലിയ കുഴി, ബൈക്ക് അപകടം ഉണ്ടായി",
        "department": "Roads & Highways", "category": "ROAD", "priority": "HIGH",
        "reason": "A large pothole caused a bike accident — a road-surface hazard.",
    },
    {
        "language": "Malayalam",
        "text": "ഞങ്ങളുടെ തെരുവിലെ ഡ്രെയിൻ ബ്ലോക്ക് ആയി, ദുർഗന്ധം വരുന്നു",
        "department": "Drainage & Sewerage", "category": "DRAINAGE", "priority": "MEDIUM",
        "reason": "Blocked street drain causing bad odor — a drainage issue, not water supply.",
    },
    # --- Hindi ---
    {
        "language": "Hindi",
        "text": "हमारे इलाके में 2 दिन से पानी नहीं आ रहा है",
        "department": "Water Supply", "category": "WATER", "priority": "HIGH",
        "reason": "No water supply for 2 days in the area.",
    },
    {
        "language": "Hindi",
        "text": "सड़क पर बहुत बड़ा गड्ढा है, गाड़ी चलाना मुश्किल",
        "department": "Roads & Highways", "category": "ROAD", "priority": "MEDIUM",
        "reason": "Large pothole making the road difficult to drive on.",
    },
    {
        "language": "Hindi",
        "text": "नाली बंद है, गंदा पानी सड़क पर भर गया",
        "department": "Drainage & Sewerage", "category": "DRAINAGE", "priority": "HIGH",
        "reason": "Blocked drain has caused dirty water to flood the street.",
    },
    {
        "language": "Hindi",
        "text": "बिजली कटौती 5 घंटे से चल रही है, ट्रांसफॉर्मर खराब लग रहा है",
        "department": "Electricity", "category": "ELECTRICITY", "priority": "HIGH",
        "reason": "5-hour power outage, likely transformer fault.",
    },
    # --- English: short, detailed, colloquial/typo ---
    {
        "language": "English",
        "text": "no water since morning pls help",
        "department": "Water Supply", "category": "WATER", "priority": "HIGH",
        "reason": "Short complaint but clearly reports a water-supply outage since morning.",
    },
    {
        "language": "English",
        "text": "watr not comin 2 days area gandhi nagar very difficult for us plz do something fast",
        "department": "Water Supply", "category": "WATER", "priority": "HIGH",
        "reason": "Colloquial spelling of 'water not coming' — a 2-day water-supply outage.",
    },
    {
        "language": "English",
        "text": (
            "For the past week, our street in the Ashok Nagar locality has had extremely low water "
            "pressure in the mornings, and on two occasions the taps ran completely dry for several "
            "hours. Several elderly residents on the street are struggling to store enough water for "
            "daily use. We would appreciate an inspection of the pipeline connecting to the main line."
        ),
        "department": "Water Supply", "category": "WATER", "priority": "HIGH",
        "reason": "Detailed report of a week of low pressure and dry taps affecting multiple residents.",
    },
    {
        "language": "English",
        "text": "streetlight near the bus stop has been off for a week, its dark and unsafe at night",
        "department": "Electricity", "category": "ELECTRICITY", "priority": "MEDIUM",
        "reason": "A non-functioning streetlight is an electrical fixture issue, not a police safety matter.",
    },
    {
        "language": "English",
        "text": "someone broke into my shop last night and stole cash, please help",
        "department": "Police", "category": "SAFETY", "priority": "HIGH",
        "reason": "Reports theft/burglary — a crime, handled by Police.",
    },
    {
        "language": "English",
        "text": "the community toilet near the market is filthy and hasn't been cleaned in weeks",
        "department": "Municipal Corporation", "category": "MUNICIPAL", "priority": "MEDIUM",
        "reason": "General civic cleanliness of a public toilet — falls under Municipal Corporation.",
    },
    {
        "language": "English",
        "text": "garbage truck hasn't come to our street in 10 days, trash piling up everywhere",
        "department": "Sanitation & Waste Management", "category": "WASTE", "priority": "HIGH",
        "reason": "Garbage collection has stopped for 10 days — a waste-management service failure.",
    },
    # --- Disambiguation / negative examples: things that LOOK like one
    # department but are actually another. These matter most. ---
    {
        "language": "English",
        "text": "the water tax bill I received this month has a completely wrong amount, please correct it",
        "department": "Revenue & Land Records", "category": "REVENUE", "priority": "LOW",
        "reason": "Despite mentioning 'water', this is a billing/tax record dispute, not a water-supply outage — Revenue handles billing records.",
    },
    {
        "language": "English",
        "text": "the roof of our government primary health centre building is leaking badly during rain",
        "department": "Public Works", "category": "PUBLIC_WORKS", "priority": "MEDIUM",
        "reason": "This is about the physical government building's condition, not the health service itself — Public Works handles building maintenance.",
    },
    {
        "language": "English",
        "text": "water is stagnating on the road after every rain and mosquitoes are breeding",
        "department": "Drainage & Sewerage", "category": "DRAINAGE", "priority": "MEDIUM",
        "reason": "Mentions 'water' but the actual issue is standing/stagnant water and drainage, not a water-supply shortage.",
    },
    {
        "language": "English",
        "text": "the traffic signal at the main junction has been stuck on red for 2 days",
        "department": "Electricity", "category": "ELECTRICITY", "priority": "MEDIUM",
        "reason": "A malfunctioning signal light is an electrical/equipment fault, not a traffic-law violation Police would handle.",
    },
    {
        "language": "English",
        "text": "our farm's irrigation canal has dried up, crops are dying",
        "department": "Agriculture", "category": "AGRICULTURE", "priority": "HIGH",
        "reason": "Irrigation for crops is an agricultural concern, distinct from municipal drinking-water supply.",
    },
    {
        "language": "English",
        "text": "ration shop owner is refusing to give our full quota of rice this month",
        "department": "Food & Civil Supplies", "category": "FOOD", "priority": "MEDIUM",
        "reason": "Ration/PDS quota dispute falls under Food & Civil Supplies.",
    },
]


def _format_examples() -> str:
    lines = []
    for ex in FEW_SHOT_EXAMPLES:
        lines.append(
            f'- [{ex["language"]}] "{ex["text"]}"\n'
            f'  -> department: {ex["department"]}, category: {ex["category"]}, '
            f'priority: {ex["priority"]}, reason: {ex["reason"]}'
        )
    return "\n".join(lines)


ANALYSIS_JSON_SCHEMA_HINT = """
Return ONLY a JSON object (no markdown, no commentary) with exactly these keys:
{
  "category": string,
  "subcategory": string or null,
  "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "urgency_score": integer 0-100,
  "priority": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "priority_score": integer 0-100,
  "confidence": number 0-1 (your genuine confidence in the department classification — do not default to a high number; use lower values when the complaint is ambiguous, very short, or could plausibly fit more than one department),
  "sentiment": "POSITIVE" | "NEUTRAL" | "NEGATIVE",
  "recommended_department": string (MUST be exactly one of the canonical department names given below — copy it verbatim, do not invent or rephrase a department name),
  "reason": string (1 short sentence explaining WHY this department and priority were chosen, referencing what in the complaint text led to that decision),
  "summary": string (1-2 sentences, plain language),
  "recommended_action": string (1 sentence, actionable for a government officer)
}
"""


def build_analysis_prompt(text: str, language: str = "English") -> str:
    department_list = "\n".join(f"- {d}" for d in CANONICAL_DEPARTMENTS)

    return f"""You are CivicAI, an AI system that triages citizen civic grievances for a
government department. You work in stages: understand the complaint's real intent,
pick the SINGLE most specific matching department (not a vague fallback), assess
priority, and honestly report your confidence.

You MUST choose "recommended_department" from exactly this list (copy the name
verbatim — do not invent, translate, or rephrase a department name):
{department_list}

{DEPARTMENT_DISAMBIGUATION_NOTES}

Worked examples (language -> input -> correct output). Study these carefully,
especially the ones near the end that show a complaint mentioning one department's
keyword but actually belonging to a different department:

{_format_examples()}

{ANALYSIS_JSON_SCHEMA_HINT}

Now analyze this citizen complaint.

Language: {language}
Grievance text:
{text}
"""


CHAT_PROMPT = """
You are CivicAI, a multilingual government
grievance assistant.

Help citizens:

- understand civic complaint procedures
- create complaints
- understand complaint categories
- track their complaint
- understand department assignments

Do not invent government policies.

If information is unavailable,
clearly tell the citizen.

User language:
{language}

Question:
{message}
"""