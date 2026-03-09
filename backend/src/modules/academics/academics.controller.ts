import { Controller, Get, Post, Body, UseGuards, Param } from '@nestjs/common';
import { AcademicsService } from './academics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentClassroom } from '../../core/decorators/current-classroom.decorator';
// Import DTOs (omitted for brevity, e.g., CreateSemesterDto, CreateCourseDto)

@UseGuards(JwtAuthGuard)
@Controller('academics')
export class AcademicsController {
  constructor(private readonly academicsService: AcademicsService) {}

  @Post('semesters')
  async createSemester(
    @CurrentClassroom() classroomId: string,
    @Body() dto: any // Replace with CreateSemesterDto
  ) {
    return this.academicsService.createSemester(classroomId, dto);
  }

  @Get('semesters/active')
  async getActiveSemester(@CurrentClassroom() classroomId: string) {
    return this.academicsService.getActiveSemester(classroomId);
  }

  @Get('semesters/archive')
  async getArchive(@CurrentClassroom() classroomId: string) {
    return this.academicsService.getAllSemesters(classroomId);
  }

  @Post('courses/:semesterId')
  async createCourse(
    @Param('semesterId') semesterId: string,
    @Body() dto: any // Replace with CreateCourseDto
  ) {
    return this.academicsService.createCourse(semesterId, dto);
  }

  @Get('schedule')
  async getWeeklySchedule(@CurrentClassroom() classroomId: string) {
    return this.academicsService.getWeeklySchedule(classroomId);
  }

  @Post('schedule/:courseId')
  async addScheduleItem(
    @Param('courseId') courseId: string,
    @Body() dto: any // Replace with CreateScheduleItemDto
  ) {
    return this.academicsService.addScheduleItem(courseId, dto);
  }
}
