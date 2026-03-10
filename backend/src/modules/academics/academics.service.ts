import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Semester } from './entities/semester.entity';
import { Course } from './entities/course.entity';
import { ScheduleItem } from './entities/schedule-item.entity';
import {
  CreateCourseDto,
  UpdateCourseDto,
  CourseQueryDto,
} from './dto/course.dto';
import { CreateSemesterDto, UpdateSemesterDto } from './dto/semester.dto';

export interface CourseListResult {
  data: Course[];
  meta: {
    total: number;
    page: number;
    limit: number;
    lastPage: number;
  };
}

@Injectable()
export class AcademicsService {
  constructor(
    @InjectRepository(Semester) private semesterRepo: Repository<Semester>,
    @InjectRepository(Course) private courseRepo: Repository<Course>,
    @InjectRepository(ScheduleItem)
    private scheduleRepo: Repository<ScheduleItem>,
  ) {}

  // ================= SEMESTERS =================
  async createSemester(classroomId: string, data: CreateSemesterDto) {
    // If this is set to active, deactivate all others in this classroom
    const isActive = data.status === 'active';
    if (isActive) {
      await this.semesterRepo.update({ classroomId }, { isActive: false, status: 'archived' });
    }
    const semester = this.semesterRepo.create({ ...data, classroomId, isActive });
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

  async updateSemester(classroomId: string, semesterId: string, data: UpdateSemesterDto) {
    const semester = await this.semesterRepo.findOne({ where: { id: semesterId, classroomId } });
    if (!semester) throw new NotFoundException('Semester not found');

    const becomingActive = data.status === 'active' && semester.status !== 'active';
    if (becomingActive) {
      await this.semesterRepo.update({ classroomId }, { isActive: false, status: 'archived' });
      semester.isActive = true;
    } else if (data.status && data.status !== 'active') {
      semester.isActive = false;
    }

    Object.assign(semester, data);
    return this.semesterRepo.save(semester);
  }

  async deleteSemester(classroomId: string, semesterId: string) {
    const semester = await this.semesterRepo.findOne({ where: { id: semesterId, classroomId } });
    if (!semester) throw new NotFoundException('Semester not found');
    
    // Check if it has courses
    const courseCount = await this.courseRepo.count({ where: { semesterId } });
    if (courseCount > 0) {
      throw new BadRequestException('Cannot delete semester with existing courses');
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
      .where('(course.classroomId = :classroomId OR semester.classroomId = :classroomId)', { classroomId });

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

  async addScheduleItem(courseId: string, data: Partial<ScheduleItem>) {
    const item = this.scheduleRepo.create({ ...data, courseId });
    return this.scheduleRepo.save(item);
  }

  async getWeeklySchedule(classroomId: string) {
    // 1. Get the active semester for this classroom
    const activeSemester = await this.getActiveSemester(classroomId);

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
}
