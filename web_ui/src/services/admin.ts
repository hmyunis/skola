/**
 * Admin services barrel export.
 */

export { 
    loadSemesters, 
    createSemester, 
    updateSemester, 
    deleteSemester, 
    fetchActiveSemester 
} from './semesters';
export type { Semester } from './semesters';

export { fetchManagedUsers, saveUserStatus, saveUserRole } from './users';
export type { ManagedUser } from './users';

export {
    loadUserReports,
    saveUserReport,
    updateUserReportStatus,
    fetchAllFlaggedContent,
    resolveResourceReport,
    dismissResourceReport,
    resolveLoungeReport,
    dismissLoungeReport,
} from './moderation';
export type { FlaggedContent, UserReport } from './moderation';

export {
    fetchAnnouncements,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    getDismissedAnnouncementIds,
    dismissAnnouncement,
} from './announcements';
export type { Announcement } from './announcements';

export { fetchAnalytics } from './analytics';
export type { AnalyticsData } from './analytics';

export { loadFeatures, saveFeatures, getMergedFeatures } from './features';
export type { FeatureToggle } from './features';

export { loadAssessments, saveAssessment, deleteAssessment } from './assessments';
export type { Assessment } from './assessments';

export { createInviteLink, deactivateInviteLink, deleteInviteLink } from './invites';
export type { InviteLink, InviteRegistration } from './invites';
