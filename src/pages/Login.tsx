import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, MOCK_ACCOUNTS } from "@/stores/authStore";
import { getUserStatus } from "@/services/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Shield,
  Lock,
  Send,
  AlertTriangle,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  XOctagon,
  Crown,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [view, setView] = useState<AuthView>("login");
  const [phone, setPhone] = useState("+251 ");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState("");
  const [deniedReason, setDeniedReason] = useState<"unregistered" | "banned" | "suspended">("unregistered");
  const [suspendedUntil, setSuspendedUntil] = useState("");

  const handleSendCode = () => {
    const cleaned = phone.replace(/\s/g, "");
    const ethRegex = /^\+251[79]\d{8}$/;
    if (!ethRegex.test(cleaned)) {
      setError("Enter a valid Ethiopian number: +251 (7 or 9) followed by 8 digits");
      return;
    }
    setError("");
    setView("verifying");

    setTimeout(() => {
      setView("login");
      setStep("code");
    }, 1500);
  };

  const tryLogin = (account: typeof MOCK_ACCOUNTS[0]) => {
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
    setTimeout(() => navigate("/"), 1200);
  };

  const handleVerifyCode = () => {
    if (!code.trim() || code.length < 5) {
      setError("Enter the 5-digit code");
      return;
    }
    setError("");
    setView("verifying");

    setTimeout(() => {
      const account = MOCK_ACCOUNTS.find((a) => a.code === code);
      if (code === "00000") {
        setView("denied");
        setDeniedReason("unregistered");
      } else if (account) {
        tryLogin(account);
      } else {
        tryLogin(MOCK_ACCOUNTS[2]);
      }
    }, 2000);
  };

  const resetToLogin = () => {
    setView("login");
    setStep("phone");
    setPhone("+251 ");
    setCode("");
    setError("");
  };

  // ─── Quick Login (dev helper) ───
  const handleQuickLogin = (accountIdx: number) => {
    login(MOCK_ACCOUNTS[accountIdx]);
    setView("success");
    setTimeout(() => navigate("/"), 800);
  };

  // ─── ACCESS DENIED state ───
  if (view === "denied") {
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
                    Authentication Failed
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Your Telegram account is not linked to any registered student profile.
                    Contact your academic administrator for access provisioning.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button variant="outline" onClick={resetToLogin} className="w-full">
                  <ArrowRight className="h-3 w-3 rotate-180" />
                  Try Another Account
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-xs text-muted-foreground"
                  onClick={() =>
                    window.open("mailto:admin@university.edu?subject=Access%20Request%20-%20SCOLA", "_blank")
                  }
                >
                  Contact Administrator
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

  // ─── Verifying state ───
  if (view === "verifying") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 text-primary mx-auto animate-spin" />
          <div className="space-y-1">
            <p className="text-sm font-bold uppercase tracking-wider">
              {step === "phone" ? "Sending Code..." : "Verifying..."}
            </p>
            <p className="text-xs text-muted-foreground">
              {step === "phone"
                ? "Connecting to Telegram"
                : "Authenticating your identity"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Success state ───
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
            <p className="text-xs text-muted-foreground">Redirecting to dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Login form ───
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
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
            <h1 className="text-2xl font-black uppercase tracking-wider">SCOLA</h1>
          </div>
        </div>

        {/* Telegram Login Card */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Send className="h-4 w-4 text-[hsl(200,80%,50%)]" />
              <span className="text-xs font-bold uppercase tracking-wider">
                Telegram Login
              </span>
              <div className="flex-1" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                {step === "phone" ? "Step 1/2" : "Step 2/2"}
              </span>
            </div>

            {step === "phone" ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                    Phone Number
                  </label>
                  <Input
                    placeholder="+251 9XX XXX XXX"
                    value={phone}
                    onChange={(e) => {
                      let val = e.target.value;
                      if (!val.startsWith("+251")) {
                        val = "+251 ";
                      }
                      const afterPrefix = val.slice(4).replace(/[^\d\s]/g, "");
                      const digitsOnly = afterPrefix.replace(/\s/g, "");
                      if (digitsOnly.length > 9) return;
                      setPhone("+251" + afterPrefix);
                      setError("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
                    className="h-10 text-sm font-mono"
                    type="tel"
                  />
                </div>

                {error && (
                  <p className="text-[11px] text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> {error}
                  </p>
                )}

                <Button onClick={handleSendCode} className="w-full">
                  <Send className="h-3 w-3" />
                  Send Verification Code
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Code sent to <span className="font-mono font-bold text-foreground">{phone}</span>
                </p>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                    Verification Code
                  </label>
                  <div className="relative">
                    <Input
                      placeholder="XXXXX"
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value.replace(/\D/g, "").slice(0, 5));
                        setError("");
                      }}
                      onKeyDown={(e) => e.key === "Enter" && handleVerifyCode()}
                      className="h-10 text-sm font-mono tracking-[0.5em] text-center pr-10"
                      type={showCode ? "text" : "password"}
                      maxLength={5}
                    />
                    <button
                      onClick={() => setShowCode(!showCode)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-[11px] text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> {error}
                  </p>
                )}

                <Button onClick={handleVerifyCode} className="w-full" disabled={code.length < 5}>
                  <Shield className="h-3 w-3" />
                  Verify & Login
                </Button>

                <button
                  onClick={() => {
                    setStep("phone");
                    setCode("");
                    setError("");
                  }}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors w-full text-center"
                >
                  ← Change phone number
                </button>
              </div>
            )}
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
                      <p className="text-[10px] opacity-70 uppercase tracking-wider">{account.role} · Code: {account.code}</p>
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
            SCOLA v1.0 · {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
