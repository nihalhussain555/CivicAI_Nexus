import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate,} from "react-router-dom";
import { AuthProvider, } from "./context/AuthContext";
import { ThemeProvider, } from "./context/ThemeContext";
import { ToastProvider, } from "./context/ToastContext";
import ProtectedRoute from "./routes/ProtectedRoute";
import DashboardLayout from "./layouts/DashboardLayout";
import PublicLayout from "./layouts/PublicLayout";

// Every page below is lazy-loaded so the initial bundle only ships what's
// needed for whichever page the person actually lands on — heavy
// dependencies (leaflet/react-leaflet for maps, recharts for analytics,
// react-markdown for the AI assistant) only download when their page is
// visited, instead of being bundled into every single page load.

// Public
const Landing = lazy(() => import("./pages/public/Landing"));
const About = lazy(() => import("./pages/public/About"));
const HowItWorks = lazy(() => import("./pages/public/HowItWorks"));
const NotFound = lazy(() => import("./pages/public/NotFound"));
const Forbidden = lazy(() => import("./pages/public/Forbidden"));
const PrivacyPolicy = lazy(() => import("./pages/public/PrivacyPolicy"));
const Terms = lazy(() => import("./pages/public/Terms"));
const CookiePolicy = lazy(() => import("./pages/public/CookiePolicy"));

// Auth
const Login = lazy(() => import("./pages/auth/Login"));
const Register = lazy(() => import("./pages/auth/Register"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));

// Citizen
const CitizenDashboard = lazy(() => import("./pages/citizen/Dashboard"));
const ReportIssue = lazy(() => import("./pages/citizen/ReportIssue"));
const CitizenGrievances = lazy(() => import("./pages/citizen/Grievances"));
const Rewards = lazy(() => import("./pages/citizen/Rewards"));

// Officer
const OfficerDashboard = lazy(() => import("./pages/officer/Dashboard"));
const OfficerGrievances = lazy(() => import("./pages/officer/Grievances"));
const OfficerAnalytics = lazy(() => import("./pages/officer/Analytics"));

// Admin
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminGrievances = lazy(() => import("./pages/admin/Grievances"));
const AdminDepartments = lazy(() => import("./pages/admin/Departments"));
const AdminOfficers = lazy(() => import("./pages/admin/Officers"));
const AdminOfficerDetail = lazy(() => import("./pages/admin/OfficerDetail"));
const AdminAdmins = lazy(() => import("./pages/admin/Admins"));
const AdminAnalytics = lazy(() => import("./pages/admin/Analytics"));
const AdminMap = lazy(() => import("./pages/admin/Map"));
const AdminAIInsights = lazy(() => import("./pages/admin/AIInsights"));
const DistrictAdmin = lazy(() => import("./pages/admin/DistrictAdmin"));
const UnassignedGrievances = lazy(() => import("./pages/admin/UnassignedGrievances"));

// Shared
const GrievanceDetail = lazy(() => import("./pages/shared/GrievanceDetail"));
const Incidents = lazy(() => import("./pages/shared/Incidents"));
const IncidentDetail = lazy(() => import("./pages/shared/IncidentDetail"));
const Notifications = lazy(() => import("./pages/shared/Notifications"));
const Profile = lazy(() => import("./pages/shared/Profile"));
const Settings = lazy(() => import("./pages/shared/Settings"));
const AIAssistant = lazy(() => import("./pages/shared/AIAssistant"));

const RouteLoader = () => (
  <div className="route-loader">
    <div className="route-loader-spinner" />
  </div>
);

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<RouteLoader />}>
            <Routes>

              {/* ========================= */}
              {/* PUBLIC */}
              {/* ========================= */}

              <Route element={ <PublicLayout />  } >
                <Route path="/" element={ <Landing /> } />
                <Route path="/about" element={ <About /> } />
                <Route  path="/how-it-works" element={  <HowItWorks /> } />
                <Route path="/privacy-policy" element={ <PrivacyPolicy /> }  />
                <Route path="/terms" element={ <Terms /> } />
                <Route path="/cookie-policy" element={ <CookiePolicy /> } />
              </Route>

              {/* ========================= */}
              {/* AUTH */}
              {/* ========================= */}

              <Route path="/login" element={ <Login /> } /> 
              <Route path="/register" element={ <Register /> } /> 
              <Route path="/forgot-password" element={ <ForgotPassword /> } />
              <Route path="/reset-password" element={ <ResetPassword /> } />
              <Route path="/403" element={ <Forbidden /> } />

              {/* ========================= */}
              {/* CITIZEN */}
              {/* ========================= */}

              <Route path="/citizen" element={
                  <ProtectedRoute allowedRoles={[ "citizen", ]} >
                    <DashboardLayout />
                  </ProtectedRoute> }>
                <Route index element={ <Navigate to="dashboard" replace /> } />
                <Route path="dashboard" element={ <CitizenDashboard /> } />
                <Route path="report" element={ <ReportIssue /> } />
                <Route  path="grievances" element={ <CitizenGrievances /> } />
                <Route path="rewards" element={ <Rewards /> } />
                <Route path="grievances/:grievanceId" element={  <GrievanceDetail /> }/>
                <Route path="incidents" element={ <Incidents /> }/>
                <Route path="incidents/:incidentId" element={ <IncidentDetail />  } />
                <Route path="assistant" element={  <AIAssistant /> } />
                <Route path="notifications" element={ <Notifications /> }/>
                <Route path="profile" element={ <Profile /> } />
                <Route path="settings" element={ <Settings /> } />
              </Route>

              {/* ========================= */}
              {/* OFFICER */}
              {/* ========================= */}

              <Route path="/officer" element={ 
                 <ProtectedRoute allowedRoles={[ "officer" ]} >
                    <DashboardLayout />
                  </ProtectedRoute> }>
                <Route index element={ <Navigate to="dashboard" replace /> } />
                <Route path="dashboard" element={  <OfficerDashboard />  } />
                <Route path="grievances" element={<OfficerGrievances /> } />
                <Route path="grievances/:grievanceId" element={ <GrievanceDetail /> }/>
                <Route path="incidents" element={ <Incidents /> } />
                <Route path="incidents/:incidentId" element={ <IncidentDetail />  } />
                <Route path="copilot" element={ <AIAssistant /> } />
                <Route path="assistant" element={ <AIAssistant />  } />
                <Route path="analytics" element={ <OfficerAnalytics /> } />
                <Route path="notifications" element={ <Notifications /> } />
                <Route path="profile" element={ <Profile /> } />
                <Route path="settings" element={ <Settings /> } />
              </Route>

              {/* ========================= */}
              {/* ADMIN */}
              {/* ========================= */}

              <Route path="/admin" element={
                  <ProtectedRoute allowedRoles={[ "admin", ]} >
                    <DashboardLayout />
                  </ProtectedRoute> } >
                <Route index element={  <Navigate to="dashboard" replace /> } />
                {/* SUPER ADMIN DASHBOARD */}

                <Route path="dashboard" element={
                    <ProtectedRoute allowedRoles={[ "admin", ]} dminScope="super">
                      <AdminDashboard />
                    </ProtectedRoute> } />
                {/* DISTRICT ADMIN */}
                <Route path="district" element={
                    <ProtectedRoute allowedRoles={[ "admin", ]} adminScope="district"> 
                      <DistrictAdmin />
                    </ProtectedRoute> } />
                <Route path="district/unassigned" element={
                    <ProtectedRoute allowedRoles={[  "admin", ]}  adminScope="district">
                      <UnassignedGrievances />
                    </ProtectedRoute>  } />
                {/* SHARED ADMIN */}

                <Route
                  path="grievances"
                  element={
                    <AdminGrievances />
                  }
                />

                <Route
                  path="grievances/:grievanceId"
                  element={
                    <GrievanceDetail />
                  }
                />

                <Route
                  path="incidents"
                  element={
                    <Incidents />
                  }
                />

                <Route
                  path="incidents/:incidentId"
                  element={
                    <IncidentDetail />
                  }
                />

                <Route
                  path="departments"
                  element={
                    <ProtectedRoute
                      allowedRoles={[
                        "admin",
                      ]}
                      adminScope="super"
                    >
                      <AdminDepartments />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="officers"
                  element={
                    <AdminOfficers />
                  }
                />

                <Route
                  path="officers/:officerId"
                  element={
                    <AdminOfficerDetail />
                  }
                />

                {/* Super Admin only */}
                <Route
                  path="admins"
                  element={
                    <ProtectedRoute
                      allowedRoles={[
                        "admin",
                      ]}
                      adminScope="super"
                    >
                      <AdminAdmins />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="analytics"
                  element={
                    <AdminAnalytics />
                  }
                />

                <Route
                  path="map"
                  element={
                    <AdminMap />
                  }
                />

                <Route
                  path="ai-insights"
                  element={
                    <AdminAIInsights />
                  }
                />

                <Route
                  path="assistant"
                  element={
                    <AIAssistant />
                  }
                />

                <Route
                  path="notifications"
                  element={
                    <Notifications />
                  }
                />

                <Route
                  path="profile"
                  element={
                    <Profile />
                  }
                />

                <Route
                  path="settings"
                  element={
                    <Settings />
                  }
                />

              </Route>

              {/* ========================= */}
              {/* 404 */}
              {/* ========================= */}

              <Route
                path="*"
                element={
                  <NotFound />
                }
              />

            </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;