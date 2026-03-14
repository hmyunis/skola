import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Calendar,
  BookOpen,
  MessageSquare,
  MoreHorizontal,
  FolderOpen,
  Swords,
  Settings,
  CalendarDays,
  GraduationCap,
  Users,
  ShieldAlert,
  Megaphone,
  BarChart3,
  ToggleLeft,
  Download,
  Shield,
  Crown,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { useAuth } from "@/stores/authStore";
import { isFeatureEnabled, useFeatureEnabled } from "@/services/features";

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Schedule", url: "/schedule", icon: Calendar, featureId: "ft-schedule" },
  { title: "Lounge", url: "/lounge", icon: MessageSquare, featureId: "ft-lounge" },
  { title: "Arena", url: "/arena", icon: Swords, featureId: "ft-arena" },
];

const moreItems = [
  { title: "Assessments", url: "/academics", icon: BookOpen, featureId: "ft-academics" },
  { title: "Resources", url: "/resources", icon: FolderOpen, featureId: "ft-resources" },
  { title: "Announcements", url: "/announcements", icon: Megaphone, featureId: "ft-announcements" },
  { title: "Members", url: "/members", icon: Users, featureId: "ft-members" },
  { title: "Appearance", url: "/settings", icon: Settings, featureId: "ft-appearance" },
];

const adminItems = [
  { title: "Users", url: "/admin/users", icon: Users },
  { title: "Moderation", url: "/admin/moderation", icon: ShieldAlert },
  { title: "Announcements", url: "/admin/announcements", icon: Megaphone },
];

const ownerItems = [
  { title: "Semesters", url: "/admin/semesters", icon: CalendarDays },
  { title: "Courses", url: "/admin/courses", icon: GraduationCap },
  { title: "Analytics", url: "/admin/analytics", icon: BarChart3 },
  { title: "Features", url: "/owner/features", icon: ToggleLeft },
  { title: "Data Export", url: "/owner/data-export", icon: Download },
];

function BottomNavLink({ item }: { item: any }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isEnabled = useFeatureEnabled(item.featureId || "none");
  if (item.featureId && !isEnabled) return null;

  const active = location.pathname === item.url;
  return (
    <button
      onClick={() => navigate(item.url)}
      className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[9px] uppercase tracking-wider font-medium transition-colors ${
        active ? "text-primary" : "text-muted-foreground"
      }`}
    >
      <item.icon className="h-4 w-4" />
      <span className="leading-none">{item.title}</span>
    </button>
  );
}

function MoreNavItem({ item, onSelect }: { item: any; onSelect: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isEnabled = useFeatureEnabled(item.featureId || "none");
  if (item.featureId && !isEnabled) return null;

  const active = location.pathname === item.url;
  return (
    <button
      onClick={() => {
        navigate(item.url);
        onSelect();
      }}
      className={`flex items-center gap-3 w-full p-3 text-xs font-bold uppercase tracking-wider transition-colors ${
        active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
      }`}
    >
      <item.icon className="h-4 w-4" />
      <span>{item.title}</span>
    </button>
  );
}

export function BottomNav() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { isAdmin, isOwner } = useAuth();

  const allMoreItems = [
    ...moreItems,
    ...(isAdmin ? adminItems : []),
    ...(isOwner ? ownerItems : []),
  ];
  const isMoreActive = allMoreItems.some((i) => location.pathname === i.url);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border md:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-12 px-1">
        {mainItems.map((item) => (
          <BottomNavLink key={item.url} item={item} />
        ))}

        {/* More button */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[9px] uppercase tracking-wider font-medium transition-colors ${
                isMoreActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="leading-none">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[70vh] p-0 border-t-2 border-primary">
            <SheetHeader className="p-4 border-b border-border">
              <SheetTitle className="text-xs font-black uppercase tracking-[0.2em] text-left">
                Navigation Menu
              </SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto pb-8">
              <div className="grid grid-cols-1 divide-y divide-border">
                {allMoreItems.map((item) => (
                  <MoreNavItem 
                    key={item.url} 
                    item={item} 
                    onSelect={() => setOpen(false)} 
                  />
                ))}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
