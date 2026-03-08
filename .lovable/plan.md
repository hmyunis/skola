
# SCOLA - Phase 1: Core Shell + Dashboard

## Overview
Build the foundational layout, theme engine, and dashboard for the SCOLA University Batch Management System. All data will be mocked. React Router + Tailwind v3.

---

## 1. Global Setup
- Load **Lexend** font via Google Fonts, apply globally
- Override Tailwind config: force `border-radius: 0` globally, set sharp design tokens
- Override Shadcn components: buttons (uppercase, tracking-wide, rectangular), cards (1px border, no shadow, no radius), inputs (bottom-border style), toasts (high-contrast, sharp)
- Install **Framer Motion** and **Axios** packages

## 2. Theme Engine
- Create a `ThemeProvider` context managing two states: **Batch Theme** (background SVG pattern + header colors) and **User Accent** (primary color override)
- Build 7 preset SVG patterns: Electrical, Medical, Civil, Mechanical, Software, Law, Architecture — each with distinct subtle repeating pattern and color scheme
- SVG patterns render as a fixed background layer behind all content
- User accent colors (Cyan, Magenta, Lime, etc.) override primary button/link colors independently

## 3. Layout Shell
- **Desktop (≥768px):** Collapsible sidebar with navigation links (Dashboard, Schedule, Academics, Resources, Lounge, Arena, Settings) using Lucide icons. Sharp styling, 1px borders
- **Mobile (<768px):** Fixed bottom navigation bar with 5 key routes + "More" menu
- Sidebar trigger always visible in header
- Routes: `/`, `/schedule`, `/academics`, `/resources`, `/lounge`, `/arena`, `/settings`

## 4. Mock Data Layer
- Create `services/api.ts` with Axios-based mock functions returning hardcoded data (current semester, schedule, classes, user info)
- Wire up with TanStack Query for loading/error states

## 5. Dashboard — "The Command Center"
- **Header bar:** Current semester info ("Year 3, Sem 2") + "Days Remaining" countdown calculated from mock semester end date
- **Live Status Card:** Prominent top card showing one of three states:
  - "LIVE NOW" — green indicator, class name, progress bar showing elapsed time
  - "UP NEXT" — amber indicator, next class name and countdown
  - "FREE TIME" — muted state
- **Panic Button (Admin only):** Hazard-striped button labeled "SURPRISE ASSESSMENT". On click, triggers a full-screen red flash animation using Framer Motion. Visible only when a mock `isAdmin` flag is true
- **Quick stats:** Cards showing today's remaining classes, pending assignments count, upcoming exams

## 6. Placeholder Pages
- Create stub pages for Schedule, Academics, Resources, Lounge, Arena, and Settings with the page title and "Coming soon" message, all using the sharp design language

---

## Design Details
- All corners: 0px radius, no exceptions
- Borders: 1px solid, dashed for draft/placeholder states
- Typography: Lexend everywhere, uppercase for buttons and labels
- Color palette adapts to selected batch theme
- Mobile-first responsive approach throughout
