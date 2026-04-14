import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeBackground } from "@/components/ThemeBackground";
import { AppLayout } from "@/components/AppLayout";
import { queryClient } from "@/lib/queryClient";
import Landing from "./pages/Landing";
import Onboarding from "./pages/Onboarding";
import Index from "./pages/Index";
import Schedule from "./pages/Schedule";
import Academics from "./pages/Academics";
import Resources from "./pages/Resources";
import Lounge from "./pages/Lounge";
import Arena from "./pages/Arena";
import SettingsPage from "./pages/Settings";
import Login from "./pages/Login";
import Members from "./pages/Members";
import Announcements from "./pages/Announcements";
import NotFound from "./pages/NotFound";
import MaintenancePage from "./pages/Maintenance";

// Admin pages
import AdminCourses from "./pages/admin/AdminCourses";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminModeration from "./pages/admin/AdminModeration";
import AdminAnnouncements from "./pages/admin/AdminAnnouncements";

// Owner pages
import OwnerFeatures from "./pages/owner/OwnerFeatures";
import OwnerGeneral from "./pages/owner/OwnerGeneral";
import OwnerAnalytics from "./pages/owner/OwnerAnalytics";
import JoinPage from "./pages/Join";
import { RoleGuard } from "@/components/RoleGuard";
import { FeatureGuard } from "@/components/FeatureGuard";

import { useEffect } from "react";
import { useThemeStore } from "@/stores/themeStore";
import { useAuthStore } from "@/stores/authStore";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";

function LaunchRedirect() {
  const { user, accessToken } = useAuthStore();
  const isAuthenticated = Boolean(user && accessToken);
  return <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />;
}

function isMaintenanceModeEnabled() {
  const raw = String(import.meta.env.VITE_MAINTENANCE_MODE || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

const App = () => {
  const maintenanceMode = isMaintenanceModeEnabled();

  useEffect(() => {
    useThemeStore.getState().syncThemeWithStores();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <ThemeBackground />
        <BrowserRouter>
          <Routes>
            {maintenanceMode ? (
              <Route path="*" element={<MaintenancePage />} />
            ) : (
              <>
                {/* Public routes */}
                <Route path="/" element={<Landing />} />
                <Route path="/launch" element={<LaunchRedirect />} />
                <Route path="/get-started" element={<Onboarding />} />
                <Route path="/login" element={<Login />} />
                <Route path="/join/:code" element={<JoinPage />} />

                {/* Authenticated app routes */}
                <Route element={<AppLayout />}>
                  <Route path="/dashboard" element={<Index />} />
                  
                  <Route element={<FeatureGuard featureId="ft-schedule" />}>
                    <Route path="/schedule" element={<Schedule />} />
                  </Route>
                  
                  <Route element={<FeatureGuard featureId="ft-academics" />}>
                    <Route path="/academics" element={<Academics />} />
                  </Route>
                  
                  <Route element={<FeatureGuard featureId="ft-resources" />}>
                    <Route path="/resources" element={<Resources />} />
                  </Route>
                  
                  <Route element={<FeatureGuard featureId="ft-lounge" />}>
                    <Route path="/lounge" element={<Lounge />} />
                  </Route>
                  
                  <Route element={<FeatureGuard featureId="ft-arena" />}>
                    <Route path="/arena" element={<Arena />} />
                  </Route>
                  
                  <Route element={<FeatureGuard featureId="ft-appearance" />}>
                    <Route path="/settings" element={<SettingsPage />} />
                  </Route>
                  
                  <Route element={<FeatureGuard featureId="ft-members" />}>
                    <Route path="/members" element={<Members />} />
                  </Route>
                  
                  <Route element={<FeatureGuard featureId="ft-announcements" />}>
                    <Route path="/announcements" element={<Announcements />} />
                  </Route>

                  {/* Admin/Moderator routes */}
                  <Route element={<RoleGuard allowedRoles={["owner", "admin"]} />}>
                    <Route path="/admin/courses" element={<AdminCourses />} />
                    <Route path="/admin/users" element={<AdminUsers />} />
                    <Route path="/admin/moderation" element={<AdminModeration />} />
                    <Route path="/admin/announcements" element={<AdminAnnouncements />} />
                  </Route>

                  {/* Owner-only routes */}
                  <Route element={<RoleGuard allowedRoles={["owner"]} />}>
                    <Route path="/owner/analytics" element={<OwnerAnalytics />} />
                    <Route path="/owner/features" element={<OwnerFeatures />} />
                    <Route path="/owner/general" element={<OwnerGeneral />} />
                    <Route path="/owner/data-export" element={<Navigate to="/owner/general?tab=export" replace />} />
                    {/* Backward-compatible route */}
                    <Route path="/admin/analytics" element={<OwnerAnalytics />} />
                  </Route>
                </Route>
                <Route path="*" element={<NotFound />} />
              </>
            )}
          </Routes>
          {!maintenanceMode && <PWAInstallPrompt />}
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
