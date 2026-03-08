import {
  LayoutDashboard,
  Calendar,
  BookOpen,
  FolderOpen,
  MessageSquare,
  Swords,
  Settings,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useTheme } from "@/contexts/ThemeContext";
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
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Schedule", url: "/schedule", icon: Calendar },
  { title: "Academics", url: "/academics", icon: BookOpen },
  { title: "Resources", url: "/resources", icon: FolderOpen },
  { title: "Lounge", url: "/lounge", icon: MessageSquare },
  { title: "Arena", url: "/arena", icon: Swords },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { batchTheme } = useTheme();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Brand */}
        <div className="p-4 border-b border-sidebar-border">
          {!collapsed ? (
            <div>
              <h1 className="text-xl font-black uppercase tracking-[0.3em] text-sidebar-primary-foreground">
                SCOLA
              </h1>
              <p className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60 mt-0.5">
                {batchTheme.name} Division
              </p>
            </div>
          ) : (
            <span className="text-lg font-black text-sidebar-primary-foreground">S</span>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="uppercase tracking-widest text-[10px] text-sidebar-foreground/50">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
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
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
