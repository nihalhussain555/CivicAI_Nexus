export const CATEGORIES = [
  "WASTE", "WATER", "ROAD", "ELECTRICITY", "STREET_LIGHT",
  "DRAINAGE", "TRAFFIC", "PUBLIC_SAFETY", "GENERAL",
];

export const CATEGORY_LABELS = {
  WASTE: "Waste",
  WATER: "Water Supply",
  ROAD: "Road",
  ELECTRICITY: "Electricity",
  STREET_LIGHT: "Street Light",
  DRAINAGE: "Drainage",
  TRAFFIC: "Traffic",
  PUBLIC_SAFETY: "Public Safety",
  GENERAL: "General",
};

export const STATUSES = [
  "SUBMITTED", "AI_ANALYZED", "DEPARTMENT_ASSIGNED", "OFFICER_ACCEPTED",
  "IN_PROGRESS", "RESOLUTION_SUBMITTED", "CITIZEN_VERIFICATION",
  "CLOSED", "REOPENED", "ESCALATED",
];

export const STATUS_LABELS = {
  SUBMITTED: "Submitted",
  AI_ANALYZED: "AI Analyzed",
  DEPARTMENT_ASSIGNED: "Department Assigned",
  OFFICER_ACCEPTED: "Officer Accepted",
  IN_PROGRESS: "In Progress",
  RESOLUTION_SUBMITTED: "Resolution Submitted",
  CITIZEN_VERIFICATION: "Awaiting Your Verification",
  CLOSED: "Closed",
  REOPENED: "Reopened",
  ESCALATED: "Escalated",
};

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export const LANGUAGES = ["English", "Hindi", "Tamil"];

// This exact list must stay in sync with backend/app/utils/constants.py —
// district values are validated server-side against the same set, so a
// citizen's report and an officer's assigned district always match
// exactly (no free-text drift between geocoding output and this list).
// All 38 Tamil Nadu districts, alphabetical.
export const DISTRICTS = [
  "Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore",
  "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kanchipuram",
  "Kanyakumari", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai",
  "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai",
  "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi",
  "Thanjavur", "Theni", "Thoothukudi", "Tiruchirappalli", "Tirunelveli",
  "Tirupathur", "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur",
  "Vellore", "Viluppuram", "Virudhunagar",
];

export const ROLES = {
  CITIZEN: "citizen",
  OFFICER: "officer",
  ADMIN: "admin",
};