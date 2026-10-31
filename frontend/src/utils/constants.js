export const DEPARTMENTS = [
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
];

export const CATEGORIES = [
  "WASTE",
  "WATER",
  "ROAD",
  "ELECTRICITY",
  "STREET_LIGHT",
  "DRAINAGE",
  "TRAFFIC",
  "PUBLIC_SAFETY",
  "GENERAL",
];

export const CATEGORY_LABELS = {
  WASTE: "Waste",
  WATER: "Water Supply",
  ROAD: "Roads & Highways",
  ELECTRICITY: "Electricity",
  STREET_LIGHT: "Electricity",
  DRAINAGE: "Drainage & Sewerage",
  TRAFFIC: "Police",
  PUBLIC_SAFETY: "Police",
  GENERAL: "Municipal Corporation",
};

export const STATUSES = [
  "SUBMITTED",
  "AI_ANALYZED",
  "DEPARTMENT_ASSIGNED",
  "OFFICER_ACCEPTED",
  "IN_PROGRESS",
  "RESOLUTION_SUBMITTED",
  "CITIZEN_VERIFICATION",
  "CLOSED",
  "REOPENED",
  "ESCALATED",
  "WITHDRAWN",
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
  WITHDRAWN: "Deleted",
};

export const PRIORITIES = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
];

export const LANGUAGES = [
  "English",
  "Hindi",
  "Tamil",
  "Malayalam",
];

export const DISTRICTS = [
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
];

// [lat, lng] for each district headquarters. Used to open the map somewhere
// sensible when a citizen's GPS fix isn't available (permission denied, no
// prompt shown, desktop with no location hardware) — the report still needs a
// pin, and "centre of their district, then drag it" beats a blank map.
// Mirrors DISTRICT_CENTROIDS on the backend; both are static geography, so
// they only drift if a district is ever renamed.
export const DISTRICT_CENTERS = {
  Ariyalur: [11.1401, 79.0782],
  Chengalpattu: [12.6819, 79.9888],
  Chennai: [13.0827, 80.2707],
  Coimbatore: [11.0168, 76.9558],
  Cuddalore: [11.748, 79.7714],
  Dharmapuri: [12.1211, 78.1582],
  Dindigul: [10.3624, 77.9695],
  Erode: [11.341, 77.7172],
  Kallakurichi: [11.7401, 78.9597],
  Kanchipuram: [12.8342, 79.7036],
  Kanyakumari: [8.0883, 77.5385],
  Karur: [10.9601, 78.0766],
  Krishnagiri: [12.5266, 78.215],
  Madurai: [9.9252, 78.1198],
  Mayiladuthurai: [11.1085, 79.6538],
  Nagapattinam: [10.7672, 79.8449],
  Namakkal: [11.2189, 78.1677],
  Nilgiris: [11.4064, 76.6932],
  Perambalur: [11.2342, 78.8807],
  Pudukkottai: [10.3833, 78.8001],
  Ramanathapuram: [9.3639, 78.8395],
  Ranipet: [12.9249, 79.3308],
  Salem: [11.6643, 78.146],
  Sivaganga: [9.8433, 78.4809],
  Tenkasi: [8.9598, 77.3152],
  Thanjavur: [10.787, 79.1378],
  Theni: [10.0104, 77.4768],
  Thoothukudi: [8.7642, 78.1348],
  Tiruchirappalli: [10.7905, 78.7047],
  Tirunelveli: [8.7139, 77.7567],
  Tirupathur: [12.495, 78.5678],
  Tiruppur: [11.1085, 77.3411],
  Tiruvallur: [13.1231, 79.912],
  Tiruvannamalai: [12.2253, 79.0747],
  Tiruvarur: [10.7661, 79.6345],
  Vellore: [12.9165, 79.1325],
  Viluppuram: [11.9401, 79.4861],
  Virudhunagar: [9.581, 77.9624],
};

export const STATE_CENTER = [11.1271, 78.6569]; // middle of Tamil Nadu

export const districtCenter = (district) =>
  DISTRICT_CENTERS[district] || STATE_CENTER;

export const ROLES = {
  CITIZEN: "citizen",
  OFFICER: "officer",
  ADMIN: "admin",
};