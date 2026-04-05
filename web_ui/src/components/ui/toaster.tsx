import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { Loader2 } from "lucide-react";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, loading, ...props }) {
        return (
          <Toast key={id} {...props} className="border-l-4 border-l-primary">
            <div className="flex items-start gap-2.5">
              {loading ? <Loader2 className="h-4 w-4 mt-0.5 text-primary animate-spin shrink-0" /> : null}
              <div className="grid gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && <ToastDescription>{description}</ToastDescription>}
              </div>
            </div>
            {action}
            {!loading ? <ToastClose /> : null}
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
