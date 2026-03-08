import type { ManagedUser } from "@/types/admin";

// Re-export type for backward compatibility
export type { ManagedUser } from "@/types/admin";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const USER_STATUS_KEY = "scola-user-statuses";

export function loadUserStatuses(): Record<string, { status: string; suspendedUntil?: string }> {
  try {
    const s = localStorage.getItem(USER_STATUS_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return {};
}

export function saveUserStatus(userId: string, status: string, suspendedUntil?: string) {
  const all = loadUserStatuses();
  all[userId] = { status, suspendedUntil };
  localStorage.setItem(USER_STATUS_KEY, JSON.stringify(all));
}

export function getUserStatus(userId: string): { status: string; suspendedUntil?: string } | null {
  const all = loadUserStatuses();
  return all[userId] || null;
}

export async function fetchManagedUsers(): Promise<ManagedUser[]> {
  await delay(300);
  const statuses = loadUserStatuses();
  const users: ManagedUser[] = [
    { id: "u1", name: "Dawit Tadesse", email: "dawit@scola.edu", role: "owner", status: "active", joinedAt: "2025-06-01", lastActive: "2026-03-08", telegramUsername: "dawit_t" },
    { id: "u2", name: "Meron Kebede", email: "meron@scola.edu", role: "admin", status: "active", joinedAt: "2025-08-15", lastActive: "2026-03-07", telegramUsername: "meron_k" },
    { id: "u3", name: "Bereket Wolde", email: "bereket@scola.edu", role: "student", status: "active", joinedAt: "2025-08-20", lastActive: "2026-03-08", telegramUsername: "bereket_w" },
    { id: "u4", name: "Amina Hassan", email: "amina@scola.edu", role: "student", status: "active", joinedAt: "2025-09-01", lastActive: "2026-03-06", telegramUsername: "amina_h" },
    { id: "u5", name: "Nahom Tesfaye", email: "nahom@scola.edu", role: "student", status: "suspended", joinedAt: "2025-09-10", lastActive: "2026-02-28", telegramUsername: "nahom_t" },
    { id: "u6", name: "Sara Mohammed", email: "sara@scola.edu", role: "student", status: "banned", joinedAt: "2025-10-05", lastActive: "2026-01-15", telegramUsername: "sara_m" },
    { id: "u7", name: "Kidus Mengistu", email: "kidus@scola.edu", role: "admin", status: "active", joinedAt: "2025-08-10", lastActive: "2026-03-08", telegramUsername: "kidus_m" },
    { id: "u8", name: "Liya Abdi", email: "liya@scola.edu", role: "student", status: "active", joinedAt: "2025-11-01", lastActive: "2026-03-07", telegramUsername: "liya_a" },
  ];
  return users.map((u) => {
    const saved = statuses[u.id];
    if (saved) {
      const s = saved as { status: string; suspendedUntil?: string };
      if (s.status === "suspended" && s.suspendedUntil && new Date(s.suspendedUntil) <= new Date()) {
        return { ...u, status: "active" as const };
      }
      return { ...u, status: s.status as ManagedUser["status"], suspendedUntil: s.suspendedUntil };
    }
    return u;
  });
}
