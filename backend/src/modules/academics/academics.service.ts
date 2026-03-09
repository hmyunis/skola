import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Semester } from './entities/semester.entity';
import { Course } from './entities/course.entity';
import { ScheduleItem } from './entities/schedule-item.entity';

@Injectable()
export class AcademicsService {
  constructor(
    @InjectRepository(Semester) private semesterRepo: Repository<Semester>,
    @InjectRepository(Course) private courseRepo: Repository<Course>,
    @InjectRepository(ScheduleItem) private scheduleRepo: Repository<ScheduleItem>,
  ) {}

  // ================= SEMESTERS =================
  async createSemester(classroomId: string, data: Partial<Semester>) {
    // If this is set to active, deactivate all others in this classroom
    if (data.isActive) {
      await this.semesterRepo.update({ classroomId }, { isActive: false });
    }
    const semester = this.semesterRepo.create({ ...data, classroomId });
    return this.semesterRepo.save(semester);
  }

  async getActiveSemester(classroomId: string) {
    const semester = await this.semesterRepo.findOne({ 
      where: { classroomId, isActive: true },
      relations:['courses', 'courses.scheduleItems'] // Pre-load data for dashboard
    });
    if (!semester) throw new NotFoundException('No active semester found');
    return semester;
  }

  async getAllSemesters(classroomId: string) {
    return this.semesterRepo.find({ 
      where: { classroomId },
      order: { startDate: 'DESC' } // Newest first for Archive view
    });
  }

  // ================= SCHEDULE & COURSES =================
  async createCourse(semesterId: string, data: Partial<Course>) {
    const course = this.courseRepo.create({ ...data, semesterId });
    return this.courseRepo.save(course);
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
    return this.scheduleRepo.createQueryBuilder('schedule')
      .innerJoinAndSelect('schedule.course', 'course')
      .where('course.semesterId = :semesterId', { semesterId: activeSemester.id })
      // .andWhere('schedule.isDraft = false') // Optional: only show published to students
      .orderBy('schedule.dayOfWeek', 'ASC')
      .addOrderBy('schedule.startTime', 'ASC')
      .getMany();
  }
}
