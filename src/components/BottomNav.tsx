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

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Schedule", url: "/schedule", icon: Calendar },
  { title: "Assessments", url: "/academics", icon: BookOpen },
  { title: "Lounge", url: "/lounge", icon: MessageSquare },
];

const moreItems = [
  { title: "Resources", url: "/resources", icon: FolderOpen },
  { title: "Arena", url: "/arena", icon: Swords },
  { title: "Members", url: "/members", icon: Users },
  { title: "Appearance", url: "/settings", icon: Settings },
];

const adminItems = [
  { title: "Semesters", url: "/admin/semesters", icon: CalendarDays },
  { title: "Courses", url: "/admin/courses", icon: GraduationCap },
  { title: "Users", url: "/admin/users", icon: Users },
  { title: "Moderation", url: "/admin/moderation", icon: ShieldAlert },
  { title: "Announcements", url: "/admin/announcements", icon: Megaphone },
  { title: "Analytics", url: "/admin/analytics", icon: BarChart3 },
];

const ownerItems = [
  { title: "Features", url: "/owner/features", icon: ToggleLeft },
  { title: "Data Export", url: "/owner/data-export", icon: Download },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
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
        {mainItems.map((item) => {
          const active = location.pathname === item.url;
          return (
            <button
              key={item.url}
              onClick={() => navigate(item.url)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[9px] uppercase tracking-wider font-medium transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              <span className="leading-none">{item.title}</span>
            </button>
          );
        })}

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
          <SheetContent side="bottom" className="border-t border-border max-h-[70vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="uppercase tracking-widest text-sm">More</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-1 mt-4">
              {moreItems.map((item) => {
                const active = location.pathname === item.url;
                return (
                  <button
                    key={item.url}
                    onClick={() => {
                      navigate(item.url);
                      setOpen(false);
                    }}
                    className={`flex items-center gap-3 px-4 py-3 text-sm font-medium uppercase tracking-wide transition-colors border border-border ${
                      active
                        ? "bg-primary/10 text-primary border-primary/30"
                        : "text-foreground hover:bg-accent"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </button>
                );
              })}

              {isAdmin && (
                <>
                  <div className="flex items-center gap-2 pt-3 pb-1 px-1">
                    <Shield className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Admin</span>
                    <Separator className="flex-1" />
                  </div>
                  {adminItems.map((item) => {
                    const active = location.pathname === item.url;
                    return (
                      <button
                        key={item.url}
                        onClick={() => {
                          navigate(item.url);
                          setOpen(false);
                        }}
                        className={`flex items-center gap-3 px-4 py-3 text-sm font-medium uppercase tracking-wide transition-colors border border-border ${
                          active
                            ? "bg-primary/10 text-primary border-primary/30"
                            : "text-foreground hover:bg-accent"
                        }`}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </button>
                    );
                  })}
                </>
              )}

              {isOwner && (
                <>
                  <div className="flex items-center gap-2 pt-3 pb-1 px-1">
                    <Crown className="h-3 w-3 text-amber-500" />
                    <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Owner</span>
                    <Separator className="flex-1" />
                  </div>
                  {ownerItems.map((item) => {
                    const active = location.pathname === item.url;
                    return (
                      <button
                        key={item.url}
                        onClick={() => {
                          navigate(item.url);
                          setOpen(false);
                        }}
                        className={`flex items-center gap-3 px-4 py-3 text-sm font-medium uppercase tracking-wide transition-colors border border-border ${
                          active
                            ? "bg-primary/10 text-primary border-primary/30"
                            : "text-foreground hover:bg-accent"
                        }`}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
