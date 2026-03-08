import { useEffect, useRef, useCallback } from "react";
import { Shield, Lock } from "lucide-react";

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface TelegramLoginWidgetProps {
  botName: string;
  onAuth: (user: TelegramUser) => void;
  buttonSize?: "large" | "medium" | "small";
  cornerRadius?: number;
  requestAccess?: "write";
  usePic?: boolean;
}

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramUser) => void;
  }
}

export function TelegramLoginWidget({
  botName,
  onAuth,
  buttonSize = "large",
  cornerRadius = 0,
  requestAccess = "write",
  usePic = true,
}: TelegramLoginWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleAuth = useCallback(
    (user: TelegramUser) => {
      onAuth(user);
    },
    [onAuth]
  );

  useEffect(() => {
    window.onTelegramAuth = handleAuth;

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botName);
    script.setAttribute("data-size", buttonSize);
    script.setAttribute("data-radius", String(cornerRadius));
    script.setAttribute("data-request-access", requestAccess);
    script.setAttribute("data-userpic", String(usePic));
    script.setAttribute("data-onauth", "onTelegramAuth(user)");

    if (containerRef.current) {
      containerRef.current.innerHTML = "";
      containerRef.current.appendChild(script);
    }

    return () => {
      delete window.onTelegramAuth;
    };
  }, [botName, buttonSize, cornerRadius, requestAccess, usePic, handleAuth]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-border">
        <Shield className="h-4 w-4 text-primary" />
        <span className="text-xs font-bold uppercase tracking-wider">
          Telegram Login
        </span>
      </div>

      <div ref={containerRef} className="flex justify-center py-2" />

      <div className="flex items-start gap-2 p-3 border border-border bg-muted/30">
        <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Your phone number is <span className="font-bold text-foreground">never shared</span> with
          our system. Telegram only sends us your name and user ID for
          verification. Only members of the class Telegram group can access the
          platform.
        </p>
      </div>
    </div>
  );
}
