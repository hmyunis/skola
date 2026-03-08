import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getInviteByCode, useInviteLink, saveRegistration } from "@/services/invites";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, CheckCircle2, UserPlus } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const JoinPage = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const invite = code ? getInviteByCode(code) : null;

  const [fullName, setFullName] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="max-w-sm w-full border border-destructive/30 bg-destructive/5 p-8 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
          <h1 className="text-lg font-black uppercase tracking-wider text-destructive">Invalid Link</h1>
          <p className="text-sm text-muted-foreground">
            This invite link is invalid, expired, or has been used up.
          </p>
          <Button variant="outline" onClick={() => navigate("/login")} className="mt-4">
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="max-w-sm w-full border border-emerald-500/30 bg-emerald-500/5 p-8 text-center space-y-3">
          <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto" />
          <h1 className="text-lg font-black uppercase tracking-wider">Welcome!</h1>
          <p className="text-sm text-muted-foreground">
            Your registration has been submitted. You'll be able to log in once approved.
          </p>
          <Button variant="outline" onClick={() => navigate("/login")} className="mt-4">
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  const handleSubmit = () => {
    if (!fullName.trim() || !code) return;
    const success = useInviteLink(code);
    if (!success) {
      toast({ title: "Error", description: "This invite link is no longer valid." });
      return;
    }
    saveRegistration({
      id: `reg-${Date.now()}`,
      inviteCode: code,
      fullName: fullName.trim(),
      telegramUsername: telegramUsername.trim() || undefined,
      registeredAt: new Date().toISOString(),
    });
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="max-w-sm w-full border border-border p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-black uppercase tracking-[0.3em]">SCOLA</h1>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Join the Community</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
              Full Name <span className="text-destructive">*</span>
            </label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
              Telegram Username <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              value={telegramUsername}
              onChange={(e) => setTelegramUsername(e.target.value)}
              placeholder="@username"
              className="h-9 text-sm"
            />
          </div>

          <Button
            className="w-full"
            disabled={!fullName.trim()}
            onClick={handleSubmit}
          >
            <UserPlus className="h-3 w-3" /> Join
          </Button>
        </div>
      </div>
    </div>
  );
};

export default JoinPage;
