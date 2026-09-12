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
  UserPlus,
} from "lucide-react";

export const NAV_BY_ROLE = {
  citizen: [
    {
      to: "/citizen/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      to: "/citizen/report",
      label: "Report Issue",
      icon: FilePlus2,
    },
    {
      to: "/citizen/grievances",
      label: "My Grievances",
      icon: FileText,
    },
    {
      to: "/citizen/incidents",
      label: "Community Incidents",
      icon: AlertTriangle,
    },
    {
      to: "/citizen/assistant",
      label: "Ask CivicAI",
      icon: Bot,
    },
    {
      to: "/citizen/notifications",
      label: "Notifications",
      icon: Bell,
    },
    {
      to: "/citizen/profile",
      label: "Profile",
      icon: User,
    },
    {
      to: "/citizen/settings",
      label: "Settings",
      icon: Settings,
    },
  ],

  officer: [
    {
      to: "/officer/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      to: "/officer/grievances",
      label: "Grievances",
      icon: ListChecks,
    },
    {
      to: "/officer/incidents",
      label: "Incidents",
      icon: AlertTriangle,
    },
    {
      to: "/officer/assistant",
      label: "AI Copilot",
      icon: Bot,
    },
    {
      to: "/officer/analytics",
      label: "Analytics",
      icon: BarChart3,
    },
    {
      to: "/officer/profile",
      label: "Profile",
      icon: User,
    },
    {
      to: "/officer/settings",
      label: "Settings",
      icon: Settings,
    },
  ],

  admin: [
    {
      to: "/admin/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      to: "/admin/grievances",
      label: "All Grievances",
      icon: FileText,
    },
    {
      to: "/admin/incidents",
      label: "Incidents",
      icon: AlertTriangle,
    },
    {
      to: "/admin/departments",
      label: "Departments",
      icon: Building2,
    },
    {
      to: "/admin/officers",
      label: "Officers",
      icon: Users,
    },
    {
      to: "/admin/admins",
      label: "District Admins",
      icon: ShieldCheck,
      superOnly: true,
    },
    {
      to: "/admin/analytics",
      label: "Analytics",
      icon: BarChart3,
    },
    {
      to: "/admin/map",
      label: "Map",
      icon: Map,
    },
    {
      to: "/admin/ai-insights",
      label: "AI Insights",
      icon: Sparkles,
    },
    {
      to: "/admin/assistant",
      label: "AI Assistant",
      icon: Bot,
    },
    {
      to: "/admin/profile",
      label: "Profile",
      icon: User,
    },
    {
      to: "/admin/settings",
      label: "Settings",
      icon: Settings,
    },
  ],
};

export const getNavigationItems = (user) => {
  if (!user) {
    return [];
  }

  if (user.role !== "admin") {
    return NAV_BY_ROLE[user.role] || [];
  }

  // ---------------------------------------------------------
  // SUPER ADMIN
  // ---------------------------------------------------------

  if (!user.district) {
    return [
      {
        to: "/admin/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
      },
      {
        to: "/admin/grievances",
        label: "All Grievances",
        icon: FileText,
      },
      {
        to: "/admin/incidents",
        label: "Incidents",
        icon: AlertTriangle,
      },
      {
        to: "/admin/departments",
        label: "Departments",
        icon: Building2,
      },
      {
        to: "/admin/officers",
        label: "All Officers",
        icon: Users,
      },
      {
        to: "/admin/admins",
        label: "District Admins",
        icon: ShieldCheck,
      },
      {
        to: "/admin/analytics",
        label: "Platform Analytics",
        icon: BarChart3,
      },
      {
        to: "/admin/map",
        label: "City Map",
        icon: Map,
      },
      {
        to: "/admin/ai-insights",
        label: "AI Insights",
        icon: Sparkles,
      },
      {
        to: "/admin/assistant",
        label: "AI Assistant",
        icon: Bot,
      },
      {
        to: "/admin/profile",
        label: "Profile",
        icon: User,
      },
      {
        to: "/admin/settings",
        label: "Settings",
        icon: Settings,
      },
    ];
  }

  // ---------------------------------------------------------
  // DISTRICT ADMIN
  // ---------------------------------------------------------

  return [
    {
      to: "/admin/district",
      label: "District Dashboard",
      icon: LayoutDashboard,
    },
    {
      to: "/admin/district/unassigned",
      label: "Unassigned Grievances",
      icon: UserPlus,
    },
    {
      to: "/admin/grievances",
      label: "District Grievances",
      icon: FileText,
    },
    {
      to: "/admin/incidents",
      label: "District Incidents",
      icon: AlertTriangle,
    },
    {
      to: "/admin/officers",
      label: "District Officers",
      icon: Users,
    },
    {
      to: "/admin/analytics",
      label: "District Analytics",
      icon: BarChart3,
    },
    {
      to: "/admin/map",
      label: "District Map",
      icon: Map,
    },
    {
      to: "/admin/ai-insights",
      label: "District AI Insights",
      icon: Sparkles,
    },
    {
      to: "/admin/assistant",
      label: "AI Assistant",
      icon: Bot,
    },
    {
      to: "/admin/profile",
      label: "Profile",
      icon: User,
    },
    {
      to: "/admin/settings",
      label: "Settings",
      icon: Settings,
    },
  ];
};