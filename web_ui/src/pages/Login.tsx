import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useThemeStore } from "@/stores/themeStore";
import { useAuthStore } from "@/stores/authStore";
import { useClassroomStore } from "@/stores/classroomStore";
import { apiFetch } from "@/services/api";
import type { ClassroomMembershipContext, ClassroomRole } from "@/types/classroom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  TelegramLoginWidget,
  type TelegramUser,
} from "@/components/TelegramLoginWidget";
import {
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
  Building2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

type AuthView = "login" | "signup" | "verifying" | "denied" | "choose_classroom";
type InviteStatus = "idle" | "checking" | "valid" | "invalid";

const TELEGRAM_BOT_NAME = import.meta.env.VITE_TELEGRAM_BOT_NAME;

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

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const {
    setMemberships,
    setActiveClassroom,
    clearActiveClassroom,
    rememberedClassroomId,
  } = useClassroomStore();
  const { colorMode, toggleColorMode, syncThemeWithStores } = useThemeStore();
  const [view, setView] = useState<AuthView>("login");
  const [inviteCode, setInviteCode] = useState("");
  const [signupTelegramGroupId, setSignupTelegramGroupId] = useState("");
  const [inviteStatus, setInviteStatus] = useState<InviteStatus>("idle");
  const [inviteError, setInviteError] = useState("");
  const [classroomChoices, setClassroomChoices] = useState<ClassroomMembershipContext[]>([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState("");
  const [deniedReason, setDeniedReason] = useState<
    "unregistered" | "banned" | "suspended" | "not_in_group" | "invalid_invite"
  >("unregistered");
  const [suspendedUntil, setSuspendedUntil] = useState("");

  const selectedMembership = useMemo(
    () => classroomChoices.find((membership) => membership.classroom.id === selectedClassroomId) || null,
    [classroomChoices, selectedClassroomId],
  );

  const isValidGroupId = (id: string) => /^-?\d+$/.test(id.trim());

  const applySingleClassroomAndProceed = (membership: ClassroomMembershipContext) => {
    setActiveClassroom(membership.classroom, membership.role);
    syncThemeWithStores();
    navigate("/dashboard");
  };

  const handleClassroomConfirmation = () => {
    if (!selectedMembership) {
      toast({
        title: "Choose a classroom",
        description: "Pick the classroom you want to enter first.",
        variant: "destructive",
      });
      return;
    }

    applySingleClassroomAndProceed(selectedMembership);
  };

  const handleTelegramAuth = async (telegramUser: TelegramUser) => {
    if (view === "signup") {
      if (!signupTelegramGroupId.trim()) {
        toast({
          title: "Missing Group ID",
          description: "Telegram group ID is required for signup.",
          variant: "destructive",
        });
        return;
      }
      if (!isValidGroupId(signupTelegramGroupId)) {
        toast({
          title: "Invalid Group ID",
          description: "Telegram group IDs are numeric (e.g. -100123456789).",
          variant: "destructive",
        });
        return;
      }
    }

    setView("verifying");

    try {
      const data = await apiFetch("/auth/telegram", {
        method: "POST",
        body: JSON.stringify(telegramUser),
      });

      // If we are in signup view, we join the classroom after login.
      if (view === "signup" && inviteStatus === "valid" && inviteCode) {
        try {
          const joinResult = await apiFetch("/classrooms/join", {
            method: "POST",
            body: JSON.stringify({
              inviteCode,
              telegramGroupId: signupTelegramGroupId.trim(),
            }),
            headers: { Authorization: `Bearer ${data.accessToken}` },
          });
          if (joinResult?.classroom) {
            setActiveClassroom(
              joinResult.classroom,
              (joinResult.member?.role as ClassroomRole | undefined) || "student",
            );
          }
        } catch (joinErr: unknown) {
          console.error("Failed to join classroom:", joinErr);
          toast({
            title: "Joined with issues",
            description: "You are logged in, but we couldn't automatically add you to the classroom.",
            variant: "destructive",
          });
        }
      }

      login(data.user, data.accessToken);

      let classroomContext: ClassroomContextApiResponse = {};
      try {
        classroomContext = await apiFetch("/classrooms/my", {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        });
      } catch (contextErr) {
        console.error("Failed to fetch user classrooms:", contextErr);
        classroomContext = {
          user: data.user,
          memberships: [],
          classrooms: [],
        };
      }

      const fullUser = classroomContext?.user || data.user;
      login(fullUser, data.accessToken);

      const fallbackRole: ClassroomRole = "student";
      const memberships = normalizeMemberships(classroomContext, fallbackRole);
      setMemberships(memberships);

      if (memberships.length === 0) {
        clearActiveClassroom();
        syncThemeWithStores();
        navigate("/get-started");
        return;
      }

      if (memberships.length === 1) {
        applySingleClassroomAndProceed(memberships[0]);
        return;
      }

      const preferred =
        memberships.find((membership) => membership.classroom.id === rememberedClassroomId) ||
        memberships[0];
      setClassroomChoices(memberships);
      setSelectedClassroomId(preferred.classroom.id);
      setView("choose_classroom");
    } catch (err: unknown) {
      console.error("Telegram auth error:", err);

      const errorData = (err as { data?: Record<string, unknown> })?.data || {};
      if (errorData.reason === "not_in_group") {
        setView("denied");
        setDeniedReason("not_in_group");
        return;
      }
      if (errorData.reason === "banned") {
        setView("denied");
        setDeniedReason("banned");
        return;
      }
      if (errorData.reason === "suspended") {
        setView("denied");
        setDeniedReason("suspended");
        setSuspendedUntil(errorData.suspendedUntil ? new Date(errorData.suspendedUntil).toLocaleString() : "");
        return;
      }
      toast({
        title: "Authentication Failed",
        description: err instanceof Error ? err.message : "Could not reach the server. Please try again.",
        variant: "destructive",
      });
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
    } catch (err: unknown) {
      setInviteStatus("invalid");
      setInviteError(err instanceof Error ? err.message : "Invalid code.");
    }
  };

  const resetToLogin = () => {
    setView("login");
  };

  if (view === "denied") {
    const deniedMessages = {
      banned: {
        title: "Account Banned",
        message:
          "Your account has been permanently banned. Contact your administrator if you believe this is an error.",
      },
      suspended: {
        title: "Account Suspended",
        message: `Your account is temporarily suspended until ${suspendedUntil}. Please try again after the suspension period ends.`,
      },
      not_in_group: {
        title: "Not a Group Member",
        message: "You must be a member of the class Telegram group to access this platform.",
      },
      unregistered: {
        title: "Authentication Failed",
        message: "Your Telegram account is not linked to any registered student profile.",
      },
      invalid_invite: {
        title: "Invalid Invite Code",
        message: "The invite code is invalid, expired, or has reached its usage limit.",
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

  if (view === "choose_classroom") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
        <button
          onClick={toggleColorMode}
          className="absolute top-4 right-4 p-2 border border-border bg-card hover:bg-accent transition-colors"
          aria-label="Toggle color mode"
        >
          {colorMode === "light" ? (
            <Moon className="h-4 w-4 text-foreground" />
          ) : (
            <Sun className="h-4 w-4 text-foreground" />
          )}
        </button>

        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-3">
            <div className="h-14 w-14 bg-primary/10 border-2 border-primary/30 flex items-center justify-center mx-auto">
              <Building2 className="h-7 w-7 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground">Choose Context</p>
              <h1 className="text-2xl font-black uppercase tracking-wider">Select Classroom</h1>
            </div>
            <p className="text-xs text-muted-foreground">
              You belong to multiple classrooms. Choose where to continue.
            </p>
          </div>

          <Card>
            <CardContent className="p-5 space-y-3">
              {classroomChoices.map((membership) => {
                const isSelected = membership.classroom.id === selectedClassroomId;
                return (
                  <button
                    key={membership.classroom.id}
                    onClick={() => setSelectedClassroomId(membership.classroom.id)}
                    className={`w-full text-left border px-3 py-3 transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:bg-accent/60"
                    }`}
                  >
                    <p className="text-sm font-bold truncate">{membership.classroom.name}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                      Role: {membership.role}
                    </p>
                  </button>
                );
              })}

              <Button
                onClick={handleClassroomConfirmation}
                className="w-full mt-2 text-xs font-bold uppercase tracking-wider"
                disabled={!selectedMembership}
              >
                Continue
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (view === "signup") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
        <button
          onClick={toggleColorMode}
          className="absolute top-4 right-4 p-2 border border-border bg-card hover:bg-accent transition-colors"
          aria-label="Toggle color mode"
        >
          {colorMode === "light" ? (
            <Moon className="h-4 w-4 text-foreground" />
          ) : (
            <Sun className="h-4 w-4 text-foreground" />
          )}
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

          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-widest font-bold">Telegram Group ID</Label>
                <Input
                  placeholder="e.g. -100123456789"
                  value={signupTelegramGroupId}
                  onChange={(e) => setSignupTelegramGroupId(e.target.value)}
                  className="text-center text-sm font-mono"
                />
                <p className="text-[10px] text-muted-foreground text-center">
                  Required for signup. Owners can edit this later in Settings.
                </p>
              </div>
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
                      <>
                        <CheckCircle2 className="h-4 w-4" /> Valid
                      </>
                    ) : (
                      "Verify"
                    )}
                  </Button>
                </div>
                {inviteStatus === "valid" && (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 text-center font-bold uppercase tracking-wider flex items-center justify-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Code verified - proceed to sign up below
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

          <AnimatePresence mode="wait">
            {inviteStatus === "valid" && isValidGroupId(signupTelegramGroupId) ? (
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
                      <CheckCircle2 className="h-3 w-3" /> Unlocked - Sign up with Telegram
                    </motion.p>
                    <TelegramLoginWidget botName={TELEGRAM_BOT_NAME} onAuth={handleTelegramAuth} />
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key="locked"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="opacity-40 pointer-events-none select-none">
                  <CardContent className="p-5 space-y-3">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold text-center flex items-center justify-center gap-1.5">
                      <Lock className="h-3 w-3" /> Verify invite code + group ID to unlock
                    </p>
                    <TelegramLoginWidget botName={TELEGRAM_BOT_NAME} onAuth={handleTelegramAuth} />
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="text-center space-y-2">
            <button
              onClick={() => setView("login")}
              className="text-[10px] text-primary uppercase tracking-widest hover:underline"
            >
              Already have an account? Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      <button
        onClick={toggleColorMode}
        className="absolute top-4 right-4 p-2 border border-border bg-card hover:bg-accent transition-colors"
        aria-label="Toggle color mode"
      >
        {colorMode === "light" ? (
          <Moon className="h-4 w-4 text-foreground" />
        ) : (
          <Sun className="h-4 w-4 text-foreground" />
        )}
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

        <Card>
          <CardContent className="p-5">
            <TelegramLoginWidget botName={TELEGRAM_BOT_NAME} onAuth={handleTelegramAuth} />
          </CardContent>
        </Card>

        <div className="text-center space-y-2">
          <button
            onClick={() => navigate("/get-started")}
            className="text-[10px] text-primary uppercase tracking-widest hover:underline"
          >
            New student? Sign Up with Invite Code
          </button>
          <div>
            <Link to="/" className="text-[10px] text-muted-foreground uppercase tracking-widest hover:underline">
              Back to Home
            </Link>
          </div>
          <p className="text-[10px] text-muted-foreground/30">
            SKOLA v1.0 · {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
