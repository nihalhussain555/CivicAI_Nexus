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
  "REJECTED",
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
  REJECTED: "Rejected",
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

// What a citizen actually asks about their own reports: is anyone working on
// it, is it my turn, or is it finished. Twelve statuses answer none of those
// questions, so the list groups them here — using the same plain-language
// ladder the tracking page already draws (TRACKING_STAGES in
// backend/app/models/grievance.py), so the filter and the timeline never
// disagree about what "Resolved" means. `statuses` are real statuses: the
// bucket is a query the backend runs unchanged, not a computed idea.
export const STATUS_BUCKETS = [
  {
    key: "progress",
    label: "In progress",
    statuses: [
      "SUBMITTED",
      "AI_ANALYZED",
      "DEPARTMENT_ASSIGNED",
      "OFFICER_ACCEPTED",
      "IN_PROGRESS",
      "RESOLUTION_SUBMITTED",
      "REOPENED",
      "ESCALATED",
    ],
  },
  { key: "action", label: "Needs your action", statuses: ["CITIZEN_VERIFICATION"] },
  { key: "resolved", label: "Resolved", statuses: ["CLOSED"] },
  { key: "rejected", label: "Not taken up", statuses: ["REJECTED"] },
];

// Every status the citizen's list can filter on: the buckets first, so the
// common case is one tap, then the exact statuses behind a "Specific status"
// select. Built from STATUS_BUCKETS so a status cannot be forgotten in one of
// the two views — anything missing from a bucket still appears below it.
export const UNBUCKETED_STATUSES = STATUSES.filter(
  (s) => !STATUS_BUCKETS.some((bucket) => bucket.statuses.includes(s))
);

// What a category is *called*, as opposed to CATEGORY_LABELS above, which maps
// a category to the department that owns it. Someone filtering incidents is
// naming the problem, not the desk behind it.
export const CATEGORY_NAMES = {
  WASTE: "Waste",
  WATER: "Water supply",
  ROAD: "Roads",
  ELECTRICITY: "Electricity",
  STREET_LIGHT: "Street lights",
  DRAINAGE: "Drainage",
  TRAFFIC: "Traffic",
  PUBLIC_SAFETY: "Public safety",
  GENERAL: "General",
};

// Incident lifecycle — a different machine from the grievance statuses, and
// much shorter (see backend/app/models/incident.py).
export const INCIDENT_STATUSES = ["ACTIVE", "MONITORING", "RESOLVED"];

export const INCIDENT_STATUS_LABELS = {
  ACTIVE: "Active",
  MONITORING: "Being watched",
  RESOLVED: "Resolved",
};

// The languages a citizen can report in. Mirrors SUPPORTED_LANGUAGES on the
// backend (app/services/translation_service.py); this is the complaint language,
// not the app chrome — the interface menus only translate into the four
// languages in context/translations.js.
export const LANGUAGES = [
  "English",
  "Hindi",
  "Tamil",
  "Telugu",
  "Kannada",
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
// Human-readable names for every signal the backend authenticity engine can
// emit (see backend/app/services/authenticity_service.py). Reviewers read these
// in two places — the case card and the integrity queue — so they live here
// rather than being written twice. A signal with no entry falls back to its
// raw key, which is still readable.
export const SIGNAL_LABELS = {
  test_phrase: "Test entry", mostly_symbols: "Mostly symbols", very_short: "Very short",
  repeated_characters: "Repeated characters", keyboard_mashing: "Keyboard mashing",
  vowelless_words: "Random typing", repetitive_text: "Repetitive text", all_caps: "All capitals",
  spam_markers: "Links / promotion", detailed: "Detailed description", landmark_mentioned: "Landmark mentioned",
  duration_or_number: "Duration / number given", null_island: "Placeholder location",
  outside_service_area: "Outside service area", no_coordinates: "No GPS location", no_address: "No address",
  photo_attached: "Photo evidence", brand_new_account: "Brand-new account", new_account: "New account",
  submission_burst: "Burst of submissions", high_daily_volume: "High daily volume",
  strongly_corroborated: "Others reported it nearby", corroborated: "Another citizen reported it",
  severe_but_vague: "Severe but vague", repeat_of_own_report: "Repeats own report",
  // Evidence reuse (server-side photo signatures)
  recycled_evidence: "Photo reused on unrelated reports", shared_evidence: "Same photo from other accounts",
  reused_own_photo: "Own photo reused",
  // Cross-account wording
  coordinated_campaign: "Coordinated campaign", templated_text: "Template-like wording",
  // Account standing
  low_trust_account: "Low-trust account", prior_substantiated_flag: "Earlier report flagged false",
  verified_history: "Has a verified report", trusted_account: "Trusted account",
  // Estimators
  estimator_disagreement: "Rule/AI disagreement",
};
