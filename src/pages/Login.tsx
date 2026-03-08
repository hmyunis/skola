import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useThemeStore } from "@/stores/themeStore";
import { useAuth, MOCK_ACCOUNTS } from "@/stores/authStore";
import { getUserStatus } from "@/services/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  TelegramLoginWidget,
  type TelegramUser,
} from "@/components/TelegramLoginWidget";
import {
  Shield,
  Lock,
  AlertTriangle,
  ArrowRight,
  Loader2,
  XOctagon,
  Crown,
  User,
  Sun,
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type AuthView = "login" | "verifying" | "denied" | "success";

const roleIcon = {
  owner: Crown,
  admin: Shield,
  student: User,
};

const roleColor = {
  owner: "border-amber-500/40 bg-amber-500/5 text-amber-600",
  admin: "border-primary/40 bg-primary/5 text-primary",
  student: "border-border bg-muted/50 text-muted-foreground",
};

// TODO: Replace with your actual bot name
const TELEGRAM_BOT_NAME = "YourSkolaBot";

// TODO: Replace with your actual backend API URL
const API_BASE_URL = "/api";

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { colorMode, toggleColorMode } = useThemeStore();
  const [view, setView] = useState<AuthView>("login");
  const [error, setError] = useState("");
  const [deniedReason, setDeniedReason] = useState<
    "unregistered" | "banned" | "suspended" | "not_in_group"
  >("unregistered");
  const [suspendedUntil, setSuspendedUntil] = useState("");

  const handleTelegramAuth = async (telegramUser: TelegramUser) => {
    setView("verifying");
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/auth/telegram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(telegramUser),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.reason === "not_in_group") {
          setView("denied");
          setDeniedReason("not_in_group");
          return;
        }
        if (data.reason === "banned") {
          setView("denied");
          setDeniedReason("banned");
          return;
        }
        if (data.reason === "suspended") {
          setView("denied");
          setDeniedReason("suspended");
          setSuspendedUntil(
            data.suspendedUntil
              ? new Date(data.suspendedUntil).toLocaleString()
              : ""
          );
          return;
        }
        setView("denied");
        setDeniedReason("unregistered");
        return;
      }

      // Successful login — data.user should match MockAccount shape
      login(data.user);
      setView("success");
      setTimeout(() => navigate("/dashboard"), 1200);
    } catch (err) {
      console.error("Telegram auth error:", err);
      toast({
        title: "Connection Error",
        description: "Could not reach the server. Please try again.",
        variant: "destructive",
      });
      setView("login");
    }
  };

  const tryLogin = (account: (typeof MOCK_ACCOUNTS)[0]) => {
    const saved = getUserStatus(account.id);
    if (saved?.status === "banned") {
      setView("denied");
      setDeniedReason("banned");
      return;
    }
    if (saved?.status === "suspended" && saved.suspendedUntil) {
      const until = new Date(saved.suspendedUntil);
      if (until > new Date()) {
        setView("denied");
        setDeniedReason("suspended");
        setSuspendedUntil(until.toLocaleString());
        return;
      }
    }
    login(account);
    setView("success");
    setTimeout(() => navigate("/dashboard"), 1200);
  };

  const handleQuickLogin = (accountIdx: number) => {
    tryLogin(MOCK_ACCOUNTS[accountIdx]);
  };

  const resetToLogin = () => {
    setView("login");
    setError("");
  };

  // ─── ACCESS DENIED ───
  if (view === "denied") {
    const deniedMessages = {
      banned: {
        title: "Account Banned",
        message:
          "Your account has been permanently banned. You cannot access the platform. Contact your administrator if you believe this is an error.",
      },
      suspended: {
        title: "Account Suspended",
        message: `Your account is temporarily suspended until ${suspendedUntil}. Please try again after the suspension period ends.`,
      },
      not_in_group: {
        title: "Not a Group Member",
        message:
          "You must be a member of the class Telegram group to access this platform. Join the group first, then try logging in again.",
      },
      unregistered: {
        title: "Authentication Failed",
        message:
          "Your Telegram account is not linked to any registered student profile. Contact your academic administrator for access.",
      },
    };

    const msg = deniedMessages[deniedReason];

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-4">
            <div className="relative inline-block">
              <XOctagon className="h-16 w-16 text-destructive mx-auto animate-pulse" />
              <div className="absolute inset-0 h-16 w-16 mx-auto border-2 border-destructive/30 animate-ping rounded-full" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl md:text-4xl font-black uppercase tracking-[0.3em] text-destructive">
                ACCESS DENIED
              </h1>
              <div className="h-0.5 bg-destructive/50 mx-auto w-48" />
            </div>
          </div>

          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm font-bold text-destructive uppercase tracking-wider">
                    {msg.title}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {msg.message}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={resetToLogin}
                  className="w-full"
                >
                  <ArrowRight className="h-3 w-3 rotate-180" />
                  Try Again
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-xs text-muted-foreground"
                  onClick={() =>
                    window.open(
                      "mailto:admin@university.edu?subject=Access%20Request%20-%20SKOLA",
                      "_blank"
                    )
                  }
                >
                  Contact Administrator
                </Button>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-[10px] text-muted-foreground/50 uppercase tracking-widest">
            Error 403 · Unauthorized ·{" "}
            {new Date().toISOString().split("T")[0]}
          </p>
        </div>
      </div>
    );
  }

  // ─── Verifying ───
  if (view === "verifying") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 text-primary mx-auto animate-spin" />
          <div className="space-y-1">
            <p className="text-sm font-bold uppercase tracking-wider">
              Verifying...
            </p>
            <p className="text-xs text-muted-foreground">
              Checking group membership & authenticating
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Success ───
  if (view === "success") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="h-14 w-14 bg-emerald-500/10 border-2 border-emerald-500/40 flex items-center justify-center mx-auto">
            <Shield className="h-7 w-7 text-emerald-500" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold uppercase tracking-wider text-emerald-600">
              Access Granted
            </p>
            <p className="text-xs text-muted-foreground">
              Redirecting to dashboard...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Login form ───
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      <button
        onClick={toggleColorMode}
        className="absolute top-4 right-4 p-2 border border-border bg-card hover:bg-accent transition-colors"
        aria-label="Toggle color mode"
      >
        {colorMode === "light" ? <Moon className="h-4 w-4 text-foreground" /> : <Sun className="h-4 w-4 text-foreground" />}
      </button>
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="h-14 w-14 bg-primary/10 border-2 border-primary/30 flex items-center justify-center mx-auto">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
              Student Portal
            </p>
            <h1 className="text-2xl font-black uppercase tracking-wider">
              SKOLA
            </h1>
          </div>
        </div>

        {/* Telegram Login Widget */}
        <Card>
          <CardContent className="p-5">
            <TelegramLoginWidget
              botName={TELEGRAM_BOT_NAME}
              onAuth={handleTelegramAuth}
            />
          </CardContent>
        </Card>

        {/* Quick Login — Dev accounts */}
        <Card className="border-dashed">
          <CardContent className="p-4 space-y-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold text-center">
              Quick Login (Demo)
            </p>
            <div className="space-y-2">
              {MOCK_ACCOUNTS.map((account, idx) => {
                const RoleIcon = roleIcon[account.role];
                return (
                  <button
                    key={account.id}
                    onClick={() => handleQuickLogin(idx)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 border transition-colors hover:opacity-80",
                      roleColor[account.role]
                    )}
                  >
                    <RoleIcon className="h-4 w-4 shrink-0" />
                    <div className="text-left flex-1 min-w-0">
                      <p className="text-xs font-bold">{account.name}</p>
                      <p className="text-[10px] opacity-70 uppercase tracking-wider">
                        {account.role} · Code: {account.code}
                      </p>
                    </div>
                    <ArrowRight className="h-3 w-3 shrink-0 opacity-50" />
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center space-y-1">
          <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest">
            Secure · Encrypted · Anonymous
          </p>
          <p className="text-[10px] text-muted-foreground/30">
            SKOLA v1.0 · {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
