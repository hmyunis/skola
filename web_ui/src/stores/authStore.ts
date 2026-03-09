import { create } from "zustand";

interface AuthState {
  user: any | null;
  accessToken: string | null;
  isAdmin: boolean;
  isOwner: boolean;
  userName: string;
  login: (user: any, accessToken: string) => void;
  logout: () => void;
}

const TOKEN_KEY = "skola-auth-token";
const USER_KEY = "skola-auth-user";

function loadStoredUser(): any | null {
  try {
    const s = localStorage.getItem(USER_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return null;
}

function loadStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export const useAuthStore = create<AuthState>((set) => {
  const initialUser = loadStoredUser();
  const initialToken = loadStoredToken();

  return {
    user: initialUser,
    accessToken: initialToken,
    isOwner: initialUser?.role === "owner",
    isAdmin: initialUser?.role === "owner" || initialUser?.role === "admin",
    userName: initialUser?.name || "Guest",

    login: (user, accessToken) => {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      localStorage.setItem(TOKEN_KEY, accessToken);
      set({
        user,
        accessToken,
        isOwner: user.role === "owner",
        isAdmin: user.role === "owner" || user.role === "admin",
        userName: user.name,
      });
    },

    logout: () => {
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(TOKEN_KEY);
      set({
        user: null,
        accessToken: null,
        isOwner: false,
        isAdmin: false,
        userName: "Guest",
      });
    },
  };
});

// Convenience hook matching old API
export const useAuth = () => useAuthStore();
