import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DeepPartial } from 'typeorm';
import { Semester } from './entities/semester.entity';
import { Course } from './entities/course.entity';
import { CourseGroupFormation } from './entities/course-group-formation.entity';
import { CourseGroup } from './entities/course-group.entity';
import {
  CourseGroupMember,
  CourseGroupMemberRole,
  CourseGroupMemberStatus,
} from './entities/course-group-member.entity';
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
  AssessmentType,
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
import { DashboardDeadlineFeedQueryDto } from './dto/dashboard-deadline-feed-query.dto';
import { ClassroomMember } from '../classrooms/entities/classroom-member.entity';
import { UserRole } from '../users/entities/user.entity';

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

type DashboardDeadlineFeedItemType =
  | 'assignment'
  | 'quiz'
  | 'exam'
  | 'project'
  | 'other'
  | 'exam_reminder'
  | 'exam_countdown';

type DashboardDeadlineFeedItemUrgency =
  | 'overdue'
  | 'today'
  | 'soon'
  | 'upcoming'
  | 'later';

interface DashboardDeadlineFeedItem {
  id: string;
  source: 'assessment' | 'schedule' | 'semester';
  type: DashboardDeadlineFeedItemType;
  title: string;
  subtitle: string;
  courseCode: string | null;
  dueAt: string;
  daysUntilDue: number;
  urgency: DashboardDeadlineFeedItemUrgency;
  weekBucket: 'this_week' | 'next_week';
  status?: AssessmentStatus;
}

export interface DashboardDeadlineFeedResponse {
  quickStats: DashboardQuickStats;
  meta: {
    totalMatching: number;
    shownCount: number;
    remainingCount: number;
    thisWeekCount: number;
    nextWeekCount: number;
  };
  items: DashboardDeadlineFeedItem[];
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
    @InjectRepository(CourseGroupFormation)
    private groupFormationRepo: Repository<CourseGroupFormation>,
    @InjectRepository(CourseGroup)
    private groupRepo: Repository<CourseGroup>,
    @InjectRepository(CourseGroupMember)
    private groupMemberRepo: Repository<CourseGroupMember>,
    @InjectRepository(ClassroomMember)
    private classroomMemberRepo: Repository<ClassroomMember>,
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

  async listGroupFormations(classroomId: string, userId: string) {
    const formations = await this.groupFormationRepo.find({
      where: { classroomId, isActive: true },
      relations: [
        'course',
        'groups',
        'groups.members',
        'groups.members.user',
      ],
      order: { createdAt: 'DESC' },
    });
    return formations.map((formation) =>
      this.toFormationResponse(formation, userId),
    );
  }

  async getGroupFormation(
    classroomId: string,
    formationId: string,
    userId: string,
  ) {
    const formation = await this.findFormationForResponse(
      classroomId,
      formationId,
    );
    return this.toFormationResponse(formation, userId);
  }

  async upsertGroupFormation(
    classroomId: string,
    courseId: string,
    userId: string,
    dto: { maxMembers?: number; isActive?: boolean },
  ) {
    await this.getCourseById(classroomId, courseId);
    const maxMembers = this.normalizeMaxGroupMembers(dto.maxMembers);
    let formation = await this.groupFormationRepo.findOne({
      where: { classroomId, courseId },
    });

    if (formation) {
      formation.maxMembers = maxMembers;
      if (dto.isActive !== undefined) formation.isActive = Boolean(dto.isActive);
    } else {
      formation = this.groupFormationRepo.create({
        classroomId,
        courseId,
        maxMembers,
        isActive: dto.isActive ?? true,
        createdById: userId,
      });
    }

    const saved = await this.groupFormationRepo.save(formation);
    return this.getGroupFormation(classroomId, saved.id, userId);
  }

  async updateGroupFormation(
    classroomId: string,
    formationId: string,
    userId: string,
    dto: { maxMembers?: number; isActive?: boolean },
  ) {
    const formation = await this.groupFormationRepo.findOne({
      where: { id: formationId, classroomId },
    });
    if (!formation) throw new NotFoundException('Group formation not found');
    if (dto.maxMembers !== undefined) {
      formation.maxMembers = this.normalizeMaxGroupMembers(dto.maxMembers);
    }
    if (dto.isActive !== undefined) formation.isActive = Boolean(dto.isActive);
    const saved = await this.groupFormationRepo.save(formation);
    return this.getGroupFormation(classroomId, saved.id, userId);
  }

  async deleteGroupFormation(classroomId: string, formationId: string) {
    const formation = await this.groupFormationRepo.findOne({
      where: { id: formationId, classroomId },
    });
    if (!formation) throw new NotFoundException('Group formation not found');
    await this.groupFormationRepo.remove(formation);
    return { deleted: true };
  }

  async createGroup(
    classroomId: string,
    formationId: string,
    userId: string,
    dto: { name?: string; hideIdentity?: boolean },
  ) {
    const formation = await this.groupFormationRepo.findOne({
      where: { id: formationId, classroomId, isActive: true },
      relations: ['course'],
    });
    if (!formation) throw new NotFoundException('Group formation not found');
    await this.assertUserInClassroom(classroomId, userId);
    await this.assertNoJoinedGroupInFormation(formationId, userId);

    const groupCount = await this.groupRepo.count({ where: { formationId } });
    const fallbackName = `Group ${groupCount + 1}`;
    const name = this.normalizeGroupName(dto.name, fallbackName);

    const group = this.groupRepo.create({
      classroomId,
      formationId,
      name,
      createdById: userId,
    });
    const savedGroup = await this.groupRepo.save(group);
    await this.groupMemberRepo.save(
      this.groupMemberRepo.create({
        classroomId,
        groupId: savedGroup.id,
        userId,
        status: CourseGroupMemberStatus.JOINED,
        role: CourseGroupMemberRole.LEADER,
        hideIdentity: Boolean(dto.hideIdentity),
        respondedAt: new Date(),
      }),
    );

    return this.getGroupFormation(classroomId, formationId, userId);
  }

  async joinGroup(
    classroomId: string,
    groupId: string,
    userId: string,
    dto: { hideIdentity?: boolean },
  ) {
    const group = await this.findGroupWithFormation(classroomId, groupId);
    await this.assertUserInClassroom(classroomId, userId);
    await this.assertNoJoinedGroupInFormation(group.formationId, userId);
    await this.assertGroupHasCapacity(group);

    const joinedCount = this.countJoinedMembers(group);
    await this.groupMemberRepo.save(
      this.groupMemberRepo.create({
        classroomId,
        groupId,
        userId,
        status: CourseGroupMemberStatus.JOINED,
        role:
          joinedCount === 0
            ? CourseGroupMemberRole.LEADER
            : CourseGroupMemberRole.MEMBER,
        hideIdentity: Boolean(dto.hideIdentity),
        respondedAt: new Date(),
      }),
    );
    await this.ensureGroupHasLeader(groupId);
    return this.getGroupFormation(classroomId, group.formationId, userId);
  }

  async inviteToGroup(
    classroomId: string,
    groupId: string,
    leaderId: string,
    dto: { userId: string },
  ) {
    const inviteeId = String(dto.userId || '').trim();
    if (!inviteeId) throw new BadRequestException('Invitee is required');
    const group = await this.findGroupWithFormation(classroomId, groupId);
    await this.assertGroupLeader(groupId, leaderId);
    await this.assertUserInClassroom(classroomId, inviteeId);
    await this.assertNoJoinedGroupInFormation(group.formationId, inviteeId);
    await this.assertGroupHasCapacity(group);

    const existing = group.members.find((member) => member.userId === inviteeId);
    if (existing?.status === CourseGroupMemberStatus.INVITED) {
      throw new BadRequestException('Invite already sent');
    }
    if (existing?.status === CourseGroupMemberStatus.JOINED) {
      throw new BadRequestException('User is already in this group');
    }

    const invite = existing || this.groupMemberRepo.create({ groupId, userId: inviteeId, classroomId });
    invite.status = CourseGroupMemberStatus.INVITED;
    invite.role = CourseGroupMemberRole.MEMBER;
    invite.hideIdentity = false;
    invite.invitedById = leaderId;
    invite.respondedAt = null;
    await this.groupMemberRepo.save(invite);

    return this.getGroupFormation(classroomId, group.formationId, leaderId);
  }

  async respondToGroupInvite(
    classroomId: string,
    membershipId: string,
    userId: string,
    action: 'accept' | 'reject',
    dto?: { hideIdentity?: boolean },
  ) {
    const membership = await this.groupMemberRepo.findOne({
      where: { id: membershipId, classroomId, userId },
      relations: ['group', 'group.formation', 'group.members'],
    });
    if (!membership || membership.status !== CourseGroupMemberStatus.INVITED) {
      throw new NotFoundException('Pending invite not found');
    }

    if (action === 'reject') {
      membership.status = CourseGroupMemberStatus.REJECTED;
      membership.respondedAt = new Date();
      await this.groupMemberRepo.save(membership);
      return this.getGroupFormation(classroomId, membership.group.formationId, userId);
    }

    await this.assertNoJoinedGroupInFormation(membership.group.formationId, userId);
    await this.assertGroupHasCapacity(membership.group);
    membership.status = CourseGroupMemberStatus.JOINED;
    membership.role =
      this.countJoinedMembers(membership.group) === 0
        ? CourseGroupMemberRole.LEADER
        : CourseGroupMemberRole.MEMBER;
    membership.hideIdentity = Boolean(dto?.hideIdentity);
    membership.respondedAt = new Date();
    await this.groupMemberRepo.save(membership);
    await this.ensureGroupHasLeader(membership.groupId);
    return this.getGroupFormation(classroomId, membership.group.formationId, userId);
  }

  async transferGroupLeadership(
    classroomId: string,
    groupId: string,
    leaderId: string,
    dto: { userId: string },
  ) {
    const targetUserId = String(dto.userId || '').trim();
    const group = await this.findGroupWithFormation(classroomId, groupId);
    await this.assertGroupLeader(groupId, leaderId);
    const target = group.members.find(
      (member) =>
        member.userId === targetUserId &&
        member.status === CourseGroupMemberStatus.JOINED,
    );
    if (!target) {
      throw new BadRequestException('Leadership can only transfer to a joined member');
    }

    const updates = group.members
      .filter((member) => member.status === CourseGroupMemberStatus.JOINED)
      .map((member) => {
        member.role =
          member.userId === targetUserId
            ? CourseGroupMemberRole.LEADER
            : CourseGroupMemberRole.MEMBER;
        return member;
      });
    await this.groupMemberRepo.save(updates);
    return this.getGroupFormation(classroomId, group.formationId, leaderId);
  }

  async updateMyGroupPrivacy(
    classroomId: string,
    groupId: string,
    userId: string,
    dto: { hideIdentity?: boolean },
  ) {
    const group = await this.findGroupWithFormation(classroomId, groupId);
    const member = group.members.find(
      (item) =>
        item.userId === userId && item.status === CourseGroupMemberStatus.JOINED,
    );
    if (!member) throw new NotFoundException('Joined group membership not found');
    member.hideIdentity = Boolean(dto.hideIdentity);
    await this.groupMemberRepo.save(member);
    return this.getGroupFormation(classroomId, group.formationId, userId);
  }

  async leaveGroup(classroomId: string, groupId: string, userId: string) {
    const group = await this.findGroupWithFormation(classroomId, groupId);
    const member = group.members.find(
      (item) =>
        item.userId === userId && item.status === CourseGroupMemberStatus.JOINED,
    );
    if (!member) throw new NotFoundException('Joined group membership not found');

    const joined = group.members.filter(
      (item) => item.status === CourseGroupMemberStatus.JOINED,
    );
    if (member.role === CourseGroupMemberRole.LEADER && joined.length > 1) {
      throw new BadRequestException('Transfer leadership before leaving');
    }

    await this.groupMemberRepo.remove(member);
    if (joined.length <= 1) {
      await this.groupRepo.remove(group);
    } else {
      await this.ensureGroupHasLeader(groupId);
    }
    return this.getGroupFormation(classroomId, group.formationId, userId);
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
      sessionName: dto.sessionName?.trim() || course.name,
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
      ...(dto.sessionName !== undefined && {
        sessionName: dto.sessionName.trim() || null,
      }),
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
    const feed = await this.getDashboardDeadlineFeed(classroomId, {
      limit: 12,
      daysAhead: 30,
    });
    return feed.quickStats;
  }

  async getDashboardDeadlineFeed(
    classroomId: string,
    query: DashboardDeadlineFeedQueryDto,
  ): Promise<DashboardDeadlineFeedResponse> {
    const requestedLimit = query.limit ?? 10;
    const limit = Math.max(1, Math.min(requestedLimit, 10));
    const now = new Date();
    const todayDate = now.toISOString().split('T')[0];
    const daysLeftInThisWeek = 6 - now.getUTCDay();
    const nextWeekMaxDays = daysLeftInThisWeek + 7;
    const horizon = new Date(now);
    horizon.setUTCDate(horizon.getUTCDate() + nextWeekMaxDays);
    const horizonDate = horizon.toISOString().split('T')[0];

    const activeSemester = await this.semesterRepo.findOne({
      where: { classroomId, isActive: true },
      select: ['id', 'examPeriod'],
    });

    if (!activeSemester) {
      return {
        quickStats: {
          remainingClasses: 0,
          pendingAssignments: 0,
          upcomingExams: 0,
        },
        meta: {
          totalMatching: 0,
          shownCount: 0,
          remainingCount: 0,
          thisWeekCount: 0,
          nextWeekCount: 0,
        },
        items: [],
      };
    }

    const [scheduleItems, pendingAssignments, pendingAssessments] =
      await Promise.all([
        this.scheduleRepo
          .createQueryBuilder('schedule')
          .innerJoinAndSelect('schedule.course', 'course')
          .where('course.classroomId = :classroomId', { classroomId })
          .andWhere('course.semesterId = :semesterId', {
            semesterId: activeSemester.id,
          })
          .andWhere('schedule.isDraft = :isDraft', { isDraft: false })
          .orderBy('schedule.dayOfWeek', 'ASC')
          .addOrderBy('schedule.startTime', 'ASC')
          .getMany(),
        this.assessmentRepo.count({
          where: {
            classroomId,
            semesterId: activeSemester.id,
            status: AssessmentStatus.PENDING,
          },
        }),
        this.assessmentRepo
          .createQueryBuilder('assessment')
          .where('assessment.classroomId = :classroomId', { classroomId })
          .andWhere('assessment.semesterId = :semesterId', {
            semesterId: activeSemester.id,
          })
          .andWhere('assessment.status = :status', {
            status: AssessmentStatus.PENDING,
          })
          .andWhere('assessment.dueDate IS NOT NULL')
          .andWhere('assessment.dueDate >= :todayDate', { todayDate })
          .andWhere('assessment.dueDate <= :horizonDate', { horizonDate })
          .orderBy('assessment.dueDate', 'ASC')
          .addOrderBy('assessment.createdAt', 'DESC')
          .take(64)
          .getMany(),
      ]);

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

    const quickStats: DashboardQuickStats = {
      remainingClasses,
      pendingAssignments,
      upcomingExams,
    };

    const allMatchingItems: DashboardDeadlineFeedItem[] = [];

    for (const assessment of pendingAssessments) {
      if (!assessment.dueDate) continue;
      const daysUntilDue = this.getDaysUntilDate(assessment.dueDate, now);
      const weekBucket = this.getWeekBucket(daysUntilDue, daysLeftInThisWeek);
      if (!weekBucket) continue;
      allMatchingItems.push({
        id: `assessment:${assessment.id}`,
        source: 'assessment',
        type: this.mapAssessmentTypeToFeedType(assessment.type),
        title: assessment.title,
        subtitle: `${assessment.courseCode} · ${this.getUrgencyLabel(daysUntilDue)}`,
        courseCode: assessment.courseCode,
        dueAt: this.toNoonUtcIso(assessment.dueDate),
        daysUntilDue,
        urgency: this.getUrgency(daysUntilDue),
        weekBucket,
        status: assessment.status,
      });
    }

    for (const exam of scheduleItems.filter(
      (item) => item.type === ScheduleType.EXAM,
    )) {
      const nextOccurrence = this.getNextOccurrence(exam.dayOfWeek, exam.startTime, now);
      if (!nextOccurrence || nextOccurrence > horizon) continue;
      const daysUntilDue = this.getDaysUntilDateTime(nextOccurrence, now);
      const weekBucket = this.getWeekBucket(daysUntilDue, daysLeftInThisWeek);
      if (!weekBucket) continue;
      const courseLabel = exam.course?.code || exam.course?.name || 'Course';
      const sessionName = exam.sessionName?.trim();
      allMatchingItems.push({
        id: `schedule-exam:${exam.id}`,
        source: 'schedule',
        type: 'exam_reminder',
        title: sessionName
          ? `${sessionName} (${courseLabel})`
          : `${courseLabel} Exam`,
        subtitle: `Scheduled exam · ${this.getUrgencyLabel(daysUntilDue)}`,
        courseCode: exam.course?.code || null,
        dueAt: nextOccurrence.toISOString(),
        daysUntilDue,
        urgency: this.getUrgency(daysUntilDue),
        weekBucket,
      });
    }

    const examPeriod = activeSemester.examPeriod;
    if (
      examPeriod?.start &&
      /^\d{4}-\d{2}-\d{2}$/.test(examPeriod.start)
    ) {
      const startDiff = this.getDaysUntilDate(examPeriod.start, now);
      const weekBucket = this.getWeekBucket(startDiff, daysLeftInThisWeek);
      if (weekBucket) {
        allMatchingItems.push({
          id: `semester-exam-start:${activeSemester.id}`,
          source: 'semester',
          type: 'exam_countdown',
          title: 'Exam period starts',
          subtitle: this.getUrgencyLabel(startDiff),
          courseCode: null,
          dueAt: this.toNoonUtcIso(examPeriod.start),
          daysUntilDue: startDiff,
          urgency: this.getUrgency(startDiff),
          weekBucket,
        });
      }
    }

    if (
      examPeriod?.end &&
      /^\d{4}-\d{2}-\d{2}$/.test(examPeriod.end)
    ) {
      const endDiff = this.getDaysUntilDate(examPeriod.end, now);
      const weekBucket = this.getWeekBucket(endDiff, daysLeftInThisWeek);
      if (weekBucket) {
        allMatchingItems.push({
          id: `semester-exam-end:${activeSemester.id}`,
          source: 'semester',
          type: 'exam_countdown',
          title: 'Exam period ends',
          subtitle: this.getUrgencyLabel(endDiff),
          courseCode: null,
          dueAt: this.toNoonUtcIso(examPeriod.end),
          daysUntilDue: endDiff,
          urgency: this.getUrgency(endDiff),
          weekBucket,
        });
      }
    }

    allMatchingItems.sort((a, b) => {
      if (a.daysUntilDue !== b.daysUntilDue) {
        return a.daysUntilDue - b.daysUntilDue;
      }
      return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    });

    const items = allMatchingItems.slice(0, limit);
    const thisWeekCount = allMatchingItems.filter(
      (item) => item.weekBucket === 'this_week',
    ).length;
    const nextWeekCount = allMatchingItems.filter(
      (item) => item.weekBucket === 'next_week',
    ).length;
    const totalMatching = allMatchingItems.length;
    const shownCount = items.length;
    const remainingCount = Math.max(totalMatching - shownCount, 0);

    return {
      quickStats,
      meta: {
        totalMatching,
        shownCount,
        remainingCount,
        thisWeekCount,
        nextWeekCount,
      },
      items,
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

  private normalizeMaxGroupMembers(value?: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 4;
    return Math.max(2, Math.min(20, Math.floor(parsed)));
  }

  private normalizeGroupName(value: unknown, fallback: string) {
    const normalized = String(value || '').trim();
    return (normalized || fallback).slice(0, 80);
  }

  private async assertUserInClassroom(classroomId: string, userId: string) {
    const membership = await this.classroomMemberRepo.findOne({
      where: { classroom: { id: classroomId }, user: { id: userId } },
      relations: ['user'],
    });
    if (!membership?.user) {
      throw new BadRequestException('User is not a member of this classroom');
    }
    return membership;
  }

  private async findFormationForResponse(
    classroomId: string,
    formationId: string,
  ) {
    const formation = await this.groupFormationRepo.findOne({
      where: { id: formationId, classroomId },
      relations: [
        'course',
        'groups',
        'groups.members',
        'groups.members.user',
      ],
      order: {
        groups: {
          createdAt: 'ASC',
          members: {
            createdAt: 'ASC',
          },
        },
      },
    });
    if (!formation) throw new NotFoundException('Group formation not found');
    return formation;
  }

  private async findGroupWithFormation(classroomId: string, groupId: string) {
    const group = await this.groupRepo.findOne({
      where: { id: groupId, classroomId },
      relations: ['formation', 'formation.course', 'members', 'members.user'],
    });
    if (!group) throw new NotFoundException('Group not found');
    return group;
  }

  private countJoinedMembers(group: CourseGroup) {
    return (group.members || []).filter(
      (member) => member.status === CourseGroupMemberStatus.JOINED,
    ).length;
  }

  private async assertGroupHasCapacity(group: CourseGroup) {
    const maxMembers = group.formation?.maxMembers || 4;
    if (this.countJoinedMembers(group) >= maxMembers) {
      throw new BadRequestException('Group is already full');
    }
  }

  private async assertNoJoinedGroupInFormation(
    formationId: string,
    userId: string,
  ) {
    const existing = await this.groupMemberRepo
      .createQueryBuilder('member')
      .innerJoin('member.group', 'group')
      .where('group.formationId = :formationId', { formationId })
      .andWhere('member.userId = :userId', { userId })
      .andWhere('member.status = :status', {
        status: CourseGroupMemberStatus.JOINED,
      })
      .getOne();
    if (existing) {
      throw new BadRequestException('You are already in a group for this course');
    }
  }

  private async assertGroupLeader(groupId: string, userId: string) {
    const leader = await this.groupMemberRepo.findOne({
      where: {
        groupId,
        userId,
        status: CourseGroupMemberStatus.JOINED,
        role: CourseGroupMemberRole.LEADER,
      },
    });
    if (!leader) throw new BadRequestException('Only the group leader can do this');
    return leader;
  }

  private async ensureGroupHasLeader(groupId: string) {
    const members = await this.groupMemberRepo.find({
      where: { groupId, status: CourseGroupMemberStatus.JOINED },
      order: { createdAt: 'ASC' },
    });
    if (!members.length) return;
    if (members.some((member) => member.role === CourseGroupMemberRole.LEADER)) {
      return;
    }
    members[0].role = CourseGroupMemberRole.LEADER;
    await this.groupMemberRepo.save(members[0]);
  }

  private toFormationResponse(formation: CourseGroupFormation, userId: string) {
    const groups = (formation.groups || []).map((group) => {
      const joinedMembers = (group.members || []).filter(
        (member) => member.status === CourseGroupMemberStatus.JOINED,
      );
      const pendingInvites = (group.members || []).filter(
        (member) => member.status === CourseGroupMemberStatus.INVITED,
      );
      const currentMember = (group.members || []).find(
        (member) => member.userId === userId,
      );
      const leader = joinedMembers.find(
        (member) => member.role === CourseGroupMemberRole.LEADER,
      );

      return {
        id: group.id,
        formationId: group.formationId,
        name: group.name,
        memberCount: joinedMembers.length,
        pendingInviteCount: pendingInvites.length,
        maxMembers: formation.maxMembers,
        isFull: joinedMembers.length >= formation.maxMembers,
        createdAt: group.createdAt,
        isCurrentUserMember:
          currentMember?.status === CourseGroupMemberStatus.JOINED,
        isCurrentUserInvited:
          currentMember?.status === CourseGroupMemberStatus.INVITED,
        currentUserRole:
          currentMember?.status === CourseGroupMemberStatus.JOINED
            ? currentMember.role
            : null,
        currentUserMembershipId: currentMember?.id || null,
        leaderName: leader ? this.toGroupMemberDisplay(leader, userId).name : null,
        members: joinedMembers.map((member) =>
          this.toGroupMemberDisplay(member, userId),
        ),
        invites: pendingInvites.map((member) =>
          this.toGroupMemberDisplay(member, userId),
        ),
      };
    });

    const myGroup = groups.find((group) => group.isCurrentUserMember) || null;
    const myInvites = groups
      .filter((group) => group.isCurrentUserInvited)
      .map((group) => ({
        groupId: group.id,
        groupName: group.name,
        membershipId: group.currentUserMembershipId,
      }));

    return {
      id: formation.id,
      courseId: formation.courseId,
      classroomId: formation.classroomId,
      maxMembers: formation.maxMembers,
      isActive: formation.isActive,
      createdAt: formation.createdAt,
      updatedAt: formation.updatedAt,
      course: formation.course
        ? {
            id: formation.course.id,
            name: formation.course.name,
            code: formation.course.code,
            instructor: formation.course.instructor,
          }
        : null,
      groups,
      myGroupId: myGroup?.id || null,
      myInvites,
    };
  }

  private toGroupMemberDisplay(member: CourseGroupMember, currentUserId: string) {
    const isSelf = member.userId === currentUserId;
    const hidden = member.hideIdentity && !isSelf;
    return {
      id: member.id,
      userId: hidden ? null : member.userId,
      name: hidden ? 'Anonymous member' : member.user?.name || 'Unknown',
      initials: hidden ? 'AM' : member.user?.initials || '??',
      role: member.role,
      status: member.status,
      hideIdentity: member.hideIdentity,
      isSelf,
      joinedAt: member.createdAt,
    };
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

  private mapAssessmentTypeToFeedType(
    type: AssessmentType,
  ): DashboardDeadlineFeedItemType {
    if (type === AssessmentType.EXAM) return 'exam';
    if (type === AssessmentType.QUIZ) return 'quiz';
    if (type === AssessmentType.PROJECT) return 'project';
    if (type === AssessmentType.ASSIGNMENT) return 'assignment';
    return 'other';
  }

  private getUrgency(daysUntilDue: number): DashboardDeadlineFeedItemUrgency {
    if (daysUntilDue < 0) return 'overdue';
    if (daysUntilDue === 0) return 'today';
    if (daysUntilDue <= 3) return 'soon';
    if (daysUntilDue <= 14) return 'upcoming';
    return 'later';
  }

  private getUrgencyLabel(daysUntilDue: number): string {
    if (daysUntilDue < 0) return `${Math.abs(daysUntilDue)}d overdue`;
    if (daysUntilDue === 0) return 'Due today';
    if (daysUntilDue === 1) return 'Due tomorrow';
    return `Due in ${daysUntilDue}d`;
  }

  private getWeekBucket(
    daysUntilDue: number,
    daysLeftInThisWeek: number,
  ): 'this_week' | 'next_week' | null {
    if (daysUntilDue < 0) return null;
    if (daysUntilDue <= daysLeftInThisWeek) return 'this_week';
    if (daysUntilDue <= daysLeftInThisWeek + 7) return 'next_week';
    return null;
  }

  private getDaysUntilDate(dateOnly: string, from: Date): number {
    const [yearRaw = '0', monthRaw = '0', dayRaw = '0'] = dateOnly.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    const day = Number(dayRaw);
    const target = Date.UTC(year, month - 1, day);
    const base = Date.UTC(
      from.getUTCFullYear(),
      from.getUTCMonth(),
      from.getUTCDate(),
    );
    return Math.floor((target - base) / 86_400_000);
  }

  private getDaysUntilDateTime(target: Date, from: Date): number {
    const targetDay = Date.UTC(
      target.getUTCFullYear(),
      target.getUTCMonth(),
      target.getUTCDate(),
    );
    const baseDay = Date.UTC(
      from.getUTCFullYear(),
      from.getUTCMonth(),
      from.getUTCDate(),
    );
    return Math.floor((targetDay - baseDay) / 86_400_000);
  }

  private toNoonUtcIso(dateOnly: string): string {
    return `${dateOnly}T12:00:00.000Z`;
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
