import {
  LayoutDashboard,
  Calendar,
  BookOpen,
  FolderOpen,
  MessageSquare,
  Swords,
  Settings,
  CalendarDays,
  GraduationCap,
  Users,
  ShieldAlert,
  Megaphone,
  BarChart3,
  ToggleLeft,
  
  Crown,
  Shield,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useTheme } from "@/stores/themeStore";
import { useAuth } from "@/stores/authStore";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Schedule", url: "/schedule", icon: Calendar },
  { title: "Assessments", url: "/academics", icon: BookOpen },
  { title: "Resources", url: "/resources", icon: FolderOpen },
  { title: "Lounge", url: "/lounge", icon: MessageSquare },
  { title: "Arena", url: "/arena", icon: Swords },
  { title: "Members", url: "/members", icon: Users },
  { title: "Appearance", url: "/settings", icon: Settings },
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
  { title: "General", url: "/owner/general", icon: Settings },
];

function NavSection({
  items,
  label,
  icon: LabelIcon,
  collapsed,
  currentPath,
}: {
  items: typeof navItems;
  label: string;
  icon?: typeof Shield;
  collapsed: boolean;
  currentPath: string;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="uppercase tracking-widest text-[10px] text-sidebar-foreground/50 flex items-center gap-1.5">
        {LabelIcon && <LabelIcon className="h-3 w-3" />}
        {!collapsed && label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isActive = currentPath === item.url;
            const link = (
              <NavLink
                to={item.url}
                end
                className={`flex items-center gap-3 px-3 py-2 text-sm font-medium uppercase tracking-wide transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary-foreground border-l-2 border-sidebar-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                }`}
                activeClassName=""
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.title}</span>}
              </NavLink>
            );
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild>
                  {collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right"><span>{item.title}</span></TooltipContent>
                    </Tooltip>
                  ) : (
                    link
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { batchTheme } = useTheme();
  const { isAdmin, isOwner } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Brand */}
        <div className="p-4 border-b border-sidebar-border">
          {!collapsed ? (
            <div>
              <h1 className="text-xl font-black uppercase tracking-[0.3em] text-sidebar-primary-foreground">
                SKOLA
              </h1>
              <p className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60 mt-0.5">
                {batchTheme.name} Division
              </p>
            </div>
          ) : (
            <span className="text-lg font-black text-sidebar-primary-foreground">SK</span>
          )}
        </div>

        <NavSection
          items={navItems}
          label="Navigation"
          collapsed={collapsed}
          currentPath={location.pathname}
        />

        {isAdmin && (
          <>
            <div className="px-4">
              <Separator className="bg-sidebar-border" />
            </div>
            <NavSection
              items={adminItems}
              label="Admin"
              icon={Shield}
              collapsed={collapsed}
              currentPath={location.pathname}
            />
          </>
        )}

        {isOwner && (
          <>
            <div className="px-4">
              <Separator className="bg-sidebar-border" />
            </div>
            <NavSection
              items={ownerItems}
              label="Owner"
              icon={Crown}
              collapsed={collapsed}
              currentPath={location.pathname}
            />
          </>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
