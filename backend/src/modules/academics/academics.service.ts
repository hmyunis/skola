import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DeepPartial } from 'typeorm';
import { Semester } from './entities/semester.entity';
import { Course } from './entities/course.entity';
import {
  ScheduleFireMode,
  ScheduleItem,
  ScheduleType,
} from './entities/schedule-item.entity';
import {
  AssessmentConfidenceVote,
  AssessmentRating,
} from './entities/assessment-rating.entity';
import {
  Assessment,
  AssessmentStatus,
  AssessmentSource,
} from './entities/assessment.entity';
import {
  CreateCourseDto,
  UpdateCourseDto,
  CourseQueryDto,
} from './dto/course.dto';
import { CreateSemesterDto, UpdateSemesterDto } from './dto/semester.dto';
import {
  CreateScheduleItemDto,
  UpdateScheduleItemDto,
} from './dto/schedule.dto';
import {
  AssessmentQueryDto,
  CreateAssessmentDto,
  UpdateAssessmentDto,
} from './dto/assessment.dto';

export interface CourseListResult {
  data: Course[];
  meta: {
    total: number;
    page: number;
    limit: number;
    lastPage: number;
  };
}

export interface CourseStatsResult {
  totalCourses: number;
  totalCredits: number;
}

export interface DashboardQuickStats {
  remainingClasses: number;
  pendingAssignments: number;
  upcomingExams: number;
}

@Injectable()
export class AcademicsService {
  constructor(
    @InjectRepository(Semester) private semesterRepo: Repository<Semester>,
    @InjectRepository(Course) private courseRepo: Repository<Course>,
    @InjectRepository(ScheduleItem)
    private scheduleRepo: Repository<ScheduleItem>,
    @InjectRepository(Assessment)
    private assessmentRepo: Repository<Assessment>,
    @InjectRepository(AssessmentRating)
    private assessmentRatingRepo: Repository<AssessmentRating>,
  ) {}

  // ================= SEMESTERS =================
  async createSemester(classroomId: string, data: CreateSemesterDto) {
    // If this is set to active, deactivate all others in this classroom
    const isActive = data.status === 'active';
    if (isActive) {
      await this.semesterRepo.update(
        { classroomId },
        { isActive: false, status: 'archived' },
      );
    }
    const semester = this.semesterRepo.create({
      ...data,
      classroomId,
      isActive,
    });
    return this.semesterRepo.save(semester);
  }

  async getActiveSemester(classroomId: string) {
    const semester = await this.semesterRepo.findOne({
      where: { classroomId, isActive: true },
      relations: ['courses', 'courses.scheduleItems'], // Pre-load data for dashboard
    });
    if (!semester) throw new NotFoundException('No active semester found');
    return semester;
  }

  async getAllSemesters(classroomId: string) {
    return this.semesterRepo.find({
      where: { classroomId },
      order: { startDate: 'DESC' }, // Newest first for Archive view
    });
  }

  async updateSemester(
    classroomId: string,
    semesterId: string,
    data: UpdateSemesterDto,
  ) {
    const semester = await this.semesterRepo.findOne({
      where: { id: semesterId, classroomId },
    });
    if (!semester) throw new NotFoundException('Semester not found');

    const becomingActive =
      data.status === 'active' && semester.status !== 'active';
    if (becomingActive) {
      await this.semesterRepo.update(
        { classroomId },
        { isActive: false, status: 'archived' },
      );
      semester.isActive = true;
    } else if (data.status && data.status !== 'active') {
      semester.isActive = false;
    }

    Object.assign(semester, data);
    return this.semesterRepo.save(semester);
  }

  async deleteSemester(classroomId: string, semesterId: string) {
    const semester = await this.semesterRepo.findOne({
      where: { id: semesterId, classroomId },
    });
    if (!semester) throw new NotFoundException('Semester not found');

    // Check if it has courses
    const courseCount = await this.courseRepo.count({ where: { semesterId } });
    if (courseCount > 0) {
      throw new BadRequestException(
        'Cannot delete semester with existing courses',
      );
    }

    await this.semesterRepo.remove(semester);
    return { deleted: true };
  }

  // ================= SCHEDULE & COURSES =================
  async createCourse(classroomId: string, dto: CreateCourseDto) {
    // Verify semester belongs to this classroom
    const semester = await this.semesterRepo.findOne({
      where: { id: dto.semesterId, classroomId },
    });
    if (!semester) {
      throw new NotFoundException('Semester not found in this classroom');
    }

    const course = this.courseRepo.create({
      name: dto.name,
      code: dto.code,
      credits: dto.credits ?? 3,
      instructor: dto.instructor,
      semesterId: dto.semesterId,
      classroomId,
    });
    return this.courseRepo.save(course);
  }

  async getCourses(
    classroomId: string,
    query: CourseQueryDto,
  ): Promise<CourseListResult> {
    const { page = 1, limit = 20, search, semesterId } = query;

    const qb = this.courseRepo
      .createQueryBuilder('course')
      .leftJoinAndSelect('course.semester', 'semester')
      .where('course.classroomId = :classroomId', { classroomId });

    if (semesterId) {
      qb.andWhere('course.semesterId = :semesterId', { semesterId });
    }

    if (search) {
      qb.andWhere(
        '(course.name LIKE :search OR course.code LIKE :search OR course.instructor LIKE :search)',
        { search: `%${search}%` },
      );
    }

    qb.orderBy('course.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        lastPage: Math.ceil(total / limit),
      },
    };
  }

  async getCourseStats(
    classroomId: string,
    query: CourseQueryDto,
  ): Promise<CourseStatsResult> {
    const { search, semesterId } = query;

    const qb = this.courseRepo
      .createQueryBuilder('course')
      .leftJoin('course.semester', 'semester')
      .where('course.classroomId = :classroomId', { classroomId });

    if (semesterId) {
      qb.andWhere('course.semesterId = :semesterId', { semesterId });
    }

    if (search) {
      qb.andWhere(
        '(course.name LIKE :search OR course.code LIKE :search OR course.instructor LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const raw = await qb
      .select('COUNT(course.id)', 'totalCourses')
      .addSelect('COALESCE(SUM(course.credits), 0)', 'totalCredits')
      .getRawOne<{ totalCourses: string; totalCredits: string }>();

    return {
      totalCourses: Number(raw?.totalCourses || 0),
      totalCredits: Number(raw?.totalCredits || 0),
    };
  }

  async getCourseById(classroomId: string, courseId: string) {
    const course = await this.courseRepo.findOne({
      where: { id: courseId, classroomId },
      relations: ['semester'],
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    return course;
  }

  async updateCourse(
    classroomId: string,
    courseId: string,
    dto: UpdateCourseDto,
  ) {
    if (dto.id && dto.id !== courseId) {
      throw new BadRequestException('Body id does not match route id');
    }

    const course = await this.getCourseById(classroomId, courseId);

    // If semesterId is being changed, verify it belongs to this classroom
    if (dto.semesterId && dto.semesterId !== course.semesterId) {
      const semester = await this.semesterRepo.findOne({
        where: { id: dto.semesterId, classroomId },
      });
      if (!semester) {
        throw new NotFoundException('Semester not found in this classroom');
      }
    }

    Object.assign(course, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.code !== undefined && { code: dto.code }),
      ...(dto.credits !== undefined && { credits: dto.credits }),
      ...(dto.instructor !== undefined && { instructor: dto.instructor }),
      ...(dto.semesterId !== undefined && { semesterId: dto.semesterId }),
    });

    return this.courseRepo.save(course);
  }

  async deleteCourse(classroomId: string, courseId: string) {
    const course = await this.getCourseById(classroomId, courseId);
    await this.courseRepo.remove(course);
    return { deleted: true };
  }

  async createScheduleItem(classroomId: string, dto: CreateScheduleItemDto) {
    const activeSemester = await this.getActiveSemester(classroomId);
    const course = await this.courseRepo.findOne({
      where: { id: dto.courseId, classroomId, semesterId: activeSemester.id },
    });
    if (!course) {
      throw new NotFoundException('Course not found in active semester');
    }

    this.validateTimeRange(dto.startTime, dto.endTime);
    await this.ensureNoTimeConflict(
      classroomId,
      activeSemester.id,
      dto.dayOfWeek,
      dto.startTime,
      dto.endTime,
    );

    const item = this.scheduleRepo.create({
      courseId: dto.courseId,
      dayOfWeek: dto.dayOfWeek,
      startTime: this.normalizeTime(dto.startTime),
      endTime: this.normalizeTime(dto.endTime),
      type: dto.type as ScheduleType,
      location: dto.location || null,
      isOnline: dto.isOnline ?? false,
      isDraft: dto.isDraft ?? true,
      fireMode:
        (dto.fireMode as ScheduleFireMode | undefined) ?? ScheduleFireMode.AUTO,
    } as DeepPartial<ScheduleItem>);

    const saved = await this.scheduleRepo.save(item);
    return this.getScheduleItemById(classroomId, saved.id);
  }

  async updateScheduleItem(
    classroomId: string,
    itemId: string,
    dto: UpdateScheduleItemDto,
  ) {
    const activeSemester = await this.getActiveSemester(classroomId);
    const existing = await this.getScheduleItemById(classroomId, itemId);

    let targetCourseId = existing.courseId;
    if (dto.courseId && dto.courseId !== existing.courseId) {
      const course = await this.courseRepo.findOne({
        where: { id: dto.courseId, classroomId, semesterId: activeSemester.id },
      });
      if (!course) {
        throw new NotFoundException('Course not found in active semester');
      }
      targetCourseId = dto.courseId;
    }

    const nextStart = dto.startTime
      ? this.normalizeTime(dto.startTime)
      : existing.startTime;
    const nextEnd = dto.endTime
      ? this.normalizeTime(dto.endTime)
      : existing.endTime;
    const nextDay = dto.dayOfWeek ?? existing.dayOfWeek;

    this.validateTimeRange(nextStart, nextEnd);
    await this.ensureNoTimeConflict(
      classroomId,
      activeSemester.id,
      nextDay,
      nextStart,
      nextEnd,
      existing.id,
    );

    Object.assign(existing, {
      courseId: targetCourseId,
      dayOfWeek: nextDay,
      startTime: nextStart,
      endTime: nextEnd,
      ...(dto.type !== undefined && { type: dto.type as ScheduleType }),
      ...(dto.location !== undefined && { location: dto.location || null }),
      ...(dto.isOnline !== undefined && { isOnline: dto.isOnline }),
      ...(dto.isDraft !== undefined && { isDraft: dto.isDraft }),
      ...(dto.isDraft === true && { confirmedAt: null, confirmedById: null }),
      ...(dto.fireMode !== undefined && {
        fireMode: dto.fireMode as ScheduleFireMode,
      }),
    });

    const saved = await this.scheduleRepo.save(existing);
    return this.getScheduleItemById(classroomId, saved.id);
  }

  async deleteScheduleItem(classroomId: string, itemId: string) {
    const existing = await this.getScheduleItemById(classroomId, itemId);
    await this.scheduleRepo.remove(existing);
    return { deleted: true };
  }

  async publishScheduleDrafts(classroomId: string) {
    const activeSemester = await this.getActiveSemester(classroomId);
    const draftIdsRaw = await this.scheduleRepo
      .createQueryBuilder('schedule')
      .innerJoin('schedule.course', 'course')
      .where('course.classroomId = :classroomId', { classroomId })
      .andWhere('course.semesterId = :semesterId', {
        semesterId: activeSemester.id,
      })
      .andWhere('schedule.isDraft = :isDraft', { isDraft: true })
      .select('schedule.id', 'id')
      .getRawMany<{ id: string }>();

    const ids = draftIdsRaw.map((row) => row.id);
    if (!ids.length) return { updated: 0 };

    await this.scheduleRepo.update({ id: In(ids) }, { isDraft: false });
    return { updated: ids.length };
  }

  async confirmScheduleItem(
    classroomId: string,
    itemId: string,
    userId: string,
  ) {
    const existing = await this.getScheduleItemById(classroomId, itemId);
    if (existing.isDraft) {
      throw new BadRequestException('Draft schedule item cannot be confirmed');
    }

    existing.confirmedAt = new Date();
    existing.confirmedById = userId;

    const saved = await this.scheduleRepo.save(existing);
    return this.getScheduleItemById(classroomId, saved.id);
  }

  async unconfirmScheduleItem(classroomId: string, itemId: string) {
    const existing = await this.getScheduleItemById(classroomId, itemId);
    existing.confirmedAt = null;
    existing.confirmedById = null;

    const saved = await this.scheduleRepo.save(existing);
    return this.getScheduleItemById(classroomId, saved.id);
  }

  async getWeeklySchedule(classroomId: string) {
    // 1. Get the active semester for this classroom
    const activeSemester = await this.semesterRepo.findOne({
      where: { classroomId, isActive: true },
      select: ['id'],
    });

    // New classrooms may not have any semester configured yet.
    // For schedule reads, return an empty list instead of a 404.
    if (!activeSemester) {
      return [];
    }

    // 2. Fetch all schedule items linked to courses in this active semester
    // Using QueryBuilder for efficiency
    return (
      this.scheduleRepo
        .createQueryBuilder('schedule')
        .innerJoinAndSelect('schedule.course', 'course')
        .where('course.semesterId = :semesterId', {
          semesterId: activeSemester.id,
        })
        // .andWhere('schedule.isDraft = false') // Optional: only show published to students
        .orderBy('schedule.dayOfWeek', 'ASC')
        .addOrderBy('schedule.startTime', 'ASC')
        .getMany()
    );
  }

  async getDashboardQuickStats(
    classroomId: string,
  ): Promise<DashboardQuickStats> {
    const activeSemester = await this.semesterRepo.findOne({
      where: { classroomId, isActive: true },
      select: ['id'],
    });

    if (!activeSemester) {
      return {
        remainingClasses: 0,
        pendingAssignments: 0,
        upcomingExams: 0,
      };
    }

    const scheduleItems = await this.scheduleRepo
      .createQueryBuilder('schedule')
      .innerJoin('schedule.course', 'course')
      .where('course.classroomId = :classroomId', { classroomId })
      .andWhere('course.semesterId = :semesterId', {
        semesterId: activeSemester.id,
      })
      .andWhere('schedule.isDraft = :isDraft', { isDraft: false })
      .orderBy('schedule.dayOfWeek', 'ASC')
      .addOrderBy('schedule.startTime', 'ASC')
      .getMany();

    const now = new Date();
    const today = now.getUTCDay();
    const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

    const remainingClasses = scheduleItems.filter((item) => {
      if (item.type === ScheduleType.EXAM) return false;
      if (item.dayOfWeek !== today) return false;
      return this.timeToMinutes(item.endTime) > nowMinutes;
    }).length;

    const upcomingExams = this.countExamOccurrencesForRestOfMonth(
      scheduleItems,
      now,
    );

    const pendingAssignments = await this.assessmentRepo.count({
      where: {
        classroomId,
        semesterId: activeSemester.id,
        status: AssessmentStatus.PENDING,
      },
    });

    return {
      remainingClasses,
      pendingAssignments,
      upcomingExams,
    };
  }

  // ================= ASSESSMENTS =================
  async getAssessments(
    classroomId: string,
    query: AssessmentQueryDto,
    userId: string,
  ) {
    const targetSemesterId = await this.resolveAssessmentSemesterId(
      classroomId,
      query.semesterId,
    );
    if (!targetSemesterId) return [];

    const qb = this.assessmentRepo
      .createQueryBuilder('assessment')
      .where('assessment.classroomId = :classroomId', { classroomId })
      .andWhere('assessment.semesterId = :semesterId', {
        semesterId: targetSemesterId,
      });

    if (query.courseCode) {
      qb.andWhere('assessment.courseCode = :courseCode', {
        courseCode: query.courseCode,
      });
    }

    if (query.type) {
      qb.andWhere('assessment.type = :type', { type: query.type });
    }

    if (query.status) {
      qb.andWhere('assessment.status = :status', { status: query.status });
    }

    if (query.source) {
      qb.andWhere('assessment.source = :source', { source: query.source });
    }

    if (query.search) {
      qb.andWhere(
        '(assessment.title LIKE :search OR assessment.courseCode LIKE :search OR assessment.description LIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('assessment.dueDate IS NULL', 'ASC')
      .addOrderBy('assessment.dueDate', 'ASC')
      .addOrderBy('assessment.createdAt', 'DESC');

    const items = await qb.getMany();
    const confidenceMeta = await this.getConfidenceMeta(
      items.map((item) => item.id),
      userId,
    );

    return items.map((assessment) =>
      this.toAssessmentResponse(
        assessment,
        confidenceMeta.countsByAssessmentId.get(assessment.id),
        confidenceMeta.userVoteByAssessmentId.get(assessment.id) ?? null,
      ),
    );
  }

  async getAssessmentStats(classroomId: string, query: AssessmentQueryDto) {
    const targetSemesterId = await this.resolveAssessmentSemesterId(
      classroomId,
      query.semesterId,
    );
    if (!targetSemesterId) {
      return { total: 0, pending: 0, submitted: 0, overdue: 0 };
    }

    const baseQb = this.assessmentRepo
      .createQueryBuilder('assessment')
      .where('assessment.classroomId = :classroomId', { classroomId })
      .andWhere('assessment.semesterId = :semesterId', {
        semesterId: targetSemesterId,
      });

    if (query.courseCode) {
      baseQb.andWhere('assessment.courseCode = :courseCode', {
        courseCode: query.courseCode,
      });
    }

    if (query.type) {
      baseQb.andWhere('assessment.type = :type', { type: query.type });
    }

    if (query.status) {
      baseQb.andWhere('assessment.status = :status', { status: query.status });
    }

    if (query.source) {
      baseQb.andWhere('assessment.source = :source', { source: query.source });
    }

    if (query.search) {
      baseQb.andWhere(
        '(assessment.title LIKE :search OR assessment.courseCode LIKE :search OR assessment.description LIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const today = new Date().toISOString().split('T')[0];

    const [total, pending, submitted, overdue] = await Promise.all([
      baseQb.clone().getCount(),
      baseQb
        .clone()
        .andWhere('assessment.status = :pendingStatus', {
          pendingStatus: AssessmentStatus.PENDING,
        })
        .getCount(),
      baseQb
        .clone()
        .andWhere('assessment.status IN (:...submittedStatuses)', {
          submittedStatuses: [
            AssessmentStatus.SUBMITTED,
            AssessmentStatus.GRADED,
          ],
        })
        .getCount(),
      baseQb
        .clone()
        .andWhere('assessment.status = :pendingStatus', {
          pendingStatus: AssessmentStatus.PENDING,
        })
        .andWhere('assessment.dueDate < :today', { today })
        .getCount(),
    ]);

    return { total, pending, submitted, overdue };
  }

  async createAssessment(
    classroomId: string,
    authorId: string,
    dto: CreateAssessmentDto,
  ) {
    const semester = await this.semesterRepo.findOne({
      where: { id: dto.semesterId, classroomId },
      select: ['id'],
    });
    if (!semester) {
      throw new NotFoundException('Semester not found');
    }

    const assessment = this.assessmentRepo.create({
      classroomId,
      semesterId: dto.semesterId,
      title: dto.title,
      type: dto.type,
      courseCode: dto.courseCode,
      dueDate: dto.dueDate ?? null,
      description: dto.description?.trim() || null,
      maxScore: dto.maxScore ?? 100,
      weight: dto.weight ?? 10,
      status: dto.status ?? AssessmentStatus.PENDING,
      source: dto.source ?? AssessmentSource.CLASSROOM,
      authorId,
    });

    const saved = await this.assessmentRepo.save(assessment);
    return this.toAssessmentResponse(saved);
  }

  async updateAssessment(
    classroomId: string,
    assessmentId: string,
    dto: UpdateAssessmentDto,
  ) {
    const assessment = await this.assessmentRepo.findOne({
      where: { id: assessmentId, classroomId },
    });
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    if (dto.semesterId && dto.semesterId !== assessment.semesterId) {
      const semester = await this.semesterRepo.findOne({
        where: { id: dto.semesterId, classroomId },
        select: ['id'],
      });
      if (!semester) {
        throw new NotFoundException('Semester not found');
      }
    }

    Object.assign(assessment, {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.courseCode !== undefined && { courseCode: dto.courseCode }),
      ...(dto.dueDate !== undefined && { dueDate: dto.dueDate }),
      ...(dto.description !== undefined && {
        description: dto.description?.trim() || null,
      }),
      ...(dto.maxScore !== undefined && { maxScore: dto.maxScore }),
      ...(dto.weight !== undefined && { weight: dto.weight }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.source !== undefined && { source: dto.source }),
      ...(dto.semesterId !== undefined && { semesterId: dto.semesterId }),
    });

    const saved = await this.assessmentRepo.save(assessment);
    return this.toAssessmentResponse(saved);
  }

  async deleteAssessment(classroomId: string, assessmentId: string) {
    const assessment = await this.assessmentRepo.findOne({
      where: { id: assessmentId, classroomId },
      select: ['id', 'classroomId'],
    });
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    await this.assessmentRepo.remove(assessment);
    return { deleted: true };
  }

  async rateAssessment(
    classroomId: string,
    assessmentId: string,
    userId: string,
    vote: AssessmentConfidenceVote,
  ) {
    await this.assertAssessmentExists(classroomId, assessmentId);

    let rating = await this.assessmentRatingRepo.findOne({
      where: { assessmentId, userId },
    });

    if (rating) {
      rating.vote = vote;
    } else {
      rating = this.assessmentRatingRepo.create({
        assessmentId,
        classroomId,
        userId,
        vote,
      });
    }

    await this.assessmentRatingRepo.save(rating);
    return { saved: true };
  }

  async clearAssessmentRating(
    classroomId: string,
    assessmentId: string,
    userId: string,
  ) {
    await this.assertAssessmentExists(classroomId, assessmentId);

    const existing = await this.assessmentRatingRepo.findOne({
      where: { assessmentId, userId },
      select: ['id'],
    });

    if (!existing) {
      return { deleted: false };
    }

    await this.assessmentRatingRepo.delete(existing.id);
    return { deleted: true };
  }

  private async getScheduleItemById(classroomId: string, itemId: string) {
    const item = await this.scheduleRepo
      .createQueryBuilder('schedule')
      .innerJoinAndSelect('schedule.course', 'course')
      .where('schedule.id = :itemId', { itemId })
      .andWhere('course.classroomId = :classroomId', { classroomId })
      .getOne();

    if (!item) {
      throw new NotFoundException('Schedule item not found');
    }
    return item;
  }

  private validateTimeRange(startTime: string, endTime: string) {
    const start = this.timeToMinutes(startTime);
    const end = this.timeToMinutes(endTime);
    if (end <= start) {
      throw new BadRequestException('End time must be after start time');
    }
  }

  private async ensureNoTimeConflict(
    classroomId: string,
    semesterId: string,
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    excludeId?: string,
  ) {
    const qb = this.scheduleRepo
      .createQueryBuilder('schedule')
      .innerJoin('schedule.course', 'course')
      .where('course.classroomId = :classroomId', { classroomId })
      .andWhere('course.semesterId = :semesterId', { semesterId })
      .andWhere('schedule.dayOfWeek = :dayOfWeek', { dayOfWeek });

    if (excludeId) {
      qb.andWhere('schedule.id != :excludeId', { excludeId });
    }

    const sameDayItems = await qb.getMany();
    const nextStart = this.timeToMinutes(startTime);
    const nextEnd = this.timeToMinutes(endTime);

    const hasOverlap = sameDayItems.some((item) => {
      const existingStart = this.timeToMinutes(item.startTime);
      const existingEnd = this.timeToMinutes(item.endTime);
      return nextStart < existingEnd && existingStart < nextEnd;
    });

    if (hasOverlap) {
      throw new BadRequestException(
        'Schedule item overlaps with an existing class',
      );
    }
  }

  private timeToMinutes(value: string): number {
    const [hourStr, minuteStr] = value.split(':');
    const hours = Number(hourStr);
    const minutes = Number(minuteStr);
    return hours * 60 + minutes;
  }

  private normalizeTime(value: string) {
    const [hours, minutes] = value.split(':');
    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00`;
  }

  private countExamOccurrencesForRestOfMonth(
    scheduleItems: ScheduleItem[],
    now: Date,
  ): number {
    const exams = scheduleItems.filter(
      (item) => item.type === ScheduleType.EXAM,
    );
    if (exams.length === 0) return 0;

    const endOfMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999),
    );

    let total = 0;

    for (const exam of exams) {
      const firstOccurrence = this.getNextOccurrence(
        exam.dayOfWeek,
        exam.startTime,
        now,
      );
      if (!firstOccurrence) continue;

      const cursor = new Date(firstOccurrence);
      while (cursor <= endOfMonth) {
        total += 1;
        cursor.setUTCDate(cursor.getUTCDate() + 7);
      }
    }

    return total;
  }

  private toAssessmentResponse(
    assessment: Assessment,
    distribution?: {
      confident: number;
      neutral: number;
      struggling: number;
      total: number;
    },
    userConfidence?: AssessmentConfidenceVote | null,
  ) {
    const counts = distribution || {
      confident: 0,
      neutral: 0,
      struggling: 0,
      total: 0,
    };
    const total = counts.total;
    const percentages =
      total > 0
        ? {
            confident: Math.round((counts.confident / total) * 100),
            neutral: Math.round((counts.neutral / total) * 100),
            struggling: Math.round((counts.struggling / total) * 100),
          }
        : { confident: 0, neutral: 0, struggling: 0 };

    return {
      id: assessment.id,
      title: assessment.title,
      type: assessment.type,
      courseCode: assessment.courseCode,
      dueDate: assessment.dueDate ?? null,
      description: assessment.description || '',
      maxScore: assessment.maxScore,
      weight: assessment.weight,
      status: assessment.status,
      source: assessment.source,
      semesterId: assessment.semesterId,
      confidenceDistribution: counts,
      confidencePercentages: percentages,
      userConfidence: userConfidence ?? null,
      createdAt: assessment.createdAt,
      updatedAt: assessment.updatedAt,
    };
  }

  private async assertAssessmentExists(
    classroomId: string,
    assessmentId: string,
  ) {
    const assessment = await this.assessmentRepo.findOne({
      where: { id: assessmentId, classroomId },
      select: ['id'],
    });
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }
  }

  private async getConfidenceMeta(assessmentIds: string[], userId: string) {
    const countsByAssessmentId = new Map<
      string,
      { confident: number; neutral: number; struggling: number; total: number }
    >();
    const userVoteByAssessmentId = new Map<string, AssessmentConfidenceVote>();

    if (assessmentIds.length === 0) {
      return { countsByAssessmentId, userVoteByAssessmentId };
    }

    const rows = await this.assessmentRatingRepo
      .createQueryBuilder('rating')
      .select('rating.assessmentId', 'assessmentId')
      .addSelect('rating.vote', 'vote')
      .addSelect('COUNT(*)', 'count')
      .where('rating.assessmentId IN (:...assessmentIds)', { assessmentIds })
      .groupBy('rating.assessmentId')
      .addGroupBy('rating.vote')
      .getRawMany<{
        assessmentId: string;
        vote: AssessmentConfidenceVote;
        count: string;
      }>();

    for (const row of rows) {
      const current = countsByAssessmentId.get(row.assessmentId) || {
        confident: 0,
        neutral: 0,
        struggling: 0,
        total: 0,
      };
      const value = Number(row.count);
      if (row.vote === AssessmentConfidenceVote.CONFIDENT)
        current.confident = value;
      if (row.vote === AssessmentConfidenceVote.NEUTRAL)
        current.neutral = value;
      if (row.vote === AssessmentConfidenceVote.STRUGGLING)
        current.struggling = value;
      current.total = current.confident + current.neutral + current.struggling;
      countsByAssessmentId.set(row.assessmentId, current);
    }

    const userVotes = await this.assessmentRatingRepo.find({
      where: { assessmentId: In(assessmentIds), userId },
      select: ['assessmentId', 'vote'],
    });

    for (const vote of userVotes) {
      userVoteByAssessmentId.set(vote.assessmentId, vote.vote);
    }

    return { countsByAssessmentId, userVoteByAssessmentId };
  }

  private async resolveAssessmentSemesterId(
    classroomId: string,
    semesterId?: string,
  ) {
    if (semesterId) {
      const semester = await this.semesterRepo.findOne({
        where: { id: semesterId, classroomId },
        select: ['id'],
      });
      if (!semester) {
        throw new NotFoundException('Semester not found');
      }
      return semester.id;
    }

    const activeSemester = await this.semesterRepo.findOne({
      where: { classroomId, isActive: true },
      select: ['id'],
    });

    return activeSemester?.id || null;
  }

  private getNextOccurrence(
    dayOfWeek: number,
    startTime: string,
    from: Date,
  ): Date | null {
    if (dayOfWeek < 0 || dayOfWeek > 6) return null;

    const [hourRaw = '0', minuteRaw = '0', secondRaw = '0'] =
      startTime.split(':');
    const hours = Number(hourRaw);
    const minutes = Number(minuteRaw);
    const seconds = Number(secondRaw);

    const base = new Date(from);
    base.setUTCSeconds(0, 0);

    let dayDiff = dayOfWeek - base.getUTCDay();
    if (dayDiff < 0) dayDiff += 7;

    const next = new Date(base);
    next.setUTCDate(base.getUTCDate() + dayDiff);
    next.setUTCHours(hours, minutes, seconds, 0);

    if (next <= base) {
      next.setUTCDate(next.getUTCDate() + 7);
    }

    return next;
  }
}
