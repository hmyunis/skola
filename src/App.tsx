import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AppLayout } from "@/components/AppLayout";
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
import AdminSemesters from "./pages/admin/AdminSemesters";
import AdminCourses from "./pages/admin/AdminCourses";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminModeration from "./pages/admin/AdminModeration";
import AdminAnnouncements from "./pages/admin/AdminAnnouncements";
import AdminAnalytics from "./pages/admin/AdminAnalytics";

// Owner pages
import OwnerFeatures from "./pages/owner/OwnerFeatures";
import OwnerDataExport from "./pages/owner/OwnerDataExport";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Index />} />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/academics" element={<Academics />} />
              <Route path="/resources" element={<Resources />} />
              <Route path="/lounge" element={<Lounge />} />
              <Route path="/arena" element={<Arena />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/members" element={<Members />} />
              <Route path="/announcements" element={<Announcements />} />

              {/* Admin routes */}
              <Route path="/admin/semesters" element={<AdminSemesters />} />
              <Route path="/admin/courses" element={<AdminCourses />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/moderation" element={<AdminModeration />} />
              <Route path="/admin/announcements" element={<AdminAnnouncements />} />
              <Route path="/admin/analytics" element={<AdminAnalytics />} />

              {/* Owner routes */}
              <Route path="/owner/features" element={<OwnerFeatures />} />
              <Route path="/owner/data-export" element={<OwnerDataExport />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
