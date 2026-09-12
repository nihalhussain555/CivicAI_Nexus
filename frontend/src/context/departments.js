/**
 * Canonical CivicAI department names.
 *
 * These values must match backend/app/utils/constants.py exactly.
 *
 * AI prediction
 *      ↓
 * Backend department
 *      ↓
 * Frontend department
 *      ↓
 * Officer department
 */

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

export const DEPARTMENT_OPTIONS = DEPARTMENTS.map(
  (department) => ({
    value: department,
    label: department,
  })
);

export default DEPARTMENTS;