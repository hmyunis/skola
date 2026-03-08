import { create } from "zustand";
import type { UserRole, MockAccount } from "@/types/auth";

// Re-export types for backward compatibility
export type { UserRole, MockAccount } from "@/types/auth";

export const MOCK_ACCOUNTS: MockAccount[] = [
  {
    id: "u1",
    name: "Dawit Tadesse",
    email: "dawit@skola.edu",
    initials: "DT",
    phone: "+251912345678",
    role: "owner",
    code: "11111",
    year: 4,
    semester: 2,
    batch: "Software",
    anonymous_id: "Anon#4821",
    telegramUsername: "dawit_t",
  },
  {
    id: "u2",
    name: "Meron Kebede",
    email: "meron@skola.edu",
    initials: "MK",
    phone: "+251923456789",
    role: "admin",
    code: "22222",
    year: 3,
    semester: 2,
    batch: "Software",
    anonymous_id: "Anon#7733",
    telegramUsername: "meron_k",
  },
  {
    id: "u3",
    name: "Bereket Wolde",
    email: "bereket@scola.edu",
    initials: "BW",
    phone: "+251934567890",
    role: "student",
    code: "33333",
    year: 2,
    semester: 2,
    batch: "Software",
    anonymous_id: "Anon#2156",
    telegramUsername: "bereket_w",
  },
];

const AUTH_KEY = "scola-auth-user";

function loadStoredUser(): MockAccount | null {
  try {
    const s = localStorage.getItem(AUTH_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return null;
}

interface AuthState {
  user: MockAccount | null;
  isAdmin: boolean;
  isOwner: boolean;
  userName: string;
  login: (account: MockAccount) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => {
  const initial = loadStoredUser();
  return {
    user: initial,
    isOwner: initial?.role === "owner",
    isAdmin: initial?.role === "owner" || initial?.role === "admin",
    userName: initial?.name || "Guest",

    login: (account) => {
      localStorage.setItem(AUTH_KEY, JSON.stringify(account));
      set({
        user: account,
        isOwner: account.role === "owner",
        isAdmin: account.role === "owner" || account.role === "admin",
        userName: account.name,
      });
    },

    logout: () => {
      localStorage.removeItem(AUTH_KEY);
      set({ user: null, isOwner: false, isAdmin: false, userName: "Guest" });
    },
  };
});

// Convenience hook matching old API
export const useAuth = () => useAuthStore();
