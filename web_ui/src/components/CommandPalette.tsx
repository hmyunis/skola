import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Calendar,
  BookOpen,
  FolderOpen,
  MessageSquare,
  Swords,
  Settings,
  Users,
  Megaphone,
  ShieldAlert,
  CalendarDays,
  GraduationCap,
  BarChart3,
  ToggleLeft,
  Search,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { COURSES } from "@/services/api";
import { isFeatureEnabled, useFeatureEnabled } from "@/services/features";
import { useClassroomStore } from "@/stores/classroomStore";

const pages = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, group: "pages" },
  { title: "Schedule", url: "/schedule", icon: Calendar, group: "pages", featureId: "ft-schedule" },
  { title: "Assessments", url: "/academics", icon: BookOpen, group: "pages", featureId: "ft-academics" },
  { title: "Resources", url: "/resources", icon: FolderOpen, group: "pages", featureId: "ft-resources" },
  { title: "Lounge", url: "/lounge", icon: MessageSquare, group: "pages", featureId: "ft-lounge" },
  { title: "Arena", url: "/arena", icon: Swords, group: "pages", featureId: "ft-arena" },
  { title: "Members", url: "/members", icon: Users, group: "pages" },
  { title: "Appearance", url: "/settings", icon: Settings, group: "pages" },
  { title: "Announcements", url: "/announcements", icon: Megaphone, group: "pages" },
];

const adminPages = [
  { title: "Admin: Users", url: "/admin/users", icon: Users, group: "admin" },
  { title: "Admin: Moderation", url: "/admin/moderation", icon: ShieldAlert, group: "admin" },
  { title: "Admin: Announcements", url: "/admin/announcements", icon: Megaphone, group: "admin" },
];

const ownerPages = [
  { title: "Owner: Semesters", url: "/admin/semesters", icon: CalendarDays, group: "owner" },
  { title: "Owner: Courses", url: "/admin/courses", icon: GraduationCap, group: "owner" },
  { title: "Owner: Analytics", url: "/admin/analytics", icon: BarChart3, group: "owner" },
  { title: "Owner: Features", url: "/owner/features", icon: ToggleLeft, group: "owner" },
  { title: "Owner: General", url: "/owner/general", icon: Settings, group: "owner" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { isAdmin, isOwner } = useAuthStore();
  const activeClassroom = useClassroomStore((s) => s.activeClassroom);
  const features = activeClassroom?.featureToggles || [];

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const allPages = useMemo(() => {
    let result = pages.filter((p: any) => {
      if (!p.featureId) return true;
      const f = (features as any[]).find(f => f.id === p.featureId);
      return f ? f.enabled : true; // Default to enabled if feature not found
    });
    if (isAdmin) result = [...result, ...adminPages];
    if (isOwner) result = [...result, ...ownerPages];
    return result;
  }, [isAdmin, isOwner, features]);

  const handleSelect = (url: string) => {
    setOpen(false);
    navigate(url);
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground bg-background/50 border border-border hover:border-muted-foreground/50 transition-colors"
      >
        <Search className="h-3 w-3" />
        <span>Search…</span>
        <kbd className="pointer-events-none ml-2 inline-flex h-5 items-center gap-0.5 border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search pages, courses, members…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading="Pages">
            {allPages.map((page) => (
              <CommandItem
                key={page.url}
                value={page.title}
                onSelect={() => handleSelect(page.url)}
                className="gap-2"
              >
                <page.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{page.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Courses">
            {COURSES.map((course) => (
              <CommandItem
                key={course.code}
                value={`${course.code} ${course.name}`}
                onSelect={() => handleSelect("/academics")}
                className="gap-2"
              >
                <GraduationCap className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{course.code}</span>
                <span className="text-muted-foreground text-xs">— {course.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
