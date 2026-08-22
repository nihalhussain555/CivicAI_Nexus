CATEGORIES = {

    "WASTE": [
        "garbage",
        "waste",
        "trash",
        "rubbish",
        "dump",
        "dustbin",
        "sanitation",
        "bin",
        "bins",
        "litter",
        "collection"
    ],

    "WATER": [
        "water",
        "pipeline",
        "leakage",
        "tap",
        "water supply",
        "drinking water"
    ],

    "ROAD": [
        "road",
        "pothole",
        "highway",
        "road damage",
        "street damage",
        "footpath",
        "pavement",
        "railing"
    ],

    "ELECTRICITY": [
        "electricity",
        "power",
        "current",
        "wire",
        "power cut",
        "blackout"
    ],

    "STREET_LIGHT": [
        "street light",
        "streetlight",
        "lamp",
        "light not working",
        "road light"
    ],

    "DRAINAGE": [
        "drain",
        "sewage",
        "flood",
        "overflow",
        "drainage",
        "sewer",
        "waterlog",
        "waterlogging",
        "stagnant"
    ],

    "TRAFFIC": [
        "traffic",
        "signal",
        "parking",
        "vehicle",
        "traffic jam"
    ],

    "PUBLIC_SAFETY": [
        "crime",
        "unsafe",
        "danger",
        "threat",
        "accident",
        "safety"
    ]
}


DEPARTMENTS = {

    "WASTE":
        "Sanitation Department",

    "WATER":
        "Water Supply Department",

    "ROAD":
        "Public Works Department",

    "ELECTRICITY":
        "Electricity Department",

    "STREET_LIGHT":
        "Electricity Department",

    "DRAINAGE":
        "Public Works Department",

    "TRAFFIC":
        "Traffic Police Department",

    "PUBLIC_SAFETY":
        "Public Safety Department",

    "GENERAL":
        "General Administration"
}


def classify_complaint(text):

    text = text.lower()

    scores = {}

    for category, keywords in CATEGORIES.items():

        score = 0

        for keyword in keywords:

            if keyword in text:

                score += 1

        scores[category] = score

    category = max(
        scores,
        key=scores.get
    )

    if scores[category] == 0:

        category = "GENERAL"

    department = DEPARTMENTS.get(
        category,
        DEPARTMENTS["GENERAL"]
    )

    return {
        "category": category,
        "department": department,
        "scores": scores
    }