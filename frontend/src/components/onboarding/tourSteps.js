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

// One short walkthrough per role, shown once on first login (see
// OnboardingTour.jsx + DashboardLayout.jsx). Keep each step to a single,
// concrete idea — this is a "here's what you can do" tour, not documentation.

export const TOUR_STEPS_BY_ROLE = {
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
        "Describe a civic problem — a pothole, broken streetlight, garbage pileup — and add a photo by uploading one or taking it right from your camera. Our AI classifies and routes it to the right department automatically.",
    },
    {
      icon: FileText,
      title: "Track every report",
      description:
        "\"My Grievances\" shows the live status of everything you've reported — submitted, assigned, in progress, or resolved — with the full history of what happened.",
    },
    {
      icon: Trophy,
      title: "Earn Civic Points",
      description:
        "Points are earned for real outcomes — a verified, resolved report — not just for submitting a lot of them. Reach milestones to unlock certificates, badges, and rewards.",
    },
    {
      icon: AlertTriangle,
      title: "Community Incidents",
      description:
        "If several people report the same problem nearby, we group it into a community incident — so you can see if others are dealing with the same issue.",
    },
    {
      icon: Bot,
      title: "Ask CivicAI",
      description:
        "Have a question about reporting, tracking, or how the platform works? Ask the assistant any time from the sidebar.",
    },
  ],

  officer: [
    {
      icon: Sparkles,
      title: "Welcome, Officer",
      description:
        "A quick tour of your workspace — it only takes a minute. Restart it any time from Settings.",
    },
    {
      icon: ListChecks,
      title: "Your queue",
      description:
        "See every grievance assigned to your department, sorted by priority. Accept a case to start working it, or escalate it if it needs another department's attention.",
    },
    {
      icon: FileText,
      title: "Resolve with evidence",
      description:
        "When you fix an issue, submit a resolution note and evidence — the citizen is notified and asked to confirm before the case closes.",
    },
    {
      icon: AlertTriangle,
      title: "Community Incidents",
      description:
        "Multiple reports of the same real-world problem are grouped automatically, so you can spot patterns instead of handling duplicates one by one.",
    },
    {
      icon: BarChart3,
      title: "Your analytics",
      description:
        "Track your resolution times and case load over time from the Analytics page.",
    },
    {
      icon: Bot,
      title: "AI Copilot",
      description:
        "Open any case and check the AI-generated brief for a fast summary of what's happened and what to do next.",
    },
  ],

  admin: [
    {
      icon: Sparkles,
      title: "Welcome, Admin",
      description:
        "A quick tour of the admin tools — it only takes a minute. Restart it any time from Settings.",
    },
    {
      icon: Building2,
      title: "Departments & routing",
      description:
        "Manage which departments exist and how grievances get routed to them based on category.",
    },
    {
      icon: Users,
      title: "Officers",
      description:
        "Add officers, assign them to departments and districts, and keep an eye on their case load and performance.",
    },
    {
      icon: Map,
      title: "Live map & incidents",
      description:
        "See every open grievance and community incident plotted geographically, so you can spot hotspots at a glance.",
    },
    {
      icon: BarChart3,
      title: "Analytics & AI Insights",
      description:
        "City-wide trends, resolution times, and AI-surfaced patterns across every department and district.",
    },
    {
      icon: ShieldCheck,
      title: "Oversight",
      description:
        "Review flagged or disputed grievances, approve reopen requests, and keep the whole system accountable.",
    },
  ],
};

export const getTourSteps = (role) => TOUR_STEPS_BY_ROLE[role] || TOUR_STEPS_BY_ROLE.citizen;