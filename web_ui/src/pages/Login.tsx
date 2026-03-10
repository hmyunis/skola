import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useThemeStore } from "@/stores/themeStore";
import { useAuthStore } from "@/stores/authStore";
import { useClassroomStore } from "@/stores/classroomStore";
import { apiFetch } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Sun,
  Moon,
  Link2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

type AuthView = "login" | "signup" | "verifying" | "denied" | "success";
type InviteStatus = "idle" | "checking" | "valid" | "invalid";

const TELEGRAM_BOT_NAME = import.meta.env.VITE_TELEGRAM_BOT_NAME;

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const { activeClassroom, setActiveClassroom } = useClassroomStore();
  const { colorMode, toggleColorMode, syncThemeWithStores } = useThemeStore();
  const [view, setView] = useState<AuthView>("login");
  const [inviteCode, setInviteCode] = useState("");
  const [inviteStatus, setInviteStatus] = useState<InviteStatus>("idle");
  const [inviteError, setInviteError] = useState("");
  const [deniedReason, setDeniedReason] = useState<
    "unregistered" | "banned" | "suspended" | "not_in_group" | "invalid_invite"
  >("unregistered");
  const [suspendedUntil, setSuspendedUntil] = useState("");

  const handleTelegramAuth = async (telegramUser: TelegramUser) => {
    setView("verifying");

    try {
      const data = await apiFetch("/auth/telegram", {
        method: "POST",
        body: JSON.stringify(telegramUser),
      });

      // If we are in signup view, we need to join the classroom after login
      if (view === "signup" && inviteStatus === "valid" && inviteCode) {
        try {
          const joinResult = await apiFetch("/classrooms/join", {
            method: "POST",
            body: JSON.stringify({ inviteCode }),
            headers: { Authorization: `Bearer ${data.accessToken}` }
          });
          if (joinResult) {
            setActiveClassroom(joinResult);
            syncThemeWithStores();
          }
        } catch (joinErr: any) {
          console.error("Failed to join classroom:", joinErr);
          toast({ title: "Joined with issues", description: "You are logged in, but we couldn't automatically add you to the classroom.", variant: "destructive" });
        }
      }

      login(data.user, data.accessToken);
      syncThemeWithStores();
      setView("success");

      // Check if user has classrooms
      setTimeout(async () => {
        try {
                    const { classrooms, user: fullUser } = await apiFetch("/classrooms/my", {
            headers: { Authorization: `Bearer ${data.accessToken}` }
          });

          if (fullUser) {
            login(fullUser, data.accessToken);
          }
          
          if (classrooms && classrooms.length > 0) {
            // Always set the first classroom as active and sync theme
            setActiveClassroom(classrooms[0]);
            syncThemeWithStores();
            navigate("/dashboard");
          } else {
            // New user with no class, go to onboarding
            navigate("/get-started");
          }
        } catch (err) {
          console.error("Failed to fetch user classrooms:", err);
          navigate("/dashboard"); // Fallback
        }
      }, 1200);
    } catch (err: any) {
      console.error("Telegram auth error:", err);
      
      const errorData = err.data || {};
      if (errorData.reason === "not_in_group") { setView("denied"); setDeniedReason("not_in_group"); return; }
      if (errorData.reason === "banned") { setView("denied"); setDeniedReason("banned"); return; }
      if (errorData.reason === "suspended") {
        setView("denied"); setDeniedReason("suspended");
        setSuspendedUntil(errorData.suspendedUntil ? new Date(errorData.suspendedUntil).toLocaleString() : "");
        return;
      }
      
      toast({ title: "Authentication Failed", description: err.message || "Could not reach the server. Please try again.", variant: "destructive" });
      setView("login");
    }
  };

  const validateInviteCode = async () => {
    const code = inviteCode.trim().toUpperCase();
    if (!code) {
      setInviteStatus("invalid");
      setInviteError("Please enter an invite code.");
      return;
    }
    setInviteStatus("checking");
    
    try {
      const result = await apiFetch(`/admin/invites/validate/${code}`);
      if (result.valid) {
        setInviteStatus("valid");
        setInviteError("");
      } else {
        setInviteStatus("invalid");
        setInviteError("Invalid, expired, or fully used code.");
      }
    } catch (err: any) {
      setInviteStatus("invalid");
      setInviteError(err.message || "Invalid code.");
    }
  };

  const resetToLogin = () => { setView("login"); };

  // ─── ACCESS DENIED ───
  if (view === "denied") {
    const deniedMessages = {
      banned: { title: "Account Banned", message: "Your account has been permanently banned. Contact your administrator if you believe this is an error." },
      suspended: { title: "Account Suspended", message: `Your account is temporarily suspended until ${suspendedUntil}. Please try again after the suspension period ends.` },
      not_in_group: { title: "Not a Group Member", message: "You must be a member of the class Telegram group to access this platform." },
      unregistered: { title: "Authentication Failed", message: "Your Telegram account is not linked to any registered student profile." },
      invalid_invite: { title: "Invalid Invite Code", message: "The invite code is invalid, expired, or has reached its usage limit." },
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
              <h1 className="text-3xl md:text-4xl font-black uppercase tracking-[0.3em] text-destructive">ACCESS DENIED</h1>
              <div className="h-0.5 bg-destructive/50 mx-auto w-48" />
            </div>
          </div>
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm font-bold text-destructive uppercase tracking-wider">{msg.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{msg.message}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <Button variant="outline" onClick={resetToLogin} className="w-full">
                  <ArrowRight className="h-3 w-3 rotate-180" /> Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
          <p className="text-center text-[10px] text-muted-foreground/50 uppercase tracking-widest">
            Error 403 · Unauthorized · {new Date().toISOString().split("T")[0]}
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
            <p className="text-sm font-bold uppercase tracking-wider">Verifying...</p>
            <p className="text-xs text-muted-foreground">Checking group membership & authenticating</p>
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
            <p className="text-sm font-bold uppercase tracking-wider text-emerald-600">Access Granted</p>
            <p className="text-xs text-muted-foreground">Redirecting to dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── SIGNUP (new account with invite code) ───
  if (view === "signup") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
        <button onClick={toggleColorMode} className="absolute top-4 right-4 p-2 border border-border bg-card hover:bg-accent transition-colors" aria-label="Toggle color mode">
          {colorMode === "light" ? <Moon className="h-4 w-4 text-foreground" /> : <Sun className="h-4 w-4 text-foreground" />}
        </button>
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-3">
            <div className="h-14 w-14 bg-primary/10 border-2 border-primary/30 flex items-center justify-center mx-auto">
              <Link2 className="h-7 w-7 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground">New Account</p>
              <h1 className="text-2xl font-black uppercase tracking-wider">Join a Class</h1>
            </div>
            <p className="text-xs text-muted-foreground">Enter your invite code and sign up with Telegram</p>
          </div>

          {/* Invite code input */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-widest font-bold">Invite Code</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. A1B2C3"
                    value={inviteCode}
                    onChange={(e) => {
                      setInviteCode(e.target.value.toUpperCase());
                      if (inviteStatus !== "idle") {
                        setInviteStatus("idle");
                        setInviteError("");
                      }
                    }}
                    className="text-center text-lg font-mono tracking-[0.3em] uppercase flex-1"
                    maxLength={10}
                  />
                  <Button
                    onClick={validateInviteCode}
                    disabled={inviteStatus === "checking" || !inviteCode.trim()}
                    variant={inviteStatus === "valid" ? "default" : "outline"}
                    className="shrink-0 text-xs font-bold uppercase tracking-wider"
                  >
                    {inviteStatus === "checking" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : inviteStatus === "valid" ? (
                      <><CheckCircle2 className="h-4 w-4" /> Valid</>
                    ) : (
                      "Verify"
                    )}
                  </Button>
                </div>
                {inviteStatus === "valid" && (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 text-center font-bold uppercase tracking-wider flex items-center justify-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Code verified — proceed to sign up below
                  </p>
                )}
                {inviteStatus === "invalid" && (
                  <p className="text-[10px] text-destructive text-center font-bold uppercase tracking-wider flex items-center justify-center gap-1">
                    <XCircle className="h-3 w-3" /> {inviteError}
                  </p>
                )}
                {inviteStatus === "idle" && (
                  <p className="text-[10px] text-muted-foreground text-center">
                    Ask your class owner for the invite code
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Telegram Login */}
          <AnimatePresence mode="wait">
            {inviteStatus === "valid" ? (
              <motion.div
                key="unlocked"
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", damping: 20, stiffness: 300 }}
              >
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="p-5 space-y-3">
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="text-[10px] uppercase tracking-widest text-primary font-bold text-center flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="h-3 w-3" /> Unlocked — Sign up with Telegram
                    </motion.p>
                    <TelegramLoginWidget botName={TELEGRAM_BOT_NAME} onAuth={handleTelegramAuth} />
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div key="locked" initial={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }}>
                <Card className="opacity-40 pointer-events-none select-none">
                  <CardContent className="p-5 space-y-3">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold text-center flex items-center justify-center gap-1.5">
                      <Lock className="h-3 w-3" /> Verify invite code to unlock
                    </p>
                    <TelegramLoginWidget botName={TELEGRAM_BOT_NAME} onAuth={handleTelegramAuth} />
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="text-center space-y-2">
            <button onClick={() => setView("login")} className="text-[10px] text-primary uppercase tracking-widest hover:underline">
              Already have an account? Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── LOGIN form (returning users) ───
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      <button onClick={toggleColorMode} className="absolute top-4 right-4 p-2 border border-border bg-card hover:bg-accent transition-colors" aria-label="Toggle color mode">
        {colorMode === "light" ? <Moon className="h-4 w-4 text-foreground" /> : <Sun className="h-4 w-4 text-foreground" />}
      </button>
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-3">
          <div className="h-14 w-14 bg-primary/10 border-2 border-primary/30 flex items-center justify-center mx-auto">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground">Welcome Back</p>
            <h1 className="text-2xl font-black uppercase tracking-wider">SKOLA</h1>
          </div>
        </div>

        {/* Telegram Login Widget */}
        <Card>
          <CardContent className="p-5">
            <TelegramLoginWidget botName={TELEGRAM_BOT_NAME} onAuth={handleTelegramAuth} />
          </CardContent>
        </Card>

        {/* Sign up link */}
        <div className="text-center space-y-2">
          <button onClick={() => setView("signup")} className="text-[10px] text-primary uppercase tracking-widest hover:underline">
            New student? Sign Up with Invite Code
          </button>
          <p className="text-[10px] text-muted-foreground/30">SKOLA v1.0 · {new Date().getFullYear()}</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
