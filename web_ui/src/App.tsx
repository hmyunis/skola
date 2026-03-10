import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeBackground } from "@/components/ThemeBackground";
import { AppLayout } from "@/components/AppLayout";
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

// Admin pages
import AdminCourses from "./pages/admin/AdminCourses";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminModeration from "./pages/admin/AdminModeration";
import AdminAnnouncements from "./pages/admin/AdminAnnouncements";
import AdminAnalytics from "./pages/admin/AdminAnalytics";

// Owner pages
import OwnerFeatures from "./pages/owner/OwnerFeatures";
import OwnerGeneral from "./pages/owner/OwnerGeneral";
import JoinPage from "./pages/Join";
import { RoleGuard } from "@/components/RoleGuard";

import { useEffect } from "react";
import { useThemeStore } from "@/stores/themeStore";

const queryClient = new QueryClient();

const App = () => {
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
            {/* Public routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/get-started" element={<Onboarding />} />
            <Route path="/login" element={<Login />} />
            <Route path="/join/:code" element={<JoinPage />} />

            {/* Authenticated app routes */}
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Index />} />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/academics" element={<Academics />} />
              <Route path="/resources" element={<Resources />} />
              <Route path="/lounge" element={<Lounge />} />
              <Route path="/arena" element={<Arena />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/members" element={<Members />} />
              <Route path="/announcements" element={<Announcements />} />

              {/* Admin/Moderator routes */}
              <Route element={<RoleGuard allowedRoles={["owner", "admin"]} />}>
                <Route path="/admin/courses" element={<AdminCourses />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/moderation" element={<AdminModeration />} />
                <Route path="/admin/announcements" element={<AdminAnnouncements />} />
                <Route path="/admin/analytics" element={<AdminAnalytics />} />
              </Route>

              {/* Owner-only routes */}
              <Route element={<RoleGuard allowedRoles={["owner"]} />}>
                <Route path="/owner/features" element={<OwnerFeatures />} />
                <Route path="/owner/general" element={<OwnerGeneral />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
