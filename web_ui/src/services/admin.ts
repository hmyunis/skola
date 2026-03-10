/**
 * Admin services barrel export.
 */

export { loadSemesters, saveSemesters } from "./semesters";
export type { Semester } from "./semesters";

export { loadCourses, saveCourses } from "./courses";
export type { AdminCourse } from "./courses";

export { fetchManagedUsers, saveUserStatus, saveUserRole } from "./users";
export type { ManagedUser } from "./users";

export { fetchFlaggedContent, loadUserReports, saveUserReport, fetchAllFlaggedContent } from "./moderation";
export type { FlaggedContent, UserReport } from "./moderation";

export { loadAnnouncements, saveAnnouncements, getDismissedAnnouncementIds, dismissAnnouncement } from "./announcements";
export type { Announcement } from "./announcements";

export { fetchAnalytics } from "./analytics";
export type { AnalyticsData } from "./analytics";

export { loadFeatures, saveFeatures } from "./features";
export type { FeatureToggle } from "./features";

export { loadAssessments, saveAssessment, deleteAssessment } from "./assessments";
export type { Assessment } from "./assessments";

export { createInviteLink, deactivateInviteLink, deleteInviteLink } from "./invites";
export type { InviteLink, InviteRegistration } from "./invites";
