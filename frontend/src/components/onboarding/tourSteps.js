import {
  Sparkles,
  LayoutDashboard,
  FilePlus2,
  FileText,
  Trophy,
  AlertTriangle,
  Bot,
  ListChecks,
  BarChart3,
  Building2,
  Users,
  Map,
  ShieldCheck,
  UserPlus,
  User,
  Settings,
  Bell,
} from "lucide-react";

/*
 * Find an existing sidebar item using its React Router route.
 *
 * Your Sidebar already renders:
 *
 * <NavLink to={to}>
 *
 * Therefore we can locate the exact item using:
 *
 * a[href="/citizen/report"]
 *
 * No data-tour attributes are required.
 */

const routeTarget = (path) => {
  return `a[href="${path}"]`;
};

export const TOUR_STEPS_BY_ROLE = {

  /* =====================================================
     CITIZEN
     ===================================================== */

  citizen: [
    {
      icon: Sparkles,
      title: "Welcome to CivicAI Nexus",
      description:
        "Welcome to CivicAI Nexus. This quick tour shows you the important features available in your workspace.",
    },

    {
      icon: LayoutDashboard,
      title: "Your Dashboard",
      description:
        "Your dashboard gives you a quick overview of your grievances, activity, notifications, and civic participation.",
      target: routeTarget(
        "/citizen/dashboard"
      ),
    },

    {
      icon: FilePlus2,
      title: "Report an Issue",
      description:
        "Report civic problems such as potholes, broken streetlights, garbage, water issues, or other public concerns. You can provide details and supporting evidence.",
      target: routeTarget(
        "/citizen/report"
      ),
    },

    {
      icon: FileText,
      title: "My Grievances",
      description:
        "Track the grievances you have submitted. You can follow their status, department assignment, progress, and resolution history.",
      target: routeTarget(
        "/citizen/grievances"
      ),
    },

    {
      icon: Trophy,
      title: "Civic Rewards",
      description:
        "View your Civic Points, achievements, badges, certificates, and other participation milestones.",
      target: routeTarget(
        "/citizen/rewards"
      ),
    },

    {
      icon: AlertTriangle,
      title: "Community Incidents",
      description:
        "See community incidents created from related reports in your area and understand larger civic problems affecting the community.",
      target: routeTarget(
        "/citizen/incidents"
      ),
    },

    {
      icon: Bot,
      title: "Ask CivicAI",
      description:
        "Use the CivicAI assistant when you need help understanding the platform, reporting an issue, or getting information about your grievances.",
      target: routeTarget(
        "/citizen/assistant"
      ),
    },

    {
      icon: Bell,
      title: "Notifications",
      description:
        "Stay updated about grievance assignments, status changes, officer actions, resolutions, and other important activity.",
      target: routeTarget(
        "/citizen/notifications"
      ),
    },

    {
      icon: User,
      title: "Your Profile",
      description:
        "Manage your personal profile information and view your account details.",
      target: routeTarget(
        "/citizen/profile"
      ),
    },

    {
      icon: Settings,
      title: "Settings",
      description:
        "Manage your account preferences and restart this onboarding tour whenever you want.",
      target: routeTarget(
        "/citizen/settings"
      ),
    },
  ],

  /* =====================================================
     OFFICER
     ===================================================== */

  officer: [
    {
      icon: Sparkles,
      title: "Welcome, Officer",
      description:
        "Welcome to your CivicAI workspace. This quick tour shows you the main tools available for handling grievances.",
    },

    {
      icon: LayoutDashboard,
      title: "Officer Dashboard",
      description:
        "Get an overview of your assigned work, grievance activity, priorities, and current operational status.",
      target: routeTarget(
        "/officer/dashboard"
      ),
    },

    {
      icon: ListChecks,
      title: "Grievances",
      description:
        "Review grievances assigned to you and your department. Open cases to review their details, priority, AI analysis, and required actions.",
      target: routeTarget(
        "/officer/grievances"
      ),
    },

    {
      icon: AlertTriangle,
      title: "Community Incidents",
      description:
        "View related reports that have been grouped into community incidents to identify larger or repeated civic problems.",
      target: routeTarget(
        "/officer/incidents"
      ),
    },

    {
      icon: Bot,
      title: "AI Copilot",
      description:
        "Use the AI Copilot to help understand grievance details, summarize case history, and assist with your workflow.",
      target: routeTarget(
        "/officer/assistant"
      ),
    },

    {
      icon: BarChart3,
      title: "Analytics",
      description:
        "Monitor grievance activity, workload, resolution progress, and other operational metrics.",
      target: routeTarget(
        "/officer/analytics"
      ),
    },

    {
      icon: User,
      title: "Profile",
      description:
        "View and manage your officer profile and account information.",
      target: routeTarget(
        "/officer/profile"
      ),
    },

    {
      icon: Settings,
      title: "Settings",
      description:
        "Manage your account settings and restart the onboarding tour whenever required.",
      target: routeTarget(
        "/officer/settings"
      ),
    },
  ],

  /* =====================================================
     SUPER ADMIN
     ===================================================== */

  superAdmin: [
    {
      icon: Sparkles,
      title: "Welcome, Super Admin",
      description:
        "Welcome to the CivicAI platform administration workspace. This tour introduces the main platform management tools.",
    },

    {
      icon: LayoutDashboard,
      title: "Platform Dashboard",
      description:
        "Monitor the overall CivicAI platform and get a high-level view of activity across districts.",
      target: routeTarget(
        "/admin/dashboard"
      ),
    },

    {
      icon: FileText,
      title: "All Grievances",
      description:
        "Review grievances across the platform and monitor their lifecycle from submission through resolution.",
      target: routeTarget(
        "/admin/grievances"
      ),
    },

    {
      icon: AlertTriangle,
      title: "Incidents",
      description:
        "Monitor community incidents and identify groups of related grievances across areas.",
      target: routeTarget(
        "/admin/incidents"
      ),
    },

    {
      icon: Building2,
      title: "Departments",
      description:
        "Manage the departments used by CivicAI to organize and route civic grievances.",
      target: routeTarget(
        "/admin/departments"
      ),
    },

    {
      icon: Users,
      title: "All Officers",
      description:
        "Manage officers, their departments, districts, and operational assignments.",
      target: routeTarget(
        "/admin/officers"
      ),
    },

    {
      icon: ShieldCheck,
      title: "District Admins",
      description:
        "Manage district administrator access and oversee district-level administration.",
      target: routeTarget(
        "/admin/admins"
      ),
    },

    {
      icon: BarChart3,
      title: "Platform Analytics",
      description:
        "Review platform-wide grievance activity, resolution metrics, department performance, and trends.",
      target: routeTarget(
        "/admin/analytics"
      ),
    },

    {
      icon: Map,
      title: "City Map",
      description:
        "View geographically distributed grievances and incidents to identify patterns and hotspots.",
      target: routeTarget(
        "/admin/map"
      ),
    },

    {
      icon: Sparkles,
      title: "AI Insights",
      description:
        "Explore AI-generated insights and patterns across grievances, departments, and districts.",
      target: routeTarget(
        "/admin/ai-insights"
      ),
    },

    {
      icon: Bot,
      title: "AI Assistant",
      description:
        "Ask the CivicAI assistant for help understanding platform information and administrative workflows.",
      target: routeTarget(
        "/admin/assistant"
      ),
    },

    {
      icon: User,
      title: "Profile",
      description:
        "Manage your administrator profile and account information.",
      target: routeTarget(
        "/admin/profile"
      ),
    },

    {
      icon: Settings,
      title: "Settings",
      description:
        "Manage account preferences and restart this onboarding tour.",
      target: routeTarget(
        "/admin/settings"
      ),
    },
  ],

  /* =====================================================
     DISTRICT ADMIN
     ===================================================== */

  districtAdmin: [
    {
      icon: Sparkles,
      title: "Welcome, District Admin",
      description:
        "Welcome to your district administration workspace. This tour introduces the tools you use to manage district operations.",
    },

    {
      icon: LayoutDashboard,
      title: "District Dashboard",
      description:
        "Get an overview of grievance activity, assignments, incidents, and operational activity within your district.",
      target: routeTarget(
        "/admin/district"
      ),
    },

    {
      icon: UserPlus,
      title: "Unassigned Grievances",
      description:
        "Review grievances that need an officer assignment and manually assign them when required.",
      target: routeTarget(
        "/admin/district/unassigned"
      ),
    },

    {
      icon: FileText,
      title: "District Grievances",
      description:
        "Monitor grievances belonging to your district and follow their progress through the resolution lifecycle.",
      target: routeTarget(
        "/admin/grievances"
      ),
    },

    {
      icon: AlertTriangle,
      title: "District Incidents",
      description:
        "Monitor community incidents within your district and identify recurring civic problems.",
      target: routeTarget(
        "/admin/incidents"
      ),
    },

    {
      icon: Users,
      title: "District Officers",
      description:
        "Manage officers working within your district and monitor their assignments.",
      target: routeTarget(
        "/admin/officers"
      ),
    },

    {
      icon: BarChart3,
      title: "District Analytics",
      description:
        "Review district-level grievance trends, resolution performance, workloads, and other operational metrics.",
      target: routeTarget(
        "/admin/analytics"
      ),
    },

    {
      icon: Map,
      title: "District Map",
      description:
        "Visualize grievances and incidents geographically across your district.",
      target: routeTarget(
        "/admin/map"
      ),
    },

    {
      icon: Sparkles,
      title: "District AI Insights",
      description:
        "Use AI-generated insights to identify patterns and important trends within your district.",
      target: routeTarget(
        "/admin/ai-insights"
      ),
    },

    {
      icon: Bot,
      title: "AI Assistant",
      description:
        "Ask the CivicAI assistant for help with administrative information and platform workflows.",
      target: routeTarget(
        "/admin/assistant"
      ),
    },

    {
      icon: User,
      title: "Profile",
      description:
        "Manage your administrator profile and account information.",
      target: routeTarget(
        "/admin/profile"
      ),
    },

    {
      icon: Settings,
      title: "Settings",
      description:
        "Manage your account settings and restart this onboarding tour whenever you need.",
      target: routeTarget(
        "/admin/settings"
      ),
    },
  ],
};

/*
 * Your existing authentication uses:
 *
 * user.role === "admin"
 *
 * and district determines whether it is a district admin
 * or super admin.
 */

export const getTourSteps = (role, user) => {
  if (role === "admin") {
    if (user?.district) {
      return TOUR_STEPS_BY_ROLE.districtAdmin;
    }

    return TOUR_STEPS_BY_ROLE.superAdmin;
  }

  return (
    TOUR_STEPS_BY_ROLE[role] ||
    TOUR_STEPS_BY_ROLE.citizen
  );
};