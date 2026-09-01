import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import ProtectedRoute from "./routes/ProtectedRoute";
import DashboardLayout from "./layouts/DashboardLayout";
import PublicLayout from "./layouts/PublicLayout";

// Public
import Landing from "./pages/public/Landing";
import About from "./pages/public/About";
import HowItWorks from "./pages/public/HowItWorks";
import NotFound from "./pages/public/NotFound";
import Forbidden from "./pages/public/Forbidden";

// Auth
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";

// Citizen
import CitizenDashboard from "./pages/citizen/Dashboard";
import ReportIssue from "./pages/citizen/ReportIssue";
import CitizenGrievances from "./pages/citizen/Grievances";

// Officer
import OfficerDashboard from "./pages/officer/Dashboard";
import OfficerGrievances from "./pages/officer/Grievances";
import OfficerAnalytics from "./pages/officer/Analytics";

// Admin
import AdminDashboard from "./pages/admin/Dashboard";
import AdminGrievances from "./pages/admin/Grievances";
import AdminDepartments from "./pages/admin/Departments";
import AdminOfficers from "./pages/admin/Officers";
import AdminOfficerDetail from "./pages/admin/OfficerDetail";
import AdminAnalytics from "./pages/admin/Analytics";
import AdminMap from "./pages/admin/Map";
import AdminAIInsights from "./pages/admin/AIInsights";

// Shared (reused across roles)
import GrievanceDetail from "./pages/shared/GrievanceDetail";
import Incidents from "./pages/shared/Incidents";
import IncidentDetail from "./pages/shared/IncidentDetail";
import Notifications from "./pages/shared/Notifications";
import Profile from "./pages/shared/Profile";
import Settings from "./pages/shared/Settings";
import AIAssistant from "./pages/shared/AIAssistant";

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public */}
              <Route element={<PublicLayout />}>
                <Route path="/" element={<Landing />} />
                <Route path="/about" element={<About />} />
                <Route path="/how-it-works" element={<HowItWorks />} />
              </Route>

              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/403" element={<Forbidden />} />

              {/* Citizen */}
              <Route
                path="/citizen"
                element={
                  <ProtectedRoute allowedRoles={["citizen"]}>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<CitizenDashboard />} />
                <Route path="report" element={<ReportIssue />} />
                <Route path="grievances" element={<CitizenGrievances />} />
                <Route path="grievances/:grievanceId" element={<GrievanceDetail />} />
                <Route path="incidents" element={<Incidents />} />
                <Route path="incidents/:incidentId" element={<IncidentDetail />} />
                <Route path="assistant" element={<AIAssistant />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="profile" element={<Profile />} />
                <Route path="settings" element={<Settings />} />
              </Route>

              {/* Officer */}
              <Route
                path="/officer"
                element={
                  <ProtectedRoute allowedRoles={["officer", "admin"]}>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<OfficerDashboard />} />
                <Route path="grievances" element={<OfficerGrievances />} />
                <Route path="grievances/:grievanceId" element={<GrievanceDetail />} />
                <Route path="incidents" element={<Incidents />} />
                <Route path="incidents/:incidentId" element={<IncidentDetail />} />
                <Route path="copilot" element={<AIAssistant />} />
                <Route path="assistant" element={<AIAssistant />} />
                <Route path="analytics" element={<OfficerAnalytics />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="profile" element={<Profile />} />
                <Route path="settings" element={<Settings />} />
              </Route>

              {/* Admin */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="grievances" element={<AdminGrievances />} />
                <Route path="grievances/:grievanceId" element={<GrievanceDetail />} />
                <Route path="incidents" element={<Incidents />} />
                <Route path="incidents/:incidentId" element={<IncidentDetail />} />
                <Route path="departments" element={<AdminDepartments />} />
                <Route path="officers" element={<AdminOfficers />} />
                <Route path="officers/:officerId" element={<AdminOfficerDetail />} />
                <Route path="analytics" element={<AdminAnalytics />} />
                <Route path="map" element={<AdminMap />} />
                <Route path="ai-insights" element={<AdminAIInsights />} />
                <Route path="assistant" element={<AIAssistant />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="profile" element={<Profile />} />
                <Route path="settings" element={<Settings />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;