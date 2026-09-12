"""
Application-wide canonical constants.

IMPORTANT:
The department names in this file are the canonical values used by:

    AI classifier
    ↓
    grievance.department
    ↓
    department API
    ↓
    frontend department dropdown
    ↓
    officer.department
    ↓
    officer assignment

Do not create another department list with different names.
"""

# ============================================================
# CANONICAL DEPARTMENTS
# ============================================================

DEPARTMENTS = [
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


# ============================================================
# DEPARTMENT CODES
# ============================================================

DEPARTMENT_CODES = {
    "Municipal Corporation": "MUN",
    "Police": "POL",
    "Health": "HLT",
    "Education": "EDU",
    "Electricity": "ELE",
    "Water Supply": "WAT",
    "Roads & Highways": "RHD",
    "Sanitation & Waste Management": "SWM",
    "Agriculture": "AGR",
    "Housing": "HOU",
    "Revenue & Land Records": "RLR",
    "Food & Civil Supplies": "FCS",
    "Transport": "TRN",
    "Labour & Employment": "LAB",
    "Women & Child Welfare": "WCW",
    "Environment & Forest": "ENV",
    "Social Welfare": "SOW",
    "Public Works": "PWD",
    "Rural Development / Panchayat": "RDP",
    "e-Governance": "EGO",
    "Drainage & Sewerage": "DRS",
}


# ============================================================
# OLD DEPARTMENT NAME ALIASES
# ============================================================
#
# These aliases are intentionally kept only for migration and
# compatibility with old MongoDB records / old trained models.
#
# New data MUST always use the canonical department names above.
# ============================================================

DEPARTMENT_ALIASES = {
    "Water Services": "Water Supply",
    "Water Supply Department": "Water Supply",
    "Water and Sanitation Department": "Water Supply",

    "Waste Management": "Sanitation & Waste Management",
    "Sanitation Department": "Sanitation & Waste Management",
    "Sanitation & Waste Department": "Sanitation & Waste Management",

    "Public Works Department": "Public Works",

    "Traffic Police Department": "Police",
    "Police Department": "Police",

    "Electricity Department": "Electricity",

    "Health Department": "Health",

    "Education Department": "Education",

    "Agriculture Department": "Agriculture",

    "Housing Department": "Housing",

    "Revenue Department": "Revenue & Land Records",
    "Land Records Department": "Revenue & Land Records",

    "Food Department": "Food & Civil Supplies",
    "Civil Supplies Department": "Food & Civil Supplies",

    "Transport Department": "Transport",

    "Labour Department": "Labour & Employment",
    "Employment Department": "Labour & Employment",

    "Women and Child Welfare Department": "Women & Child Welfare",

    "Environment Department": "Environment & Forest",
    "Forest Department": "Environment & Forest",

    "Social Welfare Department": "Social Welfare",

    "Rural Development Department": "Rural Development / Panchayat",
    "Panchayat Department": "Rural Development / Panchayat",

    "E-Governance": "e-Governance",
    "E-Governance Department": "e-Governance",

    "Drainage Department": "Drainage & Sewerage",
    "Sewerage Department": "Drainage & Sewerage",
}


# ============================================================
# CATEGORIES
# ============================================================

CATEGORIES = [
    "WASTE",
    "WATER",
    "ROAD",
    "ELECTRICITY",
    "STREET_LIGHT",
    "DRAINAGE",
    "TRAFFIC",
    "PUBLIC_SAFETY",
    "GENERAL",
]


DEPARTMENT_TO_CATEGORY = {
    "Municipal Corporation": "GENERAL",
    "Police": "PUBLIC_SAFETY",
    "Health": "GENERAL",
    "Education": "GENERAL",
    "Electricity": "ELECTRICITY",
    "Water Supply": "WATER",
    "Roads & Highways": "ROAD",
    "Sanitation & Waste Management": "WASTE",
    "Agriculture": "GENERAL",
    "Housing": "GENERAL",
    "Revenue & Land Records": "GENERAL",
    "Food & Civil Supplies": "GENERAL",
    "Transport": "TRAFFIC",
    "Labour & Employment": "GENERAL",
    "Women & Child Welfare": "GENERAL",
    "Environment & Forest": "GENERAL",
    "Social Welfare": "GENERAL",
    "Public Works": "ROAD",
    "Rural Development / Panchayat": "GENERAL",
    "e-Governance": "GENERAL",
    "Drainage & Sewerage": "DRAINAGE",
}


# ============================================================
# HELPERS
# ============================================================

def normalize_department(value: str) -> str:
    """
    Convert an old department name into the canonical name.

    Unknown values are returned unchanged so the caller can
    explicitly validate them.
    """

    if not value:
        return ""

    value = str(value).strip()

    if value in DEPARTMENTS:
        return value

    return DEPARTMENT_ALIASES.get(value, value)


def is_valid_department(value: str) -> bool:
    """Return True only for canonical department names."""

    return normalize_department(value) in DEPARTMENTS


# ============================================================
# TAMIL NADU DISTRICTS
# ============================================================

DISTRICTS = [
    "Ariyalur",
    "Chengalpattu",
    "Chennai",
    "Coimbatore",
    "Cuddalore",
    "Dharmapuri",
    "Dindigul",
    "Erode",
    "Kallakurichi",
    "Kanchipuram",
    "Kanyakumari",
    "Karur",
    "Krishnagiri",
    "Madurai",
    "Mayiladuthurai",
    "Nagapattinam",
    "Namakkal",
    "Nilgiris",
    "Perambalur",
    "Pudukkottai",
    "Ramanathapuram",
    "Ranipet",
    "Salem",
    "Sivaganga",
    "Tenkasi",
    "Thanjavur",
    "Theni",
    "Thoothukudi",
    "Tiruchirappalli",
    "Tirunelveli",
    "Tirupathur",
    "Tiruppur",
    "Tiruvallur",
    "Tiruvannamalai",
    "Tiruvarur",
    "Vellore",
    "Viluppuram",
    "Virudhunagar",
]