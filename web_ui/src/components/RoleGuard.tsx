import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/stores/authStore";
import { useClassroomStore } from "@/stores/classroomStore";
import { AlertTriangle } from "lucide-react";

interface RoleGuardProps {
  allowedRoles: ("owner" | "admin" | "student")[];
}

export const RoleGuard = ({ allowedRoles }: RoleGuardProps) => {
  const { user } = useAuth();
  const activeClassroomRole = useClassroomStore((s) => s.activeClassroomRole);
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const effectiveRole = activeClassroomRole || "student";

  if (!allowedRoles.includes(effectiveRole)) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4 text-center">
          <div className="h-16 w-16 bg-destructive/10 border-2 border-destructive/30 flex items-center justify-center mx-auto rounded-full">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black uppercase tracking-wider text-destructive">Access Denied</h1>
            <p className="text-sm text-muted-foreground">
              You do not have the required permissions to access this page.
              This area is restricted to {allowedRoles.join(" or ")}s only.
            </p>
          </div>
          <button
            onClick={() => window.history.back()}
            className="text-[10px] uppercase tracking-widest font-black text-primary hover:underline"
          >
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  return <Outlet />;
};
