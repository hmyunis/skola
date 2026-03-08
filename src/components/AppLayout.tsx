import { useState, useRef, useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { BottomNav } from "@/components/BottomNav";
import { useTheme } from "@/stores/themeStore";
import { useAuth } from "@/stores/authStore";
import { useSemesterStore } from "@/stores/semesterStore";
import { Sun, Moon, LogOut, Mail, GraduationCap, Shield, Crown, User, CalendarDays } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const roleLabels = { owner: "Owner", admin: "Admin", student: "Student" };
const roleIcons = { owner: Crown, admin: Shield, student: User };

function UserMenu() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const RoleIcon = roleIcons[user?.role || "student"];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setOpen((p) => !p)}
            className="h-8 w-8 flex items-center justify-center bg-white/15 hover:bg-white/25 transition-colors text-[10px] font-black uppercase tracking-wider"
          >
            {user?.initials || "?"}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom"><span>{user?.name || "Guest"}</span></TooltipContent>
      </Tooltip>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-card border border-border shadow-lg z-50 text-foreground">
          {/* User info */}
          <div className="p-4 border-b border-border space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-primary/15 border border-primary/30 flex items-center justify-center text-sm font-black text-primary">
                {user?.initials || "?"}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">{user?.name || "Guest"}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{roleLabels[user?.role || "student"]}</p>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="p-3 space-y-2 border-b border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{user?.email || "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <GraduationCap className="h-3.5 w-3.5 shrink-0" />
              <span>Year {user?.year || "—"}, Semester {user?.semester || "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <RoleIcon className="h-3.5 w-3.5 shrink-0" />
              <span>{user?.batch || "—"} Division</span>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={() => {
              setOpen(false);
              setLogoutOpen(true);
            }}
            className="w-full flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Log Out
          </button>
        </div>
      )}

      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log Out</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to log out of your account?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Log Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function AppLayout() {
  const { batchTheme, colorMode, toggleColorMode } = useTheme();

  return (
    <SidebarProvider>
      <TooltipProvider>
        <div className="min-h-screen flex w-full">
          <div className="hidden md:block">
            <AppSidebar />
          </div>

          <div className="flex-1 flex flex-col min-w-0">
            <header
              className="h-12 flex items-center border-b border-border px-4 gap-3 shrink-0"
              style={{
                backgroundColor: `hsl(${batchTheme.headerBg})`,
                color: `hsl(${batchTheme.headerFg})`,
              }}
            >
              <SidebarTrigger className="hidden md:flex text-inherit hover:bg-white/10" />
              <div className="h-5 w-px bg-current opacity-20 hidden md:block" />
              <span className="text-xs font-bold uppercase tracking-[0.2em]">SCOLA</span>
              <span className="text-[10px] uppercase tracking-widest opacity-60 hidden sm:inline">
                {batchTheme.name} Division
              </span>

              <div className="flex-1" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={toggleColorMode}
                    className="h-8 w-8 flex items-center justify-center hover:bg-white/10 transition-colors"
                  >
                    {colorMode === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <span>{colorMode === "light" ? "Dark mode" : "Light mode"}</span>
                </TooltipContent>
              </Tooltip>

              <UserMenu />
            </header>

            <main className="flex-1 overflow-auto pb-14 md:pb-0">
              <Outlet />
            </main>
          </div>

          <BottomNav />
        </div>
      </TooltipProvider>
    </SidebarProvider>
  );
}
