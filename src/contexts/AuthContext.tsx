import React, { createContext, useContext, useState, useCallback } from "react";

export type UserRole = "student" | "admin" | "owner";

export interface MockAccount {
  id: string;
  name: string;
  email: string;
  initials: string;
  phone: string;
  role: UserRole;
  code: string; // verification code
  year: number;
  semester: number;
  batch: string;
}

export const MOCK_ACCOUNTS: MockAccount[] = [
  {
    id: "u1",
    name: "Dawit Tadesse",
    email: "dawit@scola.edu",
    initials: "DT",
    phone: "+251912345678",
    role: "owner",
    code: "11111",
    year: 4,
    semester: 2,
    batch: "Software",
  },
  {
    id: "u2",
    name: "Meron Kebede",
    email: "meron@scola.edu",
    initials: "MK",
    phone: "+251923456789",
    role: "admin",
    code: "22222",
    year: 3,
    semester: 2,
    batch: "Software",
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
  },
];

interface AuthContextType {
  user: MockAccount | null;
  isAdmin: boolean;
  isOwner: boolean;
  userName: string;
  login: (account: MockAccount) => void;
  logout: () => void;
}

const AUTH_KEY = "scola-auth-user";

function loadStoredUser(): MockAccount | null {
  try {
    const s = localStorage.getItem(AUTH_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MockAccount | null>(loadStoredUser);

  const login = useCallback((account: MockAccount) => {
    setUser(account);
    localStorage.setItem(AUTH_KEY, JSON.stringify(account));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(AUTH_KEY);
  }, []);

  const isOwner = user?.role === "owner";
  const isAdmin = isOwner || user?.role === "admin";
  const userName = user?.name || "Guest";

  return (
    <AuthContext.Provider value={{ user, isAdmin, isOwner, userName, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
