import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { BottomNav } from "@/components/BottomNav";
import { useTheme } from "@/contexts/ThemeContext";

export function AppLayout() {
  const { batchTheme } = useTheme();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        {/* Desktop sidebar */}
        <div className="hidden md:block">
          <AppSidebar />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          {/* Top header bar */}
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
          </header>

          {/* Main content */}
          <main className="flex-1 overflow-auto pb-16 md:pb-0">
            <Outlet />
          </main>
        </div>

        {/* Mobile bottom nav */}
        <BottomNav />
      </div>
    </SidebarProvider>
  );
}
