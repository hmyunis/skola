import { useState, useRef, useEffect, useMemo } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { BottomNav } from "@/components/BottomNav";
import { CommandPalette } from "@/components/CommandPalette";
import { useTheme } from "@/stores/themeStore";
import { useAuth } from "@/stores/authStore";
import { useSemesterStore } from "@/stores/semesterStore";
import { useClassroomStore } from "@/stores/classroomStore";
import { useSyncClassroom } from "@/hooks/use-classroom";
import { apiFetch } from "@/services/api";
import type { ClassroomMembershipContext, ClassroomRole } from "@/types/classroom";
import {
  Sun,
  Moon,
  LogOut,
  GraduationCap,
  CalendarDays,
  Send,
  Bell,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import type { Semester } from "@/types/admin";
import {
  dismissInAppNotification,
  fetchInAppNotifications,
  markInAppNotificationRead,
  type InAppNotificationItem,
} from "@/services/notifications";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { AssistantChatFab } from "@/components/AssistantChatFab";

const roleLabels = { owner: "Owner", admin: "Admin", student: "Student" };

interface ClassroomContextApiResponse {
  classrooms?: ClassroomMembershipContext["classroom"][];
  memberships?: Array<{
    classroom?: ClassroomMembershipContext["classroom"];
    role?: ClassroomRole;
    joinedAt?: string;
    status?: "active" | "suspended" | "banned";
    suspendedUntil?: string | null;
  }>;
  user?: { role?: ClassroomRole; [key: string]: unknown };
}

function normalizeMemberships(
  payload: ClassroomContextApiResponse,
  fallbackRole: ClassroomRole,
): ClassroomMembershipContext[] {
  const now = Date.now();
  if (Array.isArray(payload?.memberships) && payload.memberships.length > 0) {
    return payload.memberships
      .filter((item) => item?.classroom?.id)
      .filter((item) => {
        if (item?.status === "banned") return false;
        if (item?.status === "suspended") {
          if (!item.suspendedUntil) return false;
          const until = new Date(item.suspendedUntil).getTime();
          return Number.isFinite(until) ? until <= now : false;
        }
        return true;
      })
      .map((item) => ({
        classroom: item.classroom!,
        role: item.role || fallbackRole,
        joinedAt: item.joinedAt || new Date(0).toISOString(),
      }));
  }

  if (Array.isArray(payload?.classrooms) && payload.classrooms.length > 0) {
    return payload.classrooms
      .filter((classroom) => classroom?.id)
      .map((classroom) => ({
        classroom,
        role: fallbackRole,
        joinedAt: new Date(0).toISOString(),
      }));
  }

  return [];
}

function formatNotificationTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function UserMenu({
  activeSemester,
  onLogout,
}: {
  activeSemester: Semester | null;
  onLogout: () => void;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const activeClassroomRole = useClassroomStore((s) => s.activeClassroomRole);
  const [open, setOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const yearValue = activeSemester?.year ?? user?.year ?? "—";
  const semesterValue = activeSemester?.name ?? user?.semester ?? "—";
  const telegramUsername = user?.telegramUsername?.replace(/^@+/, "");
  const effectiveRole = (activeClassroomRole || "student") as keyof typeof roleLabels;

  return (
    <div className="relative" ref={ref}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setOpen((p) => !p)}
            className="h-8 w-8 flex items-center justify-center bg-white/15 hover:bg-white/25 transition-all text-[10px] font-black uppercase tracking-wider overflow-hidden"
          >
            {user?.photoUrl ? (
              <img src={user.photoUrl} alt={user.name} className="h-full w-full object-cover" />
            ) : (
              user?.initials || "?"
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom"><span>{user?.name || "Guest"}</span></TooltipContent>
      </Tooltip>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-card border border-border shadow-lg z-50 text-foreground">
          {/* User info */}
          <div className="p-4 border-b border-border space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-primary/15 border border-primary/30 flex items-center justify-center text-sm font-black text-primary overflow-hidden">
                {user?.photoUrl ? (
                  <img src={user.photoUrl} alt={user.name} className="h-full w-full object-cover" />
                ) : (
                  user?.initials || "?"
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">{user?.name || "Guest"}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{roleLabels[effectiveRole]}</p>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="p-3 space-y-2 border-b border-border">
            {telegramUsername && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-3.5 w-3.5 flex items-center justify-center text-[10px] font-bold border border-current rounded-full shrink-0">@</span>
                <span className="truncate">@{telegramUsername}</span>
                <a
                  href={`https://t.me/${telegramUsername}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-sm border border-border text-muted-foreground transition-colors hover:text-foreground hover:bg-accent"
                  title={`Open @${telegramUsername} on Telegram`}
                  aria-label={`Open @${telegramUsername} on Telegram`}
                >
                  <Send className="h-3.5 w-3.5" />
                </a>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <GraduationCap className="h-3.5 w-3.5 shrink-0" />
              <span className="max-w-[160px] leading-snug">
                <span className="block">Year {yearValue}</span>
                <span className="block break-words">Semester {semesterValue}</span>
              </span>
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
                onLogout();
                navigate("/login", { replace: true });
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
  const { batchTheme, colorMode, toggleColorMode, syncThemeWithStores } = useTheme();
  const { user, logout, setUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [switchConfirmOpen, setSwitchConfirmOpen] = useState(false);
  const [pendingClassroomId, setPendingClassroomId] = useState<string | null>(null);
  const [isSwitchingClassroom, setIsSwitchingClassroom] = useState(false);
  const activeSemester = useSemesterStore((s) => s.activeSemester);
  const activeClassroom = useClassroomStore((s) => s.activeClassroom);
  const memberships = useClassroomStore((s) => s.memberships);
  const setMemberships = useClassroomStore((s) => s.setMemberships);
  const setActiveClassroomById = useClassroomStore((s) => s.setActiveClassroomById);
  useSyncClassroom(); // This will keep classroom data (features, etc.) in sync

  const { data: classroomContextData, isLoading: isClassroomContextLoading } = useQuery({
    queryKey: ["classroomsContext", user?.id],
    queryFn: () => apiFetch("/classrooms/my") as Promise<ClassroomContextApiResponse>,
    enabled: !!user,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!classroomContextData) return;
    const fallbackRole: ClassroomRole = "student";
    const normalizedMemberships = normalizeMemberships(classroomContextData, fallbackRole);
    setMemberships(normalizedMemberships);
    if (classroomContextData?.user) {
      setUser(classroomContextData.user);
    }
  }, [classroomContextData, setMemberships, setUser]);

  const membershipIds = useMemo(
    () => memberships.map((membership) => membership.classroom.id),
    [memberships],
  );

  const { data: activeSemesterByClassroomId = {} } = useQuery({
    queryKey: ["classroomSwitcherSemesters", membershipIds],
    enabled: membershipIds.length > 0 && !!user,
    staleTime: 300_000,
    queryFn: async () => {
      const entries = await Promise.all(
        membershipIds.map(async (classroomId) => {
          try {
            const semester = await apiFetch("/academics/semesters/active", {
              headers: { "x-classroom-id": classroomId },
            });
            const name =
              typeof semester?.name === "string" && semester.name.trim()
                ? semester.name.trim()
                : null;
            return [classroomId, name] as const;
          } catch (error: any) {
            if (error?.status === 404) return [classroomId, null] as const;
            return [classroomId, null] as const;
          }
        }),
      );
      return Object.fromEntries(entries) as Record<string, string | null>;
    },
  });

  const classroomSwitchOptions = useMemo(
    () =>
      memberships.map((membership, index) => {
        const classroom = membership.classroom;
        const semesterName = activeSemesterByClassroomId[classroom.id] || null;
        const friendlyFallback = `Classroom ${index + 1}`;
        const primaryLabel = semesterName || friendlyFallback;
        return {
          classroomId: classroom.id,
          primaryLabel,
        };
      }),
    [memberships, activeSemesterByClassroomId],
  );

  const pendingClassroomOption = pendingClassroomId
    ? classroomSwitchOptions.find((option) => option.classroomId === pendingClassroomId) || null
    : null;

  const selectedClassroomId =
    switchConfirmOpen && pendingClassroomId ? pendingClassroomId : activeClassroom?.id;

  const handleClassroomSwitchSelect = (classroomId: string) => {
    if (!classroomId || classroomId === activeClassroom?.id) return;
    setPendingClassroomId(classroomId);
    setSwitchConfirmOpen(true);
  };

  const applyClassroomSwitch = () => {
    if (!pendingClassroomId || pendingClassroomId === activeClassroom?.id) {
      setSwitchConfirmOpen(false);
      setPendingClassroomId(null);
      return;
    }
    setIsSwitchingClassroom(true);
    setActiveClassroomById(pendingClassroomId);
    queryClient.clear();
    syncThemeWithStores();
    window.location.reload();
  };

  const cancelClassroomSwitch = () => {
    setSwitchConfirmOpen(false);
    setPendingClassroomId(null);
    setIsSwitchingClassroom(false);
  };

  const handleLogout = () => {
    queryClient.clear();
    logout();
  };

  useEffect(() => {
    if (!activeClassroom?.id || !user) return;
    let cancelled = false;
    apiFetch("/users/me")
      .then((profile) => {
        if (!cancelled && profile) {
          setUser(profile);
          syncThemeWithStores();
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [activeClassroom?.id, user?.id, setUser, syncThemeWithStores]);

  const { data: inAppNotificationData } = useQuery({
    queryKey: ["inAppNotificationsUnread", activeClassroom?.id],
    queryFn: () => fetchInAppNotifications(5),
    enabled: !!user && !!activeClassroom?.id,
    refetchInterval: 30_000,
  });
  const markNotificationReadMutation = useMutation({
    mutationFn: markInAppNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["inAppNotificationsUnread", activeClassroom?.id || null],
      });
      queryClient.invalidateQueries({
        queryKey: ["inAppNotifications", activeClassroom?.id || null],
      });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Could not mark notification as read.";
      toast({ title: "Error", description: message, variant: "destructive" });
    },
  });
  const dismissNotificationMutation = useMutation({
    mutationFn: dismissInAppNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["inAppNotificationsUnread", activeClassroom?.id || null],
      });
      queryClient.invalidateQueries({
        queryKey: ["inAppNotifications", activeClassroom?.id || null],
      });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Could not dismiss notification.";
      toast({ title: "Error", description: message, variant: "destructive" });
    },
  });
  const notificationItems = inAppNotificationData?.items || [];
  const unreadCount = inAppNotificationData?.unreadCount || 0;

  // Authentication protection
  useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true });
    }
  }, [user, navigate]);

  // Redirection for users without a classroom
  useEffect(() => {
    if (user && !activeClassroom && !isClassroomContextLoading && memberships.length === 0) {
      navigate("/get-started");
    }
  }, [user, activeClassroom, isClassroomContextLoading, memberships.length, navigate]);

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
              <span className="text-xs font-bold uppercase tracking-[0.2em]">SKOLA</span>
              {activeSemester && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 bg-white/10 text-[10px] uppercase tracking-wider font-bold cursor-default">
                      <CalendarDays className="h-2.5 w-2.5" />
                      {activeSemester.name}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <span>Active semester: {activeSemester.name}</span>
                  </TooltipContent>
                </Tooltip>
              )}
              {memberships.length > 1 && (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="opacity-70 hidden sm:inline text-[10px] uppercase tracking-wider font-bold">
                    Class
                  </span>
                  <Select value={selectedClassroomId} onValueChange={handleClassroomSwitchSelect}>
                    <SelectTrigger
                      aria-label="Switch classroom"
                      className="h-8 w-[8.75rem] sm:w-auto sm:min-w-[10rem] max-w-[10.5rem] sm:max-w-[15rem] border-white/25 bg-white/10 text-inherit text-[11px] font-semibold focus:ring-white/40 focus:ring-offset-0 hover:bg-white/15 [&>span]:max-w-[6.75rem] sm:[&>span]:max-w-[11.5rem] [&>span]:truncate"
                    >
                      <SelectValue placeholder="Switch classroom" />
                    </SelectTrigger>
                    <SelectContent align="start" className="max-w-[20rem]">
                      {classroomSwitchOptions.map((option) => (
                        <SelectItem key={option.classroomId} value={option.classroomId} className="py-2">
                          {option.primaryLabel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <CommandPalette />
              <div className="flex-1" />

              <Popover open={notificationOpen} onOpenChange={setNotificationOpen}>
                <PopoverTrigger asChild>
                  <button
                    className="relative h-8 w-8 flex items-center justify-center hover:bg-white/10 transition-colors"
                    aria-label="Open notifications"
                  >
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-[9px] leading-4 text-destructive-foreground font-bold">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  className="w-[min(92vw,24rem)] p-0 border border-border bg-card text-card-foreground"
                >
                  <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
                    <p className="text-[11px] font-bold uppercase tracking-wider">
                      Notifications ({unreadCount} unread)
                    </p>
                    <button
                      onClick={() => {
                        setNotificationOpen(false);
                        navigate("/settings?tab=notifications");
                      }}
                      className="text-[10px] font-semibold uppercase tracking-wider text-primary hover:opacity-80"
                    >
                      View all
                    </button>
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    {!notificationItems.length && (
                      <p className="px-3 py-4 text-xs text-muted-foreground">
                        No notifications yet.
                      </p>
                    )}

                    {notificationItems.map((item: InAppNotificationItem) => (
                      <div
                        key={item.id}
                        className="px-3 py-2 border-b border-border/70 last:border-b-0"
                      >
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold leading-snug">{item.title}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5 whitespace-pre-wrap break-words">
                              {item.body}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {formatNotificationTime(item.createdAt)}
                            </p>
                          </div>

                          <div className="flex items-center gap-1 pt-0.5">
                            {!item.isRead && (
                              <button
                                onClick={() => markNotificationReadMutation.mutate(item.id)}
                                disabled={
                                  markNotificationReadMutation.isPending ||
                                  dismissNotificationMutation.isPending
                                }
                                className="h-6 w-6 inline-flex items-center justify-center rounded-sm border border-border text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Mark as read"
                                aria-label="Mark notification as read"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            )}

                            <button
                              onClick={() => dismissNotificationMutation.mutate(item.id)}
                              disabled={
                                markNotificationReadMutation.isPending ||
                                dismissNotificationMutation.isPending
                              }
                              className="h-6 w-6 inline-flex items-center justify-center rounded-sm border border-border text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Dismiss"
                              aria-label="Dismiss notification"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

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

              <UserMenu activeSemester={activeSemester} onLogout={handleLogout} />
            </header>

            <AlertDialog
              open={switchConfirmOpen}
              onOpenChange={(open) => {
                if (open) {
                  setSwitchConfirmOpen(true);
                  return;
                }
                if (!isSwitchingClassroom) {
                  cancelClassroomSwitch();
                }
              }}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Switch classroom</AlertDialogTitle>
                  <AlertDialogDescription>
                    {`Switch to ${pendingClassroomOption?.primaryLabel || "the selected classroom"}?`}
                    {" "}
                    The app will reload so all classroom-scoped data and permissions are applied cleanly.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={cancelClassroomSwitch} disabled={isSwitchingClassroom}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction onClick={applyClassroomSwitch} disabled={isSwitchingClassroom}>
                    {isSwitchingClassroom ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Switching...
                      </>
                    ) : (
                      "Switch and reload"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <main className="flex-1 overflow-auto pb-14 md:pb-0">
              <Outlet />
            </main>
          </div>

          <AssistantChatFab />
          <BottomNav />
        </div>
      </TooltipProvider>
    </SidebarProvider>
  );
}
