import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Assessment } from '../academics/entities/assessment.entity';
import { Course } from '../academics/entities/course.entity';
import { Quiz } from '../arena/entities/quiz.entity';
import { ClassroomMember } from '../classrooms/entities/classroom-member.entity';
import { LoungePost } from '../lounge/entities/lounge-post.entity';
import { Resource, ResourceType } from '../resources/entities/resource.entity';
import { UserRole } from '../users/entities/user.entity';

export interface CommandPaletteSearchItem {
  id: string;
  title: string;
  subtitle?: string;
  url: string;
}

export interface CommandPaletteSearchResponse {
  query: string;
  groups: {
    courses: CommandPaletteSearchItem[];
    assessments: CommandPaletteSearchItem[];
    resources: CommandPaletteSearchItem[];
    quizzes: CommandPaletteSearchItem[];
    posts: CommandPaletteSearchItem[];
    members: CommandPaletteSearchItem[];
  };
}

interface CourseRow {
  id: string;
  name: string;
  code: string | null;
  instructor: string | null;
}

interface AssessmentRow {
  id: string;
  title: string;
  courseCode: string;
  dueDate: string;
}

interface ResourceRow {
  id: string;
  title: string;
  type: ResourceType;
  courseCode: string | null;
}

interface QuizRow {
  id: string;
  title: string;
  courseCode: string;
}

interface PostRow {
  id: string;
  content: string;
  course: string | null;
  isAnonymous: boolean;
  authorName: string | null;
  authorAnonymousId: string | null;
}

interface MemberRow {
  id: string;
  role: UserRole;
  name: string;
  telegramUsername: string | null;
}

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Course)
    private readonly courseRepo: Repository<Course>,
    @InjectRepository(Assessment)
    private readonly assessmentRepo: Repository<Assessment>,
    @InjectRepository(Resource)
    private readonly resourceRepo: Repository<Resource>,
    @InjectRepository(Quiz)
    private readonly quizRepo: Repository<Quiz>,
    @InjectRepository(LoungePost)
    private readonly loungePostRepo: Repository<LoungePost>,
    @InjectRepository(ClassroomMember)
    private readonly classroomMemberRepo: Repository<ClassroomMember>,
  ) {}

  async searchCommandPalette(
    classroomId: string,
    rawQuery: string,
    limit = 5,
  ): Promise<CommandPaletteSearchResponse> {
    const query = (rawQuery || '').trim();
    if (query.length < 2) {
      return {
        query,
        groups: this.emptyGroups(),
      };
    }

    const safeLimit = Math.min(Math.max(limit, 1), 8);
    const normalized = query.toLowerCase();
    const contains = `%${normalized}%`;
    const prefix = `${normalized}%`;

    const [courses, assessments, resources, quizzes, posts, members] =
      await Promise.all([
        this.searchCourses(classroomId, contains, prefix, normalized, safeLimit),
        this.searchAssessments(classroomId, contains, prefix, normalized, safeLimit),
        this.searchResources(classroomId, contains, prefix, normalized, safeLimit),
        this.searchQuizzes(classroomId, contains, prefix, normalized, safeLimit),
        this.searchPosts(classroomId, contains, prefix, normalized, safeLimit),
        this.searchMembers(classroomId, contains, prefix, normalized, safeLimit),
      ]);

    return {
      query,
      groups: {
        courses,
        assessments,
        resources,
        quizzes,
        posts,
        members,
      },
    };
  }

  private emptyGroups() {
    return {
      courses: [],
      assessments: [],
      resources: [],
      quizzes: [],
      posts: [],
      members: [],
    };
  }

  private async searchCourses(
    classroomId: string,
    contains: string,
    prefix: string,
    exact: string,
    limit: number,
  ): Promise<CommandPaletteSearchItem[]> {
    const rows = await this.courseRepo
      .createQueryBuilder('course')
      .select('course.id', 'id')
      .addSelect('course.name', 'name')
      .addSelect('course.code', 'code')
      .addSelect('course.instructor', 'instructor')
      .where('course.classroomId = :classroomId', { classroomId })
      .andWhere(
        '(LOWER(course.name) LIKE :contains OR LOWER(course.code) LIKE :contains OR LOWER(course.instructor) LIKE :contains)',
        { contains },
      )
      .orderBy(
        `CASE
          WHEN LOWER(course.code) = :exact THEN 0
          WHEN LOWER(course.name) = :exact THEN 1
          WHEN LOWER(course.code) LIKE :prefix THEN 2
          WHEN LOWER(course.name) LIKE :prefix THEN 3
          ELSE 4
        END`,
        'ASC',
      )
      .addOrderBy('course.createdAt', 'DESC')
      .setParameters({ exact, prefix })
      .limit(limit)
      .getRawMany<CourseRow>();

    return rows.map((row) => ({
      id: row.id,
      title: row.code ? `${row.code} - ${row.name}` : row.name,
      subtitle: row.instructor ? `Instructor: ${row.instructor}` : undefined,
      url: '/academics',
    }));
  }

  private async searchAssessments(
    classroomId: string,
    contains: string,
    prefix: string,
    exact: string,
    limit: number,
  ): Promise<CommandPaletteSearchItem[]> {
    const rows = await this.assessmentRepo
      .createQueryBuilder('assessment')
      .select('assessment.id', 'id')
      .addSelect('assessment.title', 'title')
      .addSelect('assessment.courseCode', 'courseCode')
      .addSelect('assessment.dueDate', 'dueDate')
      .where('assessment.classroomId = :classroomId', { classroomId })
      .andWhere(
        '(LOWER(assessment.title) LIKE :contains OR LOWER(assessment.courseCode) LIKE :contains OR LOWER(assessment.description) LIKE :contains)',
        { contains },
      )
      .orderBy(
        `CASE
          WHEN LOWER(assessment.title) = :exact THEN 0
          WHEN LOWER(assessment.courseCode) = :exact THEN 1
          WHEN LOWER(assessment.title) LIKE :prefix THEN 2
          WHEN LOWER(assessment.courseCode) LIKE :prefix THEN 3
          ELSE 4
        END`,
        'ASC',
      )
      .addOrderBy('assessment.dueDate', 'ASC')
      .addOrderBy('assessment.createdAt', 'DESC')
      .setParameters({ exact, prefix })
      .limit(limit)
      .getRawMany<AssessmentRow>();

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      subtitle: row.courseCode ? `${row.courseCode} - due ${row.dueDate}` : `Due ${row.dueDate}`,
      url: '/academics',
    }));
  }

  private async searchResources(
    classroomId: string,
    contains: string,
    prefix: string,
    exact: string,
    limit: number,
  ): Promise<CommandPaletteSearchItem[]> {
    const rows = await this.resourceRepo
      .createQueryBuilder('resource')
      .leftJoin('resource.course', 'course')
      .select('resource.id', 'id')
      .addSelect('resource.title', 'title')
      .addSelect('resource.type', 'type')
      .addSelect('course.code', 'courseCode')
      .where('resource.classroomId = :classroomId', { classroomId })
      .andWhere(
        '(LOWER(resource.title) LIKE :contains OR LOWER(resource.description) LIKE :contains OR LOWER(resource.tags) LIKE :contains OR LOWER(course.code) LIKE :contains OR LOWER(course.name) LIKE :contains)',
        { contains },
      )
      .orderBy(
        `CASE
          WHEN LOWER(resource.title) = :exact THEN 0
          WHEN LOWER(course.code) = :exact THEN 1
          WHEN LOWER(resource.title) LIKE :prefix THEN 2
          WHEN LOWER(course.code) LIKE :prefix THEN 3
          ELSE 4
        END`,
        'ASC',
      )
      .addOrderBy('resource.updatedAt', 'DESC')
      .setParameters({ exact, prefix })
      .limit(limit)
      .getRawMany<ResourceRow>();

    return rows.map((row) => {
      const typeLabel = this.formatResourceType(row.type);
      const subtitleParts = [row.courseCode, typeLabel].filter(Boolean);
      return {
        id: row.id,
        title: row.title,
        subtitle: subtitleParts.join(' - ') || undefined,
        url: '/resources',
      };
    });
  }

  private async searchQuizzes(
    classroomId: string,
    contains: string,
    prefix: string,
    exact: string,
    limit: number,
  ): Promise<CommandPaletteSearchItem[]> {
    const rows = await this.quizRepo
      .createQueryBuilder('quiz')
      .select('quiz.id', 'id')
      .addSelect('quiz.title', 'title')
      .addSelect('quiz.courseCode', 'courseCode')
      .where('quiz.classroomId = :classroomId', { classroomId })
      .andWhere('quiz.isPublished = :isPublished', { isPublished: true })
      .andWhere('(LOWER(quiz.title) LIKE :contains OR LOWER(quiz.courseCode) LIKE :contains)', {
        contains,
      })
      .orderBy(
        `CASE
          WHEN LOWER(quiz.title) = :exact THEN 0
          WHEN LOWER(quiz.courseCode) = :exact THEN 1
          WHEN LOWER(quiz.title) LIKE :prefix THEN 2
          WHEN LOWER(quiz.courseCode) LIKE :prefix THEN 3
          ELSE 4
        END`,
        'ASC',
      )
      .addOrderBy('quiz.createdAt', 'DESC')
      .setParameters({ exact, prefix })
      .limit(limit)
      .getRawMany<QuizRow>();

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      subtitle: row.courseCode || undefined,
      url: '/arena',
    }));
  }

  private async searchPosts(
    classroomId: string,
    contains: string,
    prefix: string,
    exact: string,
    limit: number,
  ): Promise<CommandPaletteSearchItem[]> {
    const rows = await this.loungePostRepo
      .createQueryBuilder('post')
      .leftJoin('post.author', 'author')
      .select('post.id', 'id')
      .addSelect('post.content', 'content')
      .addSelect('post.course', 'course')
      .addSelect('post.isAnonymous', 'isAnonymous')
      .addSelect('author.name', 'authorName')
      .addSelect('author.anonymousId', 'authorAnonymousId')
      .where('post.classroomId = :classroomId', { classroomId })
      .andWhere('post.parentId IS NULL')
      .andWhere(
        '(LOWER(post.content) LIKE :contains OR LOWER(post.course) LIKE :contains OR LOWER(author.name) LIKE :contains OR LOWER(author.anonymousId) LIKE :contains)',
        { contains },
      )
      .orderBy(
        `CASE
          WHEN LOWER(post.course) = :exact THEN 0
          WHEN LOWER(author.name) = :exact THEN 1
          WHEN LOWER(post.course) LIKE :prefix THEN 2
          WHEN LOWER(author.name) LIKE :prefix THEN 3
          ELSE 4
        END`,
        'ASC',
      )
      .addOrderBy('post.createdAt', 'DESC')
      .setParameters({ exact, prefix })
      .limit(limit)
      .getRawMany<PostRow>();

    return rows.map((row) => {
      const authorName = row.isAnonymous
        ? row.authorAnonymousId || 'Anonymous'
        : row.authorName || 'Unknown';
      const subtitleParts = [authorName, row.course].filter(Boolean);
      return {
        id: row.id,
        title: this.toExcerpt(row.content, 80),
        subtitle: subtitleParts.join(' - ') || undefined,
        url: '/lounge',
      };
    });
  }

  private async searchMembers(
    classroomId: string,
    contains: string,
    prefix: string,
    exact: string,
    limit: number,
  ): Promise<CommandPaletteSearchItem[]> {
    const rows = await this.classroomMemberRepo
      .createQueryBuilder('member')
      .innerJoin('member.classroom', 'classroom')
      .innerJoin('member.user', 'user')
      .select('member.id', 'id')
      .addSelect('member.role', 'role')
      .addSelect('user.name', 'name')
      .addSelect('user.telegramUsername', 'telegramUsername')
      .where('classroom.id = :classroomId', { classroomId })
      .andWhere(
        '(LOWER(user.name) LIKE :contains OR LOWER(user.telegramUsername) LIKE :contains OR LOWER(user.anonymousId) LIKE :contains)',
        { contains },
      )
      .orderBy(
        `CASE
          WHEN LOWER(user.name) = :exact THEN 0
          WHEN LOWER(user.telegramUsername) = :exact THEN 1
          WHEN LOWER(user.name) LIKE :prefix THEN 2
          WHEN LOWER(user.telegramUsername) LIKE :prefix THEN 3
          ELSE 4
        END`,
        'ASC',
      )
      .addOrderBy(
        `CASE
          WHEN member.role = 'owner' THEN 0
          WHEN member.role = 'admin' THEN 1
          ELSE 2
        END`,
        'ASC',
      )
      .addOrderBy('user.name', 'ASC')
      .setParameters({ exact, prefix })
      .limit(limit)
      .getRawMany<MemberRow>();

    return rows.map((row) => ({
      id: row.id,
      title: row.name,
      subtitle: [
        this.roleLabel(row.role),
        row.telegramUsername ? `@${row.telegramUsername}` : null,
      ]
        .filter(Boolean)
        .join(' - '),
      url: '/members',
    }));
  }

  private formatResourceType(type: ResourceType) {
    const map: Record<ResourceType, string> = {
      [ResourceType.NOTE]: 'Note',
      [ResourceType.SLIDE]: 'Slide',
      [ResourceType.PAST_PAPER]: 'Past paper',
      [ResourceType.EBOOK]: 'Ebook',
      [ResourceType.OTHER]: 'Other',
    };

    return map[type] || 'Other';
  }

  private roleLabel(role: UserRole) {
    if (role === UserRole.OWNER) return 'Owner';
    if (role === UserRole.ADMIN) return 'Admin';
    return 'Student';
  }

  private toExcerpt(value: string | null | undefined, limit: number) {
    const compact = (value || '').replace(/\s+/g, ' ').trim();
    if (compact.length <= limit) return compact;
    if (limit <= 3) return compact.slice(0, limit);
    return `${compact.slice(0, limit - 3)}...`;
  }
}
