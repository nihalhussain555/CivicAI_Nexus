import {
  Sparkles,
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
} from "lucide-react";

export const TOUR_STEPS_BY_ROLE = {
  /* =====================================================
     CITIZEN
     ===================================================== */

  citizen: [
    {
      icon: Sparkles,
      title: "Welcome to CivicAI Nexus",
      description:
        "This is a quick tour of what you can do here — it only takes a minute. You can restart it anytime from Settings.",
    },

    {
      icon: FilePlus2,
      title: "Report an issue",
      description:
        "Describe a civic problem such as a pothole, broken streetlight, garbage pileup, or water issue. Add a photo or use your camera. CivicAI analyzes and routes the report to the appropriate department.",
      target: '[data-tour="report-issue"]',
    },

    {
      icon: FileText,
      title: "Track every report",
      description:
        "My Grievances shows the live status of everything you've reported — submitted, assigned, in progress, or resolved — together with the history of what happened.",
      target: '[data-tour="my-grievances"]',
    },

    {
      icon: Trophy,
      title: "Earn Civic Points",
      description:
        "Earn Civic Points through meaningful participation and verified outcomes. Reach milestones to unlock badges, certificates, and rewards.",
      target: '[data-tour="civic-rewards"]',
    },

    {
      icon: AlertTriangle,
      title: "Community Incidents",
      description:
        "When several people report the same problem nearby, CivicAI can group those reports into a community incident so you can see the bigger picture.",
      target: '[data-tour="community-incidents"]',
    },

    {
      icon: Bot,
      title: "Ask CivicAI",
      description:
        "Need help understanding a report, tracking a grievance, or using the platform? Ask CivicAI directly from the sidebar.",
      target: '[data-tour="ask-civicai"]',
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
        "A quick tour of your workspace — it only takes a minute. You can restart it anytime from Settings.",
    },

    {
      icon: ListChecks,
      title: "Your queue",
      description:
        "View grievances assigned to your department and district, prioritize active cases, and accept cases that require your action.",
      target: '[data-tour="officer-queue"]',
    },

    {
      icon: FileText,
      title: "Resolve with evidence",
      description:
        "When an issue is resolved, add a clear resolution note and supporting evidence so the citizen can follow what happened.",
      target: '[data-tour="officer-grievances"]',
    },

    {
      icon: AlertTriangle,
      title: "Community Incidents",
      description:
        "Multiple reports describing the same real-world problem can be grouped together, helping you identify recurring issues and hotspots.",
      target: '[data-tour="officer-incidents"]',
    },

    {
      icon: BarChart3,
      title: "Your analytics",
      description:
        "Monitor case volume, resolution progress, response times, and other performance indicators from the analytics area.",
      target: '[data-tour="officer-analytics"]',
    },

    {
      icon: Bot,
      title: "AI Copilot",
      description:
        "Use AI assistance inside supported cases to quickly understand the complaint, summarize the history, and identify useful next actions.",
      target: '[data-tour="officer-ai"]',
    },
  ],

  /* =====================================================
     ADMIN
     ===================================================== */

  admin: [
    {
      icon: Sparkles,
      title: "Welcome, Admin",
      description:
        "A quick tour of the CivicAI administration workspace — it only takes a minute. You can restart it anytime from Settings.",
    },

    {
      icon: Building2,
      title: "Departments & routing",
      description:
        "Manage departments and configure how grievances are categorized and routed through the CivicAI workflow.",
      target: '[data-tour="admin-departments"]',
    },

    {
      icon: Users,
      title: "Officers",
      description:
        "Create and manage officers, departments, districts, assignments, and operational access.",
      target: '[data-tour="admin-officers"]',
    },

    {
      icon: Map,
      title: "Live map & incidents",
      description:
        "Monitor grievances and community incidents geographically to identify clusters and areas requiring attention.",
      target: '[data-tour="admin-map"]',
    },

    {
      icon: BarChart3,
      title: "Analytics & AI Insights",
      description:
        "Review city-wide trends, grievance volumes, resolution times, department activity, and AI-generated insights.",
      target: '[data-tour="admin-analytics"]',
    },

    {
      icon: ShieldCheck,
      title: "Oversight",
      description:
        "Review flagged cases, disputed grievances, reopen requests, and other administrative actions that require oversight.",
      target: '[data-tour="admin-oversight"]',
    },
  ],
};

export const getTourSteps = (role) => {
  return (
    TOUR_STEPS_BY_ROLE[role] ||
    TOUR_STEPS_BY_ROLE.citizen
  );
};