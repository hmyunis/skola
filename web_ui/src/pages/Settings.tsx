import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTheme, FONT_FAMILIES } from "@/stores/themeStore";
import { useClassroomStore } from "@/stores/classroomStore";
import { useAuthStore } from "@/stores/authStore";
import { userAccents } from "@/lib/themes";
import { useUpdateUserTheme } from "@/hooks/use-theme";
import {
  fetchAssistantSettings,
  deleteMyAccount,
  fetchAccountDeletionContext,
  fetchImageUploadSettings,
  saveAssistantSettings,
  saveImageUploadSettings,
  type AccountDeletionContext,
  type ImageUploadSettings,
} from "@/services/users";
import {
  fetchInAppNotifications,
  fetchNotificationSettings,
  fetchWebPushConfig,
  markAllInAppNotificationsRead,
  markInAppNotificationRead,
  saveNotificationSettings,
  sendTestNotification,
  subscribeWebPush,
  unsubscribeWebPush,
  type InAppNotificationItem,
  type NotificationTestResponse,
  type NotificationTestType,
  type NotificationSettings,
} from "@/services/notifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/services/api";
import type { ClassroomMembershipContext, ClassroomRole } from "@/types/classroom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sun,
  Moon,
  Type,
  KeyRound,
  Bell,
  AppWindow,
  Send,
  Globe,
  CheckCircle2,
  Circle,
  Info,
  AlertTriangle,
  Trash2,
} from "lucide-react";

const DELETE_ACCOUNT_CONFIRMATION_TEXT = "LEAVE CLASSROOM";

function normalizeDeleteConfirmation(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

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

const defaultNotificationSettings: NotificationSettings = {
  inAppAnnouncements: true,
  browserPushAnnouncements: false,
  botDmAnnouncements: false,
};

type BrowserPermissionState = NotificationPermission | "unsupported";

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

function readBrowserPermission(): BrowserPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function getPushWorkerScriptPath() {
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${normalizedBase}push-sw.js`;
}

async function findPushServiceWorkerRegistration() {
  if (!("serviceWorker" in navigator)) {
    return null;
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  for (const registration of registrations) {
    const scriptUrl =
      registration.active?.scriptURL ||
      registration.installing?.scriptURL ||
      registration.waiting?.scriptURL;
    if (!scriptUrl) continue;
    try {
      const pathname = new URL(scriptUrl).pathname;
      if (pathname.endsWith("/push-sw.js")) {
        return registration;
      }
    } catch {
      // ignore malformed scriptURL and continue scanning
    }
  }
  return null;
}

async function ensurePushServiceWorkerRegistration() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service workers are not supported on this browser.");
  }

  const existing = await findPushServiceWorkerRegistration();
  if (existing) {
    return existing;
  }

  const scriptPath = getPushWorkerScriptPath();
  return navigator.serviceWorker.register(scriptPath, { scope: "/push/" });
}

function NotificationFeed({
  notifications,
  onRead,
  isBusy,
}: {
  notifications: InAppNotificationItem[];
  onRead: (id: string) => void;
  isBusy: boolean;
}) {
  if (!notifications.length) {
    return (
      <p className="text-xs text-muted-foreground">
        No in-app notifications yet. New announcements will appear here.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {notifications.map((item) => (
        <div
          key={item.id}
          className={cn(
            "border p-3",
            item.isRead ? "border-border bg-muted/20" : "border-primary/30 bg-primary/5",
          )}
        >
          <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5">
              {item.isRead ? (
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Circle className="h-4 w-4 text-primary fill-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold">{item.title}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 whitespace-pre-wrap break-words">{item.body}</p>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                {formatNotificationTime(item.createdAt)}
              </p>
            </div>
            {!item.isRead && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[10px] uppercase tracking-wider"
                onClick={() => onRead(item.id)}
                disabled={isBusy}
              >
                Mark read
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const SettingsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const activeTab =
    requestedTab === "notifications" || requestedTab === "byok" || requestedTab === "account"
      ? requestedTab
      : "appearance";

  const {
    userAccent,
    setUserAccent,
    colorMode,
    setColorMode,
    fontFamily,
    setFontFamily,
  } = useTheme();
  const updateUserTheme = useUpdateUserTheme();
  const queryClient = useQueryClient();
  const activeClassroomId = useClassroomStore((s) => s.activeClassroom?.id || null);
  const activeClassroomName = useClassroomStore((s) => s.activeClassroom?.name || "this classroom");
  const setMemberships = useClassroomStore((s) => s.setMemberships);
  const clearActiveClassroom = useClassroomStore((s) => s.clearActiveClassroom);
  const setUser = useAuthStore((s) => s.setUser);

  const [usePersonalApiKey, setUsePersonalApiKey] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [assistantApiKey, setAssistantApiKey] = useState("");
  const [initialByokSettingsLoaded, setInitialByokSettingsLoaded] = useState(false);

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(
    defaultNotificationSettings,
  );
  const [initialNotificationSettingsLoaded, setInitialNotificationSettingsLoaded] = useState(false);
  const [browserPermission, setBrowserPermission] =
    useState<BrowserPermissionState>(readBrowserPermission());
  const [devicePushSubscribed, setDevicePushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [testBusyType, setTestBusyType] = useState<NotificationTestType | null>(null);
  const [notificationTriggersOpen, setNotificationTriggersOpen] = useState(false);
  const [deleteAccountDialogOpen, setDeleteAccountDialogOpen] = useState(false);
  const [deleteAccountConfirmation, setDeleteAccountConfirmation] = useState("");
  const [successorMemberId, setSuccessorMemberId] = useState("");
  const geminiApiGuideVideoSrc = `${import.meta.env.BASE_URL}video/How_to_get_Gemini_API_Key.mp4`;

  const imageSettingsQuery = useQuery({
    queryKey: ["imageUploadSettings", activeClassroomId],
    queryFn: fetchImageUploadSettings,
    enabled: !!activeClassroomId,
  });

  const assistantSettingsQuery = useQuery({
    queryKey: ["assistantSettings", activeClassroomId],
    queryFn: fetchAssistantSettings,
    enabled: !!activeClassroomId,
  });

  const notificationSettingsQuery = useQuery({
    queryKey: ["notificationSettings", activeClassroomId],
    queryFn: fetchNotificationSettings,
    enabled: !!activeClassroomId,
  });

  const webPushConfigQuery = useQuery({
    queryKey: ["webPushConfig", activeClassroomId],
    queryFn: fetchWebPushConfig,
    enabled: !!activeClassroomId,
  });

  const inAppNotificationsQuery = useQuery({
    queryKey: ["inAppNotifications", activeClassroomId],
    queryFn: () => fetchInAppNotifications(40),
    refetchInterval: 20_000,
    enabled: !!activeClassroomId,
  });

  const accountDeletionContextQuery = useQuery({
    queryKey: ["accountDeletionContext", activeClassroomId],
    queryFn: fetchAccountDeletionContext,
    enabled: deleteAccountDialogOpen && !!activeClassroomId,
    staleTime: 60_000,
  });

  const refreshDevicePushState = useCallback(async () => {
    setBrowserPermission(readBrowserPermission());
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setDevicePushSubscribed(false);
      return;
    }

    try {
      const registration = await findPushServiceWorkerRegistration();
      if (!registration) {
        setDevicePushSubscribed(false);
        return;
      }
      const subscription = await registration.pushManager.getSubscription();
      setDevicePushSubscribed(Boolean(subscription));
    } catch {
      setDevicePushSubscribed(false);
    }
  }, []);

  useEffect(() => {
    if (!imageSettingsQuery.data || initialByokSettingsLoaded) return;
    setUsePersonalApiKey(imageSettingsQuery.data.usePersonalApiKey);
    setInitialByokSettingsLoaded(true);
  }, [imageSettingsQuery.data, initialByokSettingsLoaded]);

  useEffect(() => {
    if (!notificationSettingsQuery.data || initialNotificationSettingsLoaded) return;
    setNotificationSettings(notificationSettingsQuery.data);
    setInitialNotificationSettingsLoaded(true);
  }, [notificationSettingsQuery.data, initialNotificationSettingsLoaded]);

  useEffect(() => {
    void refreshDevicePushState();
  }, [refreshDevicePushState]);

  useEffect(() => {
    if (deleteAccountDialogOpen) return;
    setDeleteAccountConfirmation("");
    setSuccessorMemberId("");
  }, [deleteAccountDialogOpen]);

  const imageSettingsMutation = useMutation({
    mutationFn: saveImageUploadSettings,
    onSuccess: (next: ImageUploadSettings) => {
      setUsePersonalApiKey(next.usePersonalApiKey);
      setApiKey("");
      imageSettingsQuery.refetch();
      toast({ title: "Saved", description: "Image upload settings updated." });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Could not update image upload settings.";
      toast({ title: "Error", description: message, variant: "destructive" });
    },
  });

  const assistantSettingsMutation = useMutation({
    mutationFn: saveAssistantSettings,
    onSuccess: () => {
      setAssistantApiKey("");
      assistantSettingsQuery.refetch();
      toast({ title: "Saved", description: "Assistant BYOK settings updated." });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Could not update assistant BYOK settings.";
      toast({ title: "Error", description: message, variant: "destructive" });
    },
  });

  const notificationSettingsMutation = useMutation({
    mutationFn: (payload: Partial<NotificationSettings>) => saveNotificationSettings(payload),
    onSuccess: (next: NotificationSettings) => {
      setNotificationSettings(next);
      queryClient.invalidateQueries({ queryKey: ["notificationSettings", activeClassroomId] });
      toast({ title: "Saved", description: "Notification preferences updated." });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Could not update notification settings.";
      toast({ title: "Error", description: message, variant: "destructive" });
    },
  });

  const markNotificationReadMutation = useMutation({
    mutationFn: markInAppNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inAppNotifications", activeClassroomId] });
      queryClient.invalidateQueries({ queryKey: ["inAppNotificationsUnread", activeClassroomId] });
    },
  });

  const markAllNotificationsReadMutation = useMutation({
    mutationFn: markAllInAppNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inAppNotifications", activeClassroomId] });
      queryClient.invalidateQueries({ queryKey: ["inAppNotificationsUnread", activeClassroomId] });
      toast({ title: "Done", description: "All in-app notifications marked as read." });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Could not mark notifications as read.";
      toast({ title: "Error", description: message, variant: "destructive" });
    },
  });

  const handleUpdate = (settings: any) => {
    updateUserTheme.mutate(settings);
  };

  const deleteAccountMutation = useMutation({
    mutationFn: (payload: { successorMemberId?: string }) => deleteMyAccount(payload),
    onSuccess: async () => {
      let classroomContext: ClassroomContextApiResponse = {};
      try {
        classroomContext = await apiFetch("/classrooms/my");
      } catch {
        classroomContext = {};
      }
      const fallbackRole: ClassroomRole = "student";
      const nextMemberships = normalizeMemberships(classroomContext, fallbackRole);
      if (classroomContext?.user) {
        setUser(classroomContext.user);
      }
      setMemberships(nextMemberships);
      if (nextMemberships.length === 0) {
        clearActiveClassroom();
      }

      setDeleteAccountDialogOpen(false);
      setDeleteAccountConfirmation("");
      setSuccessorMemberId("");
      queryClient.clear();

      if (nextMemberships.length === 0) {
        toast({
          title: "Classroom Left",
          description: "You left this classroom. You can join another classroom or create one.",
        });
        navigate("/get-started", { replace: true });
        return;
      }

      toast({
        title: "Classroom Left",
        description: "You were removed from this classroom. Your account is still active.",
      });
      navigate("/dashboard", { replace: true });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Could not leave this classroom.";
      toast({ title: "Error", description: message, variant: "destructive" });
    },
  });

  const saveByokSettings = () => {
    imageSettingsMutation.mutate({
      usePersonalApiKey,
      apiKey: apiKey.trim() || undefined,
    });
  };

  const clearSavedByokKey = () => {
    imageSettingsMutation.mutate({
      usePersonalApiKey: false,
      clearApiKey: true,
    });
  };

  const saveAssistantByokSettings = () => {
    assistantSettingsMutation.mutate({
      usePersonalApiKey: true,
      apiKey: assistantApiKey.trim() || undefined,
    });
  };

  const clearSavedAssistantByokKey = () => {
    assistantSettingsMutation.mutate({
      usePersonalApiKey: true,
      clearApiKey: true,
    });
  };

  const saveNotificationPreferences = () => {
    notificationSettingsMutation.mutate(notificationSettings);
  };

  const enableBrowserPush = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      const config = webPushConfigQuery.data;
      if (!config?.configured || !config.publicKey) {
        throw new Error(
          "Browser push is not configured on the server. Ask the owner to set VAPID keys.",
        );
      }

      if (!("Notification" in window)) {
        throw new Error("Notifications are not supported by this browser.");
      }
      if (!("PushManager" in window)) {
        throw new Error("Push API is not supported by this browser.");
      }

      const currentPermission = readBrowserPermission();
      let permission = currentPermission;
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }
      setBrowserPermission(permission);
      if (permission !== "granted") {
        throw new Error("Browser notification permission was not granted.");
      }

      const registration = await ensurePushServiceWorkerRegistration();
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(config.publicKey),
        });
      }

      const payload = subscription.toJSON();
      if (!payload.endpoint || !payload.keys?.p256dh || !payload.keys?.auth) {
        throw new Error("Could not serialize browser push subscription payload.");
      }

      await subscribeWebPush({
        endpoint: payload.endpoint,
        keys: {
          p256dh: payload.keys.p256dh,
          auth: payload.keys.auth,
        },
        expirationTime: payload.expirationTime ?? null,
        userAgent: (navigator.userAgent || "").slice(0, 255) || undefined,
      });

      if (!notificationSettings.browserPushAnnouncements) {
        const next = { ...notificationSettings, browserPushAnnouncements: true };
        setNotificationSettings(next);
        await notificationSettingsMutation.mutateAsync({
          browserPushAnnouncements: true,
        });
      }

      await refreshDevicePushState();
      toast({ title: "Connected", description: "This browser can now receive push notifications." });
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Could not enable browser push.";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setPushBusy(false);
    }
  };

  const disableBrowserPush = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      if (!("serviceWorker" in navigator)) {
        setDevicePushSubscribed(false);
        return;
      }

      const registration = await findPushServiceWorkerRegistration();
      if (!registration) {
        setDevicePushSubscribed(false);
        return;
      }

      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setDevicePushSubscribed(false);
        return;
      }

      const endpoint = subscription.endpoint;
      if (endpoint) {
        await unsubscribeWebPush(endpoint);
      }
      await subscription.unsubscribe();
      await refreshDevicePushState();
      toast({
        title: "Disconnected",
        description: "This browser has been unsubscribed from push notifications.",
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Could not disable browser push.";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setPushBusy(false);
    }
  };

  const describeTestResult = (result: NotificationTestResponse) => {
    const inAppText =
      result.inApp === "sent" ? "In-app: sent" : "In-app: disabled in your preferences";
    const pushText =
      result.browserPush === "sent"
        ? "Browser push: sent"
        : result.browserPush === "skipped_disabled"
          ? "Browser push: disabled in your preferences"
          : result.browserPush === "skipped_unconfigured"
            ? "Browser push: server not configured (missing VAPID)"
            : "Browser push: no active browser subscription";
    const dmText =
      result.botDm === "sent"
        ? "Bot DM: sent"
        : result.botDm === "skipped_disabled"
          ? "Bot DM: disabled in your preferences"
          : result.botDm === "skipped_unconfigured"
            ? "Bot DM: bot token missing on server"
            : "Bot DM: your Telegram account is not linked";

    return `${inAppText} | ${pushText} | ${dmText}`;
  };

  const runNotificationTest = async (type: NotificationTestType) => {
    if (testBusyType) return;
    setTestBusyType(type);
    try {
      const result = await sendTestNotification(type);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inAppNotifications", activeClassroomId] }),
        queryClient.invalidateQueries({ queryKey: ["inAppNotificationsUnread", activeClassroomId] }),
      ]);
      toast({
        title: type === "announcement" ? "Announcement test sent" : "Mention test sent",
        description: describeTestResult(result),
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Could not send test notification.";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setTestBusyType(null);
    }
  };

  const currentByokSettings = imageSettingsQuery.data;
  const currentAssistantByokSettings = assistantSettingsQuery.data;
  const isByokBusy =
    imageSettingsQuery.isLoading ||
    imageSettingsMutation.isPending ||
    assistantSettingsQuery.isLoading ||
    assistantSettingsMutation.isPending;
  const isNotificationsBusy =
    notificationSettingsQuery.isLoading || notificationSettingsMutation.isPending;
  const unreadCount = inAppNotificationsQuery.data?.unreadCount || 0;
  const notificationItems = useMemo(
    () => inAppNotificationsQuery.data?.items || [],
    [inAppNotificationsQuery.data?.items],
  );
  const browserPushSupported = browserPermission !== "unsupported";
  const serverPushConfigured = Boolean(
    webPushConfigQuery.data?.configured && webPushConfigQuery.data?.publicKey,
  );
  const deletionContext: AccountDeletionContext | undefined = accountDeletionContextQuery.data;
  const requiresSuccessor = Boolean(deletionContext?.isOwner);
  const adminCandidates = deletionContext?.adminCandidates || [];
  const missingSuccessor =
    requiresSuccessor && (adminCandidates.length === 0 || !successorMemberId);
  const isDeleteConfirmationMatched =
    normalizeDeleteConfirmation(deleteAccountConfirmation) === DELETE_ACCOUNT_CONFIRMATION_TEXT;
  const canConfirmDelete =
    isDeleteConfirmationMatched &&
    !missingSuccessor &&
    !deleteAccountMutation.isPending &&
    Boolean(activeClassroomId);

  const submitDeleteAccount = () => {
    if (!canConfirmDelete) return;
    deleteAccountMutation.mutate({
      successorMemberId: requiresSuccessor ? successorMemberId : undefined,
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      <div className="border-b border-border pb-4">
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">
          Configuration
        </p>
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider">Settings</h1>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(nextTab) => {
          const next = new URLSearchParams(searchParams);
          next.set("tab", nextTab);
          setSearchParams(next, { replace: true });
        }}
        className="space-y-6"
      >
        <TabsList>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="byok">BYOK</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>

        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xs">Color Mode</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setColorMode("light");
                    handleUpdate({ colorMode: "light" });
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 border text-xs font-bold uppercase tracking-wider transition-colors ${
                    colorMode === "light"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-accent text-foreground"
                  }`}
                >
                  <Sun className="h-4 w-4" />
                  Light
                </button>
                <button
                  onClick={() => {
                    setColorMode("dark");
                    handleUpdate({ colorMode: "dark" });
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 border text-xs font-bold uppercase tracking-wider transition-colors ${
                    colorMode === "dark"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-accent text-foreground"
                  }`}
                >
                  <Moon className="h-4 w-4" />
                  Dark
                </button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xs flex items-center gap-2">
                <Type className="h-3.5 w-3.5" />
                Font Family
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {FONT_FAMILIES.map((font) => (
                  <button
                    key={font.id}
                    onClick={() => {
                      setFontFamily(font.id);
                      handleUpdate({ fontFamily: font.id });
                    }}
                    className={`p-3 border text-left transition-colors ${
                      fontFamily === font.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-accent text-foreground"
                    }`}
                    style={{ fontFamily: font.value }}
                  >
                    <span className="text-sm font-semibold block">{font.name}</span>
                    <span className="text-[10px] text-muted-foreground mt-1 block">Aa Bb Cc 123</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xs">User Accent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setUserAccent(null);
                    handleUpdate({ accentColor: null });
                  }}
                  className={`px-4 py-2 border text-xs font-bold uppercase tracking-wider transition-colors ${
                    !userAccent
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-accent text-foreground"
                  }`}
                >
                  Default
                </button>
                {userAccents.map((accent) => (
                  <button
                    key={accent.id}
                    onClick={() => {
                      setUserAccent(accent);
                      handleUpdate({ accentColor: accent.id });
                    }}
                    className={`px-4 py-2 border text-xs font-bold uppercase tracking-wider transition-colors ${
                      userAccent?.id === accent.id ? "border-2" : "border-border hover:bg-accent"
                    }`}
                    style={{
                      color: `hsl(${accent.hsl})`,
                      borderColor:
                        userAccent?.id === accent.id ? `hsl(${accent.hsl})` : undefined,
                    }}
                  >
                    {accent.name}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

        </TabsContent>

        <TabsContent value="byok" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xs flex items-center gap-2">
                <KeyRound className="h-3.5 w-3.5" />
                Lounge Image Upload (BYOK)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Use your own <a href="https://api.imgbb.com/" target="_blank" rel="noopener noreferrer" className="underline">imgbb API key</a> for hosting images uploaded in the lounge. When
                disabled, the app uses the default global key from server config.
              </p>

              <div className="flex items-center justify-between gap-3 border border-border p-3">
                <div className="space-y-0.5">
                  <Label className="text-xs">Use Personal API Key</Label>
                  <p className="text-[11px] text-muted-foreground">
                    {currentByokSettings?.hasPersonalApiKey
                      ? `Saved key: ${currentByokSettings.keyHint || "hidden"}`
                      : "No personal key saved yet"}
                  </p>
                </div>
                <Switch
                  checked={usePersonalApiKey}
                  onCheckedChange={setUsePersonalApiKey}
                  disabled={isByokBusy}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Personal API Key</Label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder={
                    currentByokSettings?.hasPersonalApiKey
                      ? "Leave empty to keep saved key"
                      : "Paste your imgbb API key"
                  }
                  className="h-9 text-sm"
                  disabled={isByokBusy}
                />
                <p
                  className={cn(
                    "text-[11px]",
                    usePersonalApiKey ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {usePersonalApiKey
                    ? "When enabled, lounge uploads use your personal key only."
                    : "When disabled, lounge uploads use the global server key."}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                <Button
                  variant="outline"
                  onClick={clearSavedByokKey}
                  disabled={isByokBusy || !currentByokSettings?.hasPersonalApiKey}
                >
                  Clear Saved Key
                </Button>
                <Button onClick={saveByokSettings} disabled={isByokBusy}>
                  Save BYOK Settings
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xs flex items-center gap-2">
                <KeyRound className="h-3.5 w-3.5" />
                AI Assistant (BYOK)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                SKOLA assistant now runs in BYOK-only mode with Gemini 2.5. Add your personal
                Gemini API key from Google AI Studio to enable answers.
              </p>

              <div className="border border-border p-3 space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Setup walkthrough
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Watch this short guide to generate your Gemini API key.
                </p>
                <a
                  href="https://aistudio.google.com"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex text-[11px] underline text-primary hover:text-primary/80"
                >
                  aistudio.google.com
                </a>
                <video
                  src={geminiApiGuideVideoSrc}
                  controls
                  preload="metadata"
                  playsInline
                  className="w-full rounded-sm border border-border bg-black/90"
                >
                  Your browser does not support embedded video.
                </video>
                <a
                  href={geminiApiGuideVideoSrc}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex text-[11px] underline text-primary hover:text-primary/80"
                >
                  Open video in new tab
                </a>
              </div>

              <div className="border border-border p-3 space-y-1.5">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Assistant runtime
                </p>
                <p className="text-xs">
                  Provider: <span className="font-semibold">{currentAssistantByokSettings?.provider || "gemini"}</span>
                </p>
                <p className="text-xs">
                  Model: <span className="font-semibold">{currentAssistantByokSettings?.model || "gemini-2.5-flash-lite"}</span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {currentAssistantByokSettings?.hasPersonalApiKey
                    ? `Saved key: ${currentAssistantByokSettings.keyHint || "hidden"}`
                    : "No Gemini key saved yet"}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Gemini API Key</Label>
                <Input
                  type="password"
                  value={assistantApiKey}
                  onChange={(event) => setAssistantApiKey(event.target.value)}
                  placeholder={
                    currentAssistantByokSettings?.hasPersonalApiKey
                      ? "Leave empty to keep saved key"
                      : "Paste Gemini API key (usually starts with AIza...)"
                  }
                  className="h-9 text-sm"
                  disabled={isByokBusy}
                />
                <p className="text-[11px] text-muted-foreground">
                  Your key is encrypted at rest. Server-side assistant keys are not used anymore.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                <Button
                  variant="outline"
                  onClick={clearSavedAssistantByokKey}
                  disabled={isByokBusy || !currentAssistantByokSettings?.hasPersonalApiKey}
                >
                  Clear Saved Key
                </Button>
                <Button onClick={saveAssistantByokSettings} disabled={isByokBusy}>
                  Save Assistant BYOK
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-xs flex items-center gap-2">
                  <AppWindow className="h-3.5 w-3.5" />
                  In-App Inbox ({unreadCount} unread)
                </CardTitle>
                <button
                  type="button"
                  onClick={() => setNotificationTriggersOpen(true)}
                  className="h-6 w-6 inline-flex items-center justify-center rounded-sm border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  aria-label="What triggers notifications?"
                  title="What triggers notifications?"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => markAllNotificationsReadMutation.mutate()}
                  disabled={markAllNotificationsReadMutation.isPending || unreadCount === 0}
                >
                  Mark All Read
                </Button>
              </div>

              <NotificationFeed
                notifications={notificationItems}
                onRead={(id) => markNotificationReadMutation.mutate(id)}
                isBusy={markNotificationReadMutation.isPending}
              />
            </CardContent>
          </Card>

          <Dialog open={notificationTriggersOpen} onOpenChange={setNotificationTriggersOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-sm uppercase tracking-wider">
                  Notification Triggers
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Notifications are currently sent for these actions:
                </DialogDescription>
              </DialogHeader>
              <ul className="list-disc pl-5 space-y-2 text-xs text-foreground">
                <li>Admin/owner publishes a new classroom announcement.</li>
                <li>Admin/owner triggers the Surprise Assessment alarm.</li>
                <li>A lounge post or reply mentions you (`@username` / `@userId`) or uses `@everyone`.</li>
                <li>Editing a lounge post can notify users that are newly mentioned.</li>
                <li>You do not get notifications for actions you trigger yourself.</li>
              </ul>
              <p className="text-[11px] text-muted-foreground">
                Editing or deleting announcements does not trigger a new notification.
              </p>
            </DialogContent>
          </Dialog>

          <Card>
            <CardHeader>
              <CardTitle className="text-xs">Notification Test</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-[11px] text-muted-foreground">
                Send a test event to your own account to verify inbox, browser push, and bot DM channels.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => runNotificationTest("announcement")}
                  disabled={Boolean(testBusyType)}
                >
                  {testBusyType === "announcement" ? "Sending..." : "Test Announcement"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => runNotificationTest("mention")}
                  disabled={Boolean(testBusyType)}
                >
                  {testBusyType === "mention" ? "Sending..." : "Test Mention"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xs flex items-center gap-2">
                <Bell className="h-3.5 w-3.5" />
                Delivery Channels
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 border border-border p-3">
                  <div className="space-y-0.5">
                    <Label className="text-xs flex items-center gap-1.5">
                      <AppWindow className="h-3.5 w-3.5" />
                      In-App Notifications
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Store notifications in your app inbox.
                    </p>
                  </div>
                  <Switch
                    checked={notificationSettings.inAppAnnouncements}
                    onCheckedChange={(checked) =>
                      setNotificationSettings((prev) => ({
                        ...prev,
                        inAppAnnouncements: checked,
                      }))
                    }
                    disabled={isNotificationsBusy}
                  />
                </div>

                <div className="flex items-center justify-between gap-3 border border-border p-3">
                  <div className="space-y-0.5">
                    <Label className="text-xs flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5" />
                      Browser Push Notifications
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Send push alerts to subscribed browsers.
                    </p>
                  </div>
                  <Switch
                    checked={notificationSettings.browserPushAnnouncements}
                    onCheckedChange={(checked) =>
                      setNotificationSettings((prev) => ({
                        ...prev,
                        browserPushAnnouncements: checked,
                      }))
                    }
                    disabled={isNotificationsBusy}
                  />
                </div>

                <div className="flex items-center justify-between gap-3 border border-border p-3">
                  <div className="space-y-0.5">
                    <Label className="text-xs flex items-center gap-1.5">
                      <Send className="h-3.5 w-3.5" />
                      Bot Private Message
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Send direct bot messages on Telegram.
                    </p>
                  </div>
                  <Switch
                    checked={notificationSettings.botDmAnnouncements}
                    onCheckedChange={(checked) =>
                      setNotificationSettings((prev) => ({
                        ...prev,
                        botDmAnnouncements: checked,
                      }))
                    }
                    disabled={isNotificationsBusy}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={saveNotificationPreferences} disabled={isNotificationsBusy}>
                  Save Preferences
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xs flex items-center gap-2">
                <Globe className="h-3.5 w-3.5" />
                Browser Push Device
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="border border-border p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Server VAPID
                  </p>
                  <p className={cn("text-xs font-bold mt-1", serverPushConfigured ? "text-foreground" : "text-destructive")}>
                    {serverPushConfigured ? "Configured" : "Missing"}
                  </p>
                </div>
                <div className="border border-border p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Browser Permission
                  </p>
                  <p className={cn("text-xs font-bold mt-1", browserPermission === "granted" ? "text-foreground" : "text-amber-600")}>
                    {browserPermission}
                  </p>
                </div>
                <div className="border border-border p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    This Browser
                  </p>
                  <p className={cn("text-xs font-bold mt-1", devicePushSubscribed ? "text-foreground" : "text-muted-foreground")}>
                    {devicePushSubscribed ? "Subscribed" : "Not subscribed"}
                  </p>
                </div>
              </div>

              {!browserPushSupported && (
                <p className="text-xs text-destructive">
                  This browser does not support the Notification/Push APIs.
                </p>
              )}

              <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                <Button
                  variant="outline"
                  onClick={refreshDevicePushState}
                  disabled={pushBusy}
                >
                  Refresh Status
                </Button>
                {devicePushSubscribed ? (
                  <Button
                    variant="outline"
                    onClick={disableBrowserPush}
                    disabled={pushBusy}
                  >
                    Disconnect Browser
                  </Button>
                ) : (
                  <Button
                    onClick={enableBrowserPush}
                    disabled={pushBusy || !browserPushSupported || !serverPushConfigured}
                  >
                    Connect Browser
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

        </TabsContent>

        <TabsContent value="account" className="space-y-6">
          <Card className="border-destructive/20 bg-card">
            <CardHeader>
              <CardTitle className="text-xs text-destructive flex items-center gap-2">
                <Trash2 className="h-3.5 w-3.5" />
                Leave Classroom
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Permanently leave {activeClassroomName}. This only removes your membership in the
                current classroom. Your account and memberships in other classrooms stay active.
              </p>

              <div className="border border-destructive/20 bg-card p-3 space-y-1.5">
                <p className="text-[10px] uppercase tracking-widest font-bold text-destructive">
                  This action is irreversible
                </p>
                <p className="text-[11px] text-muted-foreground">
                  You will lose access to this classroom immediately. If you are the owner, you must
                  first hand ownership to an admin.
                </p>
              </div>

              <div className="flex justify-end">
                <Button
                  variant="destructive"
                  onClick={() => setDeleteAccountDialogOpen(true)}
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Leave Classroom
                </Button>
              </div>
            </CardContent>
          </Card>

          <Dialog open={deleteAccountDialogOpen} onOpenChange={setDeleteAccountDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-sm uppercase tracking-wider">
                  Confirm Leaving Classroom
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Type <span className="font-bold text-foreground">{DELETE_ACCOUNT_CONFIRMATION_TEXT}</span> to enable the delete button.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="border border-destructive/20 bg-destructive/5 p-3 space-y-1.5">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-destructive">
                    What happens next
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    You will be removed from this classroom only. Your account can still join other
                    classrooms or create a new one.
                  </p>
                </div>

                {accountDeletionContextQuery.isLoading ? (
                  <p className="text-xs text-muted-foreground">Loading deletion requirements...</p>
                ) : accountDeletionContextQuery.isError ? (
                  <p className="text-xs text-destructive">
                    Could not load account deletion requirements. Close this dialog and try again.
                  </p>
                ) : requiresSuccessor ? (
                  <div className="space-y-3">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                      Owner successor required
                    </p>
                    <div className="space-y-1.5 border border-border p-3 bg-card">
                      <Label className="text-xs">{deletionContext?.classroomName || activeClassroomName}</Label>
                      {adminCandidates.length === 0 ? (
                        <p className="text-[11px] text-destructive">
                          Promote an admin in this classroom before leaving.
                        </p>
                      ) : (
                        <Select value={successorMemberId} onValueChange={setSuccessorMemberId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an admin successor" />
                          </SelectTrigger>
                          <SelectContent>
                            {adminCandidates.map((candidate) => (
                              <SelectItem key={candidate.memberId} value={candidate.memberId}>
                                {candidate.name}
                                {candidate.telegramUsername
                                  ? ` (@${candidate.telegramUsername.replace(/^@+/, "")})`
                                  : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No successor selection is required for this classroom.
                  </p>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs">Confirmation</Label>
                  <Input
                    value={deleteAccountConfirmation}
                    onChange={(event) => setDeleteAccountConfirmation(event.target.value)}
                    placeholder={DELETE_ACCOUNT_CONFIRMATION_TEXT}
                    autoComplete="off"
                    autoCapitalize="characters"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setDeleteAccountDialogOpen(false)}
                    disabled={deleteAccountMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={submitDeleteAccount}
                    disabled={!canConfirmDelete}
                  >
                    {deleteAccountMutation.isPending ? "Leaving..." : "Leave Classroom"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
