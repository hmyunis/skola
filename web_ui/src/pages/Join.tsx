import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, CheckCircle2, UserPlus, Loader2 } from "lucide-react";
import { useValidateInviteCode, useRegisterWithInvite } from "@/hooks/use-invites";

const JoinPage = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { data: invite, isLoading, isError } = useValidateInviteCode(code!);
  const registerMutation = useRegisterWithInvite();

  const [fullName, setFullName] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !invite?.valid) {
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

  if (registerMutation.isSuccess) {
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
    registerMutation.mutate({
      code,
      fullName: fullName.trim(),
      telegramUsername: telegramUsername.trim() || undefined,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="max-w-sm w-full border border-border p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-black uppercase tracking-[0.3em]">SKOLA</h1>
          <p className="text-sm text-muted-foreground">
            Joining <span className="font-bold text-foreground">{invite.classroom.name}</span>
          </p>
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
              disabled={registerMutation.isPending}
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
              disabled={registerMutation.isPending}
            />
          </div>

          <Button
            className="w-full"
            disabled={!fullName.trim() || registerMutation.isPending}
            onClick={handleSubmit}
          >
            {registerMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <UserPlus className="h-3 w-3 mr-2" /> Join
              </>
            )}
          </Button>
          {registerMutation.isError && (
            <p className="text-sm text-destructive text-center">{registerMutation.error.message}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default JoinPage;
