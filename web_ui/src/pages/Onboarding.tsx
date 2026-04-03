import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useThemeStore } from "@/stores/themeStore";
import { useAuthStore } from "@/stores/authStore";
import { useClassroomStore } from "@/stores/classroomStore";
import { apiFetch } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TelegramLoginWidget, type TelegramUser } from "@/components/TelegramLoginWidget";
import {
  Lock, Sun, Moon, ArrowRight, CheckCircle2, Info, Plus, Users, ArrowLeft, Loader2
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Step = "choose" | "create" | "join";
const TELEGRAM_BOT_NAME = import.meta.env.VITE_TELEGRAM_BOT_NAME;

const Onboarding = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { colorMode, toggleColorMode, syncThemeWithStores } = useThemeStore();
  const { user, login, accessToken, logout } = useAuthStore();
  const { setActiveClassroom } = useClassroomStore();
  
  const [step, setStep] = useState<Step>("choose");
  const [telegramGroupId, setTelegramGroupId] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateGroupId = (id: string) => {
    return /^-?\d+$/.test(id);
  };

  const handleTelegramAuth = async (telegramUser: TelegramUser) => {
    setError(null);
    setAuthLoading(true);
    try {
      const data = await apiFetch("/auth/telegram", {
        method: "POST",
        body: JSON.stringify(telegramUser),
      });
      login(data.user, data.accessToken);
      syncThemeWithStores();
      toast({ title: "Signed in", description: "Telegram account verified." });
    } catch (err: any) {
      toast({ title: "Authentication Failed", description: err.message || "Could not sign in with Telegram.", variant: "destructive" });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleCreateClass = async () => {
    setError(null);
    if (!accessToken || !user) {
      setError("Please sign in with Telegram first.");
      return;
    }
    if (!telegramGroupId.trim()) {
      setError("Please enter a Telegram group ID.");
      return;
    }
    if (!validateGroupId(telegramGroupId.trim())) {
      setError("Invalid format. Telegram group IDs are numbers (e.g., -100123456789).");
      return;
    }

    setLoading(true);
    try {
      const result = await apiFetch("/classrooms/onboard", {
        method: "POST",
        body: JSON.stringify({ telegramGroupId: telegramGroupId.trim() }),
      });
      
      setSuccess(true);
      setActiveClassroom(result.classroom, result.member?.role || "owner");
      if (result.user && result.accessToken) {
        login(result.user, result.accessToken);
        syncThemeWithStores();
      }
      toast({ title: "Class Created!", description: "You are now the owner of this classroom." });
      setTimeout(() => navigate("/dashboard"), 2000);
    } catch (err: any) {
      setError(err.message || "Failed to create class.");
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleJoinClass = async () => {
    setError(null);
    if (!accessToken || !user) {
      setError("Please sign up with Telegram first.");
      return;
    }
    if (!inviteCode.trim()) {
      setError("Please enter an invite code.");
      return;
    }

    setLoading(true);
    try {
      const result = await apiFetch("/classrooms/join", {
        method: "POST",
        body: JSON.stringify({ inviteCode: inviteCode.trim().toUpperCase() }),
      });
      
      setSuccess(true);
      setActiveClassroom(result.classroom, result.member?.role || "student");
      if (result.user && result.accessToken) {
        login(result.user, result.accessToken);
        syncThemeWithStores();
      }
      toast({ title: "Joined!", description: `Welcome to the classroom.` });
      setTimeout(() => navigate("/dashboard"), 2000);
    } catch (err: any) {
      setError(err.message || "Invalid invite code.");
      toast({ title: "Join Failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Theme toggle */}
      <button
        onClick={toggleColorMode}
        className="absolute top-4 right-4 p-2 border border-border bg-card hover:bg-accent transition-colors z-10"
        aria-label="Toggle color mode"
      >
        {colorMode === "light" ? <Moon className="h-4 w-4 text-foreground" /> : <Sun className="h-4 w-4 text-foreground" />}
      </button>

      {/* Grid bg */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
      }} />

      <div className="w-full max-w-md relative z-10">
        <AnimatePresence mode="wait">
          {success ? (
            <motion.div
              key="success-state"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-6"
            >
              <div className="h-20 w-20 bg-green-500/10 border-2 border-green-500/30 flex items-center justify-center mx-auto rounded-full">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black uppercase tracking-wider">Verified!</h2>
                <p className="text-sm text-muted-foreground">Welcome to SKOLA. Redirecting...</p>
              </div>
              <div className="h-1 w-full bg-muted overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 2 }} className="h-full bg-green-500" />
              </div>
            </motion.div>
          ) : step === "choose" ? (
            <motion.div
              key="choose"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="text-center space-y-3">
                <div className="h-14 w-14 bg-primary/10 border-2 border-primary/30 flex items-center justify-center mx-auto">
                  <Lock className="h-7 w-7 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground">Welcome to SKOLA</p>
                  <h1 className="text-2xl font-black uppercase tracking-wider">Get Started</h1>
                </div>
                <p className="text-xs text-muted-foreground">Are you starting a new class or joining one?</p>
                {!user && (
                  <p className="text-[10px] text-muted-foreground">
                    New students sign up with Telegram during onboarding.
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => setStep("create")}
                  className="w-full group border border-border bg-card p-5 hover:border-primary/40 hover:bg-primary/5 transition-all flex items-center gap-4 text-left"
                >
                  <div className="h-12 w-12 border border-primary/30 bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <Plus className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black uppercase tracking-wider text-foreground">Create a Class</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Start as the owner of a new classroom</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </button>

                <button
                  onClick={() => setStep("join")}
                  className="w-full group border border-border bg-card p-5 hover:border-primary/40 hover:bg-primary/5 transition-all flex items-center gap-4 text-left"
                >
                  <div className="h-12 w-12 border border-primary/30 bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black uppercase tracking-wider text-foreground">Join a Class</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Enter an invite code to join as a student</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </button>
              </div>

              <div className="text-center">
                {user ? (
                  <button onClick={() => { queryClient.clear(); logout(); navigate("/login"); }} className="text-[10px] text-muted-foreground/50 uppercase tracking-widest hover:text-muted-foreground">
                    ← Sign out
                  </button>
                ) : (
                  <button onClick={() => navigate("/login")} className="text-[10px] text-muted-foreground/50 uppercase tracking-widest hover:text-muted-foreground">
                    ← Back to login
                  </button>
                )}
              </div>
            </motion.div>
          ) : step === "create" ? (
            <motion.div
              key="create"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="text-center space-y-3">
                <button onClick={() => setStep("choose")} className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-widest hover:text-foreground mx-auto mb-2">
                  <ArrowLeft className="h-3 w-3" /> Back
                </button>
                <h1 className="text-xl font-black uppercase tracking-wider">Create Classroom</h1>
                <p className="text-xs text-muted-foreground">Enter your class Telegram Group ID</p>
              </div>

              <Card>
                <CardContent className="p-5 space-y-4">
                  {!user && (
                    <Card className="border-primary/20 bg-primary/5">
                      <CardContent className="p-4 space-y-2">
                        <p className="text-[10px] uppercase tracking-widest text-primary font-bold text-center">
                          Sign in with Telegram first
                        </p>
                        {authLoading ? (
                          <div className="flex justify-center py-2">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          </div>
                        ) : (
                          <TelegramLoginWidget botName={TELEGRAM_BOT_NAME} onAuth={handleTelegramAuth} />
                        )}
                      </CardContent>
                    </Card>
                  )}

                  <Alert className="bg-primary/5 border-primary/20 py-3">
                    <AlertDescription className="text-[11px] flex items-center gap-2">
                      <Info className="h-4 w-4 text-primary" />
                      Message <a className="underline text-primary" href="https://t.me/EskoIDBot" target="_blank" rel="noopener noreferrer">@EskoIDBot</a> and type /start to get your group ID.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase tracking-widest font-black">Telegram Group ID</Label>
                    <Input
                      placeholder="e.g. -100123456789"
                      value={telegramGroupId}
                      onChange={(e) => { setTelegramGroupId(e.target.value); setError(null); }}
                      className="font-mono text-sm"
                      disabled={loading}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Required to create a class. You can edit it later in Owner Settings.
                    </p>
                  </div>

                  {error && <p className="text-[10px] text-destructive font-bold">{error}</p>}

                  <Button onClick={handleCreateClass} className="w-full text-xs font-black uppercase tracking-widest" disabled={loading || authLoading || !telegramGroupId || !user}>
                    {loading ? "Creating..." : "Create & Start"}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="join"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="text-center space-y-3">
                <button onClick={() => setStep("choose")} className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-widest hover:text-foreground mx-auto mb-2">
                  <ArrowLeft className="h-3 w-3" /> Back
                </button>
                <h1 className="text-xl font-black uppercase tracking-wider">Join Classroom</h1>
                <p className="text-xs text-muted-foreground">Enter the invite code shared by your owner</p>
              </div>

              <Card>
                <CardContent className="p-5 space-y-4">
                  {!user && (
                    <Card className="border-primary/20 bg-primary/5">
                      <CardContent className="p-4 space-y-2">
                        <p className="text-[10px] uppercase tracking-widest text-primary font-bold text-center">
                          Sign up with Telegram
                        </p>
                        {authLoading ? (
                          <div className="flex justify-center py-2">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          </div>
                        ) : (
                          <TelegramLoginWidget botName={TELEGRAM_BOT_NAME} onAuth={handleTelegramAuth} />
                        )}
                      </CardContent>
                    </Card>
                  )}

                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase tracking-widest font-black">Invite Code</Label>
                    <Input
                      placeholder="e.g. ABC123XYZ"
                      value={inviteCode}
                      onChange={(e) => { setInviteCode(e.target.value.toUpperCase()); setError(null); }}
                      className="font-mono text-center tracking-[0.2em] text-lg"
                      disabled={loading}
                    />
                  </div>

                  {error && <p className="text-[10px] text-destructive font-bold">{error}</p>}

                  <Button onClick={handleJoinClass} className="w-full text-xs font-black uppercase tracking-widest" disabled={loading || authLoading || !inviteCode || !user}>
                    {loading ? "Joining..." : "Join Classroom"}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Onboarding;
