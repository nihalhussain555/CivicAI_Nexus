import {
  LayoutDashboard, FilePlus2, FileText, AlertTriangle, Bell, User, Settings,
  ListChecks, Bot, BarChart3, Building2, Users, Map, Sparkles,
} from "lucide-react";

export const NAV_BY_ROLE = {
  citizen: [
    { to: "/citizen/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/citizen/report", label: "Report Issue", icon: FilePlus2 },
    { to: "/citizen/grievances", label: "My Grievances", icon: FileText },
    { to: "/citizen/incidents", label: "Community Incidents", icon: AlertTriangle },
    { to: "/citizen/assistant", label: "Ask CivicAI", icon: Bot },
    { to: "/citizen/notifications", label: "Notifications", icon: Bell },
    { to: "/citizen/profile", label: "Profile", icon: User },
    { to: "/citizen/settings", label: "Settings", icon: Settings },
  ],
  officer: [
    { to: "/officer/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/officer/grievances", label: "Grievances", icon: ListChecks },
    { to: "/officer/incidents", label: "Incidents", icon: AlertTriangle },
    { to: "/officer/assistant", label: "AI Copilot", icon: Bot },
    { to: "/officer/analytics", label: "Analytics", icon: BarChart3 },
    { to: "/officer/profile", label: "Profile", icon: User },
    { to: "/officer/settings", label: "Settings", icon: Settings },
  ],
  admin: [
    { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/admin/grievances", label: "Grievances", icon: FileText },
    { to: "/admin/incidents", label: "Incidents", icon: AlertTriangle },
    { to: "/admin/departments", label: "Departments", icon: Building2 },
    { to: "/admin/officers", label: "Officers", icon: Users },
    { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
    { to: "/admin/map", label: "Map", icon: Map },
    { to: "/admin/ai-insights", label: "AI Insights", icon: Sparkles },
    { to: "/admin/assistant", label: "AI Assistant", icon: Bot },
    { to: "/admin/settings", label: "Settings", icon: Settings },
  ],
};