import {
  LayoutDashboard,
  FilePlus2,
  FileText,
  AlertTriangle,
  Bell,
  User,
  Settings,
  ListChecks,
  Bot,
  BarChart3,
  Building2,
  Users,
  Map,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  UserPlus,
  Trophy,
} from "lucide-react";

/*
 * `group` is the translation key (see LanguageContext nav.* entries) for the
 * sidebar section header this item belongs to. Items must stay in the order
 * they should render — Sidebar.jsx emits a header whenever the group changes.
 */

export const NAV_BY_ROLE = {
  citizen: [
    { to: "/citizen/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "nav.groupWorkspace" },
    { to: "/citizen/report", label: "Report Issue", icon: FilePlus2, group: "nav.groupWorkspace" },
    { to: "/citizen/grievances", label: "My Grievances", icon: FileText, group: "nav.groupWorkspace" },
    { to: "/citizen/incidents", label: "Community Incidents", icon: AlertTriangle, group: "nav.groupWorkspace" },
    { to: "/citizen/rewards", label: "Civic Rewards", icon: Trophy, group: "nav.groupWorkspace" },
    { to: "/citizen/assistant", label: "Ask CivicAI", icon: Bot, group: "nav.groupIntelligence" },
    { to: "/citizen/notifications", label: "Notifications", icon: Bell, group: "nav.groupAccount" },
    { to: "/citizen/profile", label: "Profile", icon: User, group: "nav.groupAccount" },
    { to: "/citizen/settings", label: "Settings", icon: Settings, group: "nav.groupAccount" },
  ],

  officer: [
    { to: "/officer/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "nav.groupWorkspace" },
    { to: "/officer/grievances", label: "Grievances", icon: ListChecks, group: "nav.groupWorkspace" },
    { to: "/officer/integrity", label: "Integrity Review", icon: ShieldQuestion, group: "nav.groupWorkspace" },
    { to: "/officer/incidents", label: "Incidents", icon: AlertTriangle, group: "nav.groupWorkspace" },
    { to: "/officer/assistant", label: "AI Copilot", icon: Bot, group: "nav.groupIntelligence" },
    { to: "/officer/analytics", label: "Analytics", icon: BarChart3, group: "nav.groupIntelligence" },
    { to: "/officer/profile", label: "Profile", icon: User, group: "nav.groupAccount" },
    { to: "/officer/settings", label: "Settings", icon: Settings, group: "nav.groupAccount" },
  ],

  admin: [
    { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "nav.groupOversight" },
    { to: "/admin/grievances", label: "All Grievances", icon: FileText, group: "nav.groupOversight" },
    { to: "/admin/incidents", label: "Incidents", icon: AlertTriangle, group: "nav.groupOversight" },
    { to: "/admin/departments", label: "Departments", icon: Building2, group: "nav.groupAdministration" },
    { to: "/admin/officers", label: "Officers", icon: Users, group: "nav.groupAdministration" },
    { to: "/admin/admins", label: "District Admins", icon: ShieldCheck, group: "nav.groupAdministration", superOnly: true },
    { to: "/admin/analytics", label: "Analytics", icon: BarChart3, group: "nav.groupIntelligence" },
    { to: "/admin/map", label: "Map", icon: Map, group: "nav.groupIntelligence" },
    { to: "/admin/ai-insights", label: "AI Insights", icon: Sparkles, group: "nav.groupIntelligence" },
    { to: "/admin/assistant", label: "AI Assistant", icon: Bot, group: "nav.groupIntelligence" },
    { to: "/admin/profile", label: "Profile", icon: User, group: "nav.groupAccount" },
    { to: "/admin/settings", label: "Settings", icon: Settings, group: "nav.groupAccount" },
  ],
};

const SUPER_ADMIN_NAV = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "nav.groupOversight" },
  { to: "/admin/grievances", label: "All Grievances", icon: FileText, group: "nav.groupOversight" },
  { to: "/admin/integrity", label: "Integrity Review", icon: ShieldQuestion, group: "nav.groupOversight" },
  { to: "/admin/incidents", label: "Incidents", icon: AlertTriangle, group: "nav.groupOversight" },
  { to: "/admin/fraud", label: "Fraud & Integrity", icon: ShieldAlert, group: "nav.groupOversight" },
  { to: "/admin/departments", label: "Departments", icon: Building2, group: "nav.groupAdministration" },
  { to: "/admin/officers", label: "All Officers", icon: Users, group: "nav.groupAdministration" },
  { to: "/admin/admins", label: "District Admins", icon: ShieldCheck, group: "nav.groupAdministration" },
  { to: "/admin/analytics", label: "Platform Analytics", icon: BarChart3, group: "nav.groupIntelligence" },
  { to: "/admin/map", label: "City Map", icon: Map, group: "nav.groupIntelligence" },
  { to: "/admin/ai-insights", label: "AI Insights", icon: Sparkles, group: "nav.groupIntelligence" },
  { to: "/admin/assistant", label: "AI Assistant", icon: Bot, group: "nav.groupIntelligence" },
  { to: "/admin/profile", label: "Profile", icon: User, group: "nav.groupAccount" },
  { to: "/admin/settings", label: "Settings", icon: Settings, group: "nav.groupAccount" },
];

const DISTRICT_ADMIN_NAV = [
  { to: "/admin/district", label: "District Dashboard", icon: LayoutDashboard, group: "nav.groupOversight" },
  { to: "/admin/district/unassigned", label: "Unassigned Grievances", icon: UserPlus, group: "nav.groupOversight" },
  { to: "/admin/grievances", label: "District Grievances", icon: FileText, group: "nav.groupOversight" },
  { to: "/admin/integrity", label: "Integrity Review", icon: ShieldQuestion, group: "nav.groupOversight" },
  { to: "/admin/incidents", label: "District Incidents", icon: AlertTriangle, group: "nav.groupOversight" },
  { to: "/admin/fraud", label: "Fraud & Integrity", icon: ShieldAlert, group: "nav.groupOversight" },
  { to: "/admin/officers", label: "District Officers", icon: Users, group: "nav.groupAdministration" },
  { to: "/admin/analytics", label: "District Analytics", icon: BarChart3, group: "nav.groupIntelligence" },
  { to: "/admin/map", label: "District Map", icon: Map, group: "nav.groupIntelligence" },
  { to: "/admin/ai-insights", label: "District AI Insights", icon: Sparkles, group: "nav.groupIntelligence" },
  { to: "/admin/assistant", label: "AI Assistant", icon: Bot, group: "nav.groupIntelligence" },
  { to: "/admin/profile", label: "Profile", icon: User, group: "nav.groupAccount" },
  { to: "/admin/settings", label: "Settings", icon: Settings, group: "nav.groupAccount" },
];

export const getNavigationItems = (user) => {
  if (!user) return [];

  if (user.role === "admin") {
    return user.district ? DISTRICT_ADMIN_NAV : SUPER_ADMIN_NAV;
  }

  return NAV_BY_ROLE[user.role] || [];
};

/*
 * Nav path -> translation key. Sidebar renders the translated label and the
 * topbar builds breadcrumbs from the same source, so a rename only happens
 * once. Paths with no entry fall back to their `label`.
 */
export const NAV_LABEL_KEY = {
  "/citizen/dashboard": "nav.dashboard", "/officer/dashboard": "nav.dashboard", "/admin/dashboard": "nav.dashboard",
  "/citizen/report": "nav.report",
  "/citizen/grievances": "nav.grievances", "/officer/grievances": "nav.grievances", "/admin/grievances": "nav.grievances",
  "/citizen/rewards": "nav.rewards",
  "/citizen/incidents": "nav.incidents", "/officer/incidents": "nav.incidents", "/admin/incidents": "nav.incidents",
  "/citizen/assistant": "nav.assistant", "/admin/assistant": "nav.assistant",
  "/officer/copilot": "nav.copilot",
  "/officer/assistant": "nav.copilot",
  "/officer/analytics": "nav.analytics", "/admin/analytics": "nav.analytics",
  "/citizen/notifications": "nav.notifications", "/officer/notifications": "nav.notifications", "/admin/notifications": "nav.notifications",
  "/citizen/profile": "nav.profile", "/officer/profile": "nav.profile", "/admin/profile": "nav.profile",
  "/citizen/settings": "nav.settings", "/officer/settings": "nav.settings", "/admin/settings": "nav.settings",
  "/admin/departments": "nav.departments",
  "/admin/officers": "nav.officers",
  "/admin/admins": "nav.admins",
  "/admin/map": "nav.map",
  "/admin/ai-insights": "nav.aiInsights",
  "/officer/integrity": "nav.integrity", "/admin/integrity": "nav.integrity",
  "/admin/fraud": "nav.fraud",
  "/admin/district": "nav.district",
  "/admin/district/unassigned": "nav.unassigned",
};

export const AREA_LABEL = {
  citizen: "Citizen portal",
  officer: "Officer workspace",
  admin: "Administration",
};

/*
 * Breadcrumb trail for a pathname: area root > current nav item > trailing
 * segment (grievance ID, officer ID, …). Detail routes are not in the nav
 * list, so the deepest segment is shown as plain text.
 */
export const getBreadcrumbs = (user, pathname) => {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return [];

  const area = segments[0];
  const items = getNavigationItems(user);

  const exact = items.find((item) => item.to === pathname);

  const parent =
    exact ||
    items
      .filter((item) => pathname.startsWith(`${item.to}/`))
      .sort((a, b) => b.to.length - a.to.length)[0];

  const crumbs = [];

  const dashboard = items.find((item) => item.to.endsWith("/dashboard"));

  if (dashboard && dashboard.to !== pathname) {
    crumbs.push({ label: AREA_LABEL[area] || "CivicAI Nexus", to: dashboard.to });
  }

  if (parent) {
    crumbs.push({ label: NAV_LABEL_KEY[parent.to] || parent.label, to: parent.to, key: NAV_LABEL_KEY[parent.to] });

    if (!exact) {
      crumbs.push({ label: segments[segments.length - 1] });
    }
  } else if (segments.length > 1) {
    crumbs.push({ label: segments[segments.length - 1] });
  }

  return crumbs;
};

