import { apiFetch } from './api';

export interface Course {
    id: string;
    name: string;
    code?: string;
    credits?: number;
    instructor?: string;
    semesterId: string;
    semester?: {
        id: string;
        name: string;
    };
    createdAt: string;
}

export interface CourseListResponse {
    data: Course[];
    meta: {
        total: number;
        page: number;
        limit: number;
        lastPage: number;
    };
}

export interface CourseQueryParams {
    page?: number;
    limit?: number;
    search?: string;
    semesterId?: string;
}

// ─── API Calls ───

export async function fetchCourses(params?: CourseQueryParams): Promise<CourseListResponse> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) {
        const safeLimit = Math.min(Math.max(params.limit, 1), 100);
        query.set('limit', String(safeLimit));
    }
    if (params?.search) query.set('search', params.search);
    if (params?.semesterId) query.set('semesterId', params.semesterId);

    const qs = query.toString();
    return apiFetch(`/academics/courses${qs ? `?${qs}` : ''}`);
}

export async function fetchCourse(courseId: string): Promise<Course> {
    return apiFetch(`/academics/courses/${courseId}`);
}

export async function createCourse(data: {
    name: string;
    code?: string;
    credits?: number;
    instructor?: string;
    semesterId: string;
}): Promise<Course> {
    return apiFetch('/academics/courses', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function updateCourse(
    courseId: string,
    data: {
        name?: string;
        code?: string;
        credits?: number;
        instructor?: string;
        semesterId?: string;
    },
): Promise<Course> {
    return apiFetch(`/academics/courses/${courseId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    });
}

export async function deleteCourse(courseId: string): Promise<{ deleted: boolean }> {
    return apiFetch(`/academics/courses/${courseId}`, {
        method: 'DELETE',
    });
}

// ─── Semester API ───

export interface Semester {
    id: string;
    name: string;
    year?: number;
    startDate: string;
    endDate: string;
    isActive: boolean;
    classroomId: string;
}

export async function fetchSemesters(): Promise<Semester[]> {
    return apiFetch('/academics/semesters/archive');
}

export async function fetchActiveSemester(): Promise<Semester> {
    return apiFetch('/academics/semesters/active');
}
