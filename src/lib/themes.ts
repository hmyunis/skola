export interface BatchTheme {
  id: string;
  name: string;
  primary: string;
  primaryForeground: string;
  headerBg: string;
  headerFg: string;
  sidebarBg: string;
  sidebarFg: string;
  sidebarAccent: string;
  pattern: string;
}

export interface UserAccent {
  id: string;
  name: string;
  hsl: string;
}

const svgUri = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`;

export const batchThemes: BatchTheme[] = [
  {
    id: "electrical",
    name: "Electrical",
    primary: "210 100% 50%",
    primaryForeground: "0 0% 100%",
    headerBg: "45 90% 48%",
    headerFg: "0 0% 10%",
    sidebarBg: "220 30% 14%",
    sidebarFg: "45 30% 85%",
    sidebarAccent: "220 25% 20%",
    pattern: svgUri(`<svg width="60" height="30" xmlns="http://www.w3.org/2000/svg"><path d="M0 15h10l3-10 6 20 6-20 6 20 6-20 3 10h10" fill="none" stroke="%233b82f6" stroke-width="0.8" opacity="0.12"/></svg>`),
  },
  {
    id: "medical",
    name: "Medical",
    primary: "200 80% 45%",
    primaryForeground: "0 0% 100%",
    headerBg: "200 70% 40%",
    headerFg: "0 0% 98%",
    sidebarBg: "200 30% 12%",
    sidebarFg: "200 20% 85%",
    sidebarAccent: "200 25% 18%",
    pattern: svgUri(`<svg width="40" height="40" xmlns="http://www.w3.org/2000/svg"><path d="M16 8h8v8h8v8h-8v8h-8v-8H8v-8h8z" fill="none" stroke="%23ef4444" stroke-width="0.5" opacity="0.1"/></svg>`),
  },
  {
    id: "civil",
    name: "Civil",
    primary: "25 90% 50%",
    primaryForeground: "0 0% 100%",
    headerBg: "25 80% 48%",
    headerFg: "0 0% 100%",
    sidebarBg: "30 15% 14%",
    sidebarFg: "30 15% 82%",
    sidebarAccent: "30 12% 20%",
    pattern: svgUri(`<svg width="50" height="25" xmlns="http://www.w3.org/2000/svg"><rect x="0.5" y="0.5" width="49" height="12" fill="none" stroke="%23f97316" stroke-width="0.4" opacity="0.1"/><line x1="25" y1="12.5" x2="25" y2="0" stroke="%23f97316" stroke-width="0.4" opacity="0.1"/><rect x="0.5" y="12.5" width="49" height="12" fill="none" stroke="%23f97316" stroke-width="0.4" opacity="0.1"/></svg>`),
  },
  {
    id: "mechanical",
    name: "Mechanical",
    primary: "15 60% 42%",
    primaryForeground: "0 0% 100%",
    headerBg: "0 0% 65%",
    headerFg: "0 0% 10%",
    sidebarBg: "0 0% 14%",
    sidebarFg: "0 0% 78%",
    sidebarAccent: "0 0% 20%",
    pattern: svgUri(`<svg width="50" height="50" xmlns="http://www.w3.org/2000/svg"><circle cx="25" cy="25" r="18" fill="none" stroke="%2378716c" stroke-width="0.5" opacity="0.12"/><circle cx="25" cy="25" r="6" fill="none" stroke="%2378716c" stroke-width="0.5" opacity="0.12"/><line x1="25" y1="7" x2="25" y2="1" stroke="%2378716c" stroke-width="0.5" opacity="0.1"/><line x1="25" y1="49" x2="25" y2="43" stroke="%2378716c" stroke-width="0.5" opacity="0.1"/></svg>`),
  },
  {
    id: "software",
    name: "Software",
    primary: "142 70% 40%",
    primaryForeground: "0 0% 100%",
    headerBg: "0 0% 8%",
    headerFg: "142 80% 55%",
    sidebarBg: "0 0% 6%",
    sidebarFg: "142 40% 65%",
    sidebarAccent: "0 0% 12%",
    pattern: svgUri(`<svg width="30" height="30" xmlns="http://www.w3.org/2000/svg"><circle cx="7" cy="7" r="1.8" fill="%2322c55e" opacity="0.12"/><circle cx="22" cy="22" r="1.8" fill="%2322c55e" opacity="0.12"/><circle cx="22" cy="7" r="1" fill="%2322c55e" opacity="0.06"/><circle cx="7" cy="22" r="1" fill="%2322c55e" opacity="0.06"/></svg>`),
  },
  {
    id: "law",
    name: "Law",
    primary: "40 75% 42%",
    primaryForeground: "0 0% 100%",
    headerBg: "30 40% 28%",
    headerFg: "40 30% 90%",
    sidebarBg: "30 25% 12%",
    sidebarFg: "40 20% 78%",
    sidebarAccent: "30 20% 18%",
    pattern: svgUri(`<svg width="40" height="40" xmlns="http://www.w3.org/2000/svg"><path d="M20 5l15 15-15 15L5 20z" fill="none" stroke="%23a16207" stroke-width="0.5" opacity="0.1"/></svg>`),
  },
  {
    id: "architecture",
    name: "Architecture",
    primary: "210 80% 45%",
    primaryForeground: "0 0% 100%",
    headerBg: "210 60% 30%",
    headerFg: "210 20% 92%",
    sidebarBg: "210 40% 14%",
    sidebarFg: "210 20% 82%",
    sidebarAccent: "210 30% 20%",
    pattern: svgUri(`<svg width="40" height="40" xmlns="http://www.w3.org/2000/svg"><rect width="40" height="40" fill="none" stroke="%232563eb" stroke-width="0.4" opacity="0.1"/><line x1="20" y1="0" x2="20" y2="40" stroke="%232563eb" stroke-width="0.25" opacity="0.07"/><line x1="0" y1="20" x2="40" y2="20" stroke="%232563eb" stroke-width="0.25" opacity="0.07"/></svg>`),
  },
];

export const userAccents: UserAccent[] = [
  { id: "cyan", name: "Cyan", hsl: "180 100% 40%" },
  { id: "magenta", name: "Magenta", hsl: "300 90% 45%" },
  { id: "lime", name: "Lime", hsl: "90 100% 38%" },
  { id: "amber", name: "Amber", hsl: "45 100% 48%" },
  { id: "rose", name: "Rose", hsl: "350 80% 52%" },
  { id: "violet", name: "Violet", hsl: "270 80% 52%" },
];
