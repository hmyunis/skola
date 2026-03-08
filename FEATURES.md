# SKOLA — Feature Documentation

> Privacy-first, multi-tenant classroom management platform built with React, TypeScript, and Tailwind CSS.

---

## Table of Contents

- [Authentication & Onboarding](#authentication--onboarding)
- [Multi-Tenant Classrooms](#multi-tenant-classrooms)
- [Dashboard](#dashboard)
- [Schedule Management](#schedule-management)
- [Academics](#academics)
- [Resource Hub](#resource-hub)
- [Anonymous Lounge](#anonymous-lounge)
- [Arena (Quiz & Gamification)](#arena-quiz--gamification)
- [Members](#members)
- [Announcements](#announcements)
- [Settings & Theming](#settings--theming)
- [Admin Suite](#admin-suite)
- [Owner Suite](#owner-suite)
- [PWA Support](#pwa-support)
- [Keyboard Shortcuts](#keyboard-shortcuts)

---

## Authentication & Onboarding

- **Telegram Login** — Users authenticate via Telegram's Login Widget. No passwords required.
- **Dual-mode Login/Signup** — Returning users sign in with Telegram only. New students must provide a valid **invite code** alongside Telegram auth to create an account and auto-join the associated classroom.
- **Onboarding Flow** — Owners can create a new classroom (auto-generates a default invite code) or students can join an existing one via invite code.
- **Join via Link** — Direct join links (`/join/:code`) allow one-click classroom enrollment.

## Multi-Tenant Classrooms

- **Full Isolation** — Each classroom operates as an independent tenant. Data, members, courses, and resources are completely separated.
- **Role-Based Access** — Three roles with distinct permissions:
  - **Owner** — Full control over the classroom, feature toggles, and general settings.
  - **Admin** — Management of courses, semesters, users, moderation, announcements, and analytics.
  - **Student** — Access to academic features, lounge, arena, and resources.
- **Classroom Switching** — Users can be members of multiple classrooms and switch between them.

## Dashboard

- **Command Center** — Overview of the active semester with days remaining countdown.
- **Quick Stats** — At-a-glance counts for courses, resources, and assessments.
- **Live Status Card** — Real-time system status indicator.
- **Announcements Banner** — Dismissible banner showing active announcements with priority levels.
- **Panic Button** — A "Surprise Assessment" alert button with hazard-stripe styling and full-screen flash animation.

## Schedule Management

- **Weekly Grid (Desktop)** — Visual timetable grid showing classes across the week.
- **Daily Agenda (Mobile)** — Condensed day-by-day view optimized for mobile.
- **12-Hour AM/PM Format** — All times displayed in 12-hour format.
- **Drag-and-Drop Reordering** — Native drag-and-drop to rearrange schedule entries.
- **Edit Mode** — Modal-based editing for adding, updating, or removing schedule items.

## Academics

- **Course Management** — View and manage enrolled courses per semester.
- **Assessment Tracking** — Track assignments, exams, and deadlines using TanStack Table for dense, sortable lists.
- **Confidence Check** — Voting mechanism where students rate their confidence on upcoming assessments, visualized with segmented bar charts.
- **Semester Awareness** — All academic data is scoped to the active semester.

## Resource Hub

- **File Explorer UI** — Browse academic materials (notes, slides, past exams) in an organized file-explorer interface.
- **Metadata & Tagging** — Resources include metadata, category tags, and author information.
- **Star Ratings** — Users can rate resources for quality.
- **Helpfulness Voting** — Upvote/downvote system to surface the most useful materials.
- **CRUD & Moderation** — Authors and Admins have full create, read, update, and delete permissions.

## Anonymous Lounge

- **Identity-Protected Discussions** — Students post and discuss anonymously within their classroom.
- **Post Tags** — Categorize posts with tags (e.g., question, rant, confession, etc.).
- **Threaded Replies** — Nested reply system for conversations.
- **Academic Reactions** — React to posts with academic-themed emoji reactions.
- **Polls** — Create and vote on polls within the lounge.
- **Search & Filter** — Search posts by content, filter by tag, and sort by time or trending.
- **Reporting** — Flag inappropriate content for admin review.

## Arena (Quiz & Gamification)

- **Quiz System** — Take quizzes filtered by course with multiple-choice questions.
- **Custom Quizzes** — Create, save, and share custom quizzes.
- **Leaderboard** — Competitive rankings with scores, streaks, and XP.
- **Timed Challenges** — Quiz sessions with countdown timers.
- **Progress Tracking** — Visual progress bars and score history.

## Members

- **Member Directory** — View all classroom members with their roles.
- **Search** — Filter members by name.
- **Role Badges** — Visual indicators for Owner, Admin, and Student roles.
- **Direct Message** — Initiate conversations with members (via action button).
- **Kick/Remove** — Admins and Owners can remove members from the classroom.

## Announcements

- **Priority Levels** — Announcements support priority tiers for visual emphasis.
- **Dismissible** — Users can dismiss announcements they've read.
- **Persistent Banner** — Active announcements appear as a banner on the dashboard.
- **Admin Broadcasting** — Admins create and manage announcements from the admin panel.
- **Telegram Integration** — Announcements can be broadcast via Telegram bots.

## Settings & Theming

- **Color Mode** — Toggle between Light and Dark mode.
- **Font Family** — Choose from multiple font families (Lexend and others).
- **User Accent Colors** — Personalize the primary accent color from a curated palette.
- **Persistent Preferences** — Theme settings are stored locally and applied globally.
- **Zero Border Radius** — Enforced sharp/brutalist design system with `border-radius: 0` throughout.

## Admin Suite

Accessible to users with the **Admin** or **Owner** role:

- **Semester Management** — CRUD operations for academic semesters (name, start/end dates, active status).
- **Course Management** — Add, edit, and delete courses scoped to semesters.
- **User Management** — View all users, manage roles, and handle user statuses.
- **Invite Code Management** — Generate invite codes with configurable:
  - **Max Uses** — Limit how many students can use a single code.
  - **Expiry Date** — Set expiration dates for time-limited invitations.
  - **Activation/Deactivation** — Toggle codes on/off.
  - **Usage Tracking** — Monitor how many times each code has been used.
- **Moderation** — Review flagged content and user reports from the Anonymous Lounge.
- **Announcements** — Create, edit, and manage system-wide announcements.
- **Analytics Dashboard** — Real-time insights on engagement, attendance, and academic progress.

## Owner Suite

Accessible only to the **Owner** role:

- **Feature Toggles** — Enable or disable platform features globally, categorized as:
  - **Core** — Essential platform functionality.
  - **Social** — Community and discussion features.
  - **Gamification** — Arena, leaderboards, and competitive features.
  - **Experimental** — Beta features under testing.
- **General Settings** — Classroom-wide configuration managed by the owner.

## PWA Support

- **Progressive Web App** — Installable on mobile and desktop with offline-capable service worker.
- **Install Prompt** — Custom PWA install prompt for supported browsers.
- **App Icons** — 192×192 and 512×512 icons for home screen installation.

## Keyboard Shortcuts

- **Command Palette** — `Ctrl+K` / `⌘+K` opens a global command palette for quick navigation across all pages, admin tools, and owner settings.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| State | Zustand (auth, theme, semester, classroom stores) |
| Data Fetching | TanStack React Query |
| Routing | React Router v6 |
| Animation | Framer Motion |
| Build | Vite + PWA plugin |
| Auth | Telegram Login Widget |

---

*Made by [@hmyunis](https://github.com/hmyunis)*
