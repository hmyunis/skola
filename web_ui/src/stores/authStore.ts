import { create } from "zustand";
import { useClassroomStore } from "./classroomStore";

interface AuthState {
  user: any | null;
  accessToken: string | null;
  isAdmin: boolean;
  isOwner: boolean;
  userName: string;
  login: (user: any, accessToken: string) => void;
  logout: () => void;
  setUser: (user: any) => void;
}

const TOKEN_KEY = "skola-auth-token";
const USER_KEY = "skola-auth-user";

function resolveRoleFlags(
  _user: any | null,
  activeClassroomRole: "owner" | "admin" | "student" | null | undefined,
) {
  const effectiveRole = activeClassroomRole || null;
  const isOwner = effectiveRole === "owner";
  const isAdmin = isOwner || effectiveRole === "admin";
  return { isOwner, isAdmin };
}

function loadStoredUser(): any | null {
  try {
    const s = localStorage.getItem(USER_KEY);
    if (s) return JSON.parse(s);
  } catch {
    return null;
  }
  return null;
}

function loadStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export const useAuthStore = create<AuthState>((set, get) => {
  const initialUser = loadStoredUser();
  const initialToken = loadStoredToken();
  const initialActiveClassroomRole = useClassroomStore.getState().activeClassroomRole;
  const initialFlags = resolveRoleFlags(initialUser, initialActiveClassroomRole);

  return {
    user: initialUser,
    accessToken: initialToken,
    isOwner: initialFlags.isOwner,
    isAdmin: initialFlags.isAdmin,
    userName: initialUser?.name || "Guest",

    login: (user, accessToken) => {
      const activeClassroomRole = useClassroomStore.getState().activeClassroomRole;
      const flags = resolveRoleFlags(user, activeClassroomRole);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      localStorage.setItem(TOKEN_KEY, accessToken);
      set({
        user,
        accessToken,
        isOwner: flags.isOwner,
        isAdmin: flags.isAdmin,
        userName: user.name,
      });
    },

    logout: () => {
      useClassroomStore.getState().clearContext();
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

    setUser: (user) => {
      const activeClassroomRole = useClassroomStore.getState().activeClassroomRole;
      const flags = resolveRoleFlags(user, activeClassroomRole);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      set({
        user,
        isOwner: flags.isOwner,
        isAdmin: flags.isAdmin,
        userName: user.name,
      });
    },
  };
});

useClassroomStore.subscribe((state) => {
  const { user, isAdmin, isOwner } = useAuthStore.getState();
  const flags = resolveRoleFlags(user, state.activeClassroomRole);
  if (flags.isAdmin !== isAdmin || flags.isOwner !== isOwner) {
    useAuthStore.setState({
      isAdmin: flags.isAdmin,
      isOwner: flags.isOwner,
    });
  }
});

// Convenience hook matching old API
export const useAuth = () => useAuthStore();
