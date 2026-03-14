import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useFeatureEnabled } from "@/services/features";
import { Lock } from "lucide-react";

interface FeatureGuardProps {
  featureId: string;
}

export const FeatureGuard = ({ featureId }: FeatureGuardProps) => {
  const location = useLocation();
  const isEnabled = useFeatureEnabled(featureId);

  if (!isEnabled) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4 text-center animate-in fade-in zoom-in duration-300">
          <div className="h-16 w-16 bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center mx-auto rounded-full">
            <Lock className="h-8 w-8 text-amber-600" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black uppercase tracking-wider">Feature Locked</h1>
            <p className="text-sm text-muted-foreground">
              This feature has been disabled by the classroom owner. 
              Please contact your administrator if you believe this is an error.
            </p>
          </div>
          <button
            onClick={() => window.history.back()}
            className="px-6 py-2 bg-foreground text-background text-[10px] uppercase tracking-widest font-black hover:opacity-90 transition-opacity"
          >
            ← Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <Outlet />;
};
