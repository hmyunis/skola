import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  UseGuards,
  Param,
  Query,
} from '@nestjs/common';
import { AcademicsService } from './academics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentClassroom } from '../../core/decorators/current-classroom.decorator';
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
  RateAssessmentDto,
  UpdateAssessmentDto,
} from './dto/assessment.dto';
import { User, UserRole } from '../users/entities/user.entity';
import { RequireClassroomRole } from '../../core/decorators/roles.decorator';
import { ClassroomRoleGuard } from '../../core/guards/classroom-role.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, ClassroomRoleGuard)
@Controller('academics')
export class AcademicsController {
  constructor(private readonly academicsService: AcademicsService) {}

  @Post('semesters')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.OWNER)
  async createSemester(
    @CurrentClassroom() classroomId: string,
    @Body() dto: CreateSemesterDto,
  ) {
    return this.academicsService.createSemester(classroomId, dto);
  }

  @Patch('semesters/:id')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.OWNER)
  async updateSemester(
    @CurrentClassroom() classroomId: string,
    @Param('id') semesterId: string,
    @Body() dto: UpdateSemesterDto,
  ) {
    return this.academicsService.updateSemester(classroomId, semesterId, dto);
  }

  @Delete('semesters/:id')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.OWNER)
  async deleteSemester(
    @CurrentClassroom() classroomId: string,
    @Param('id') semesterId: string,
  ) {
    return this.academicsService.deleteSemester(classroomId, semesterId);
  }

  @Get('semesters')
  async getAllSemesters(@CurrentClassroom() classroomId: string) {
    return this.academicsService.getAllSemesters(classroomId);
  }

  @Get('semesters/active')
  async getActiveSemester(@CurrentClassroom() classroomId: string) {
    return this.academicsService.getActiveSemester(classroomId);
  }

  @Get('semesters/archive')
  async getArchive(@CurrentClassroom() classroomId: string) {
    return this.academicsService.getAllSemesters(classroomId);
  }

  @Get('dashboard/quick-stats')
  async getDashboardQuickStats(@CurrentClassroom() classroomId: string) {
    return this.academicsService.getDashboardQuickStats(classroomId);
  }

  // ================= ASSESSMENTS =================
  @Get('assessments')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.STUDENT, UserRole.ADMIN, UserRole.OWNER)
  async getAssessments(
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @Query() query: AssessmentQueryDto,
  ) {
    return this.academicsService.getAssessments(classroomId, query, user.id);
  }

  @Get('assessments/stats')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.STUDENT, UserRole.ADMIN, UserRole.OWNER)
  async getAssessmentStats(
    @CurrentClassroom() classroomId: string,
    @Query() query: AssessmentQueryDto,
  ) {
    return this.academicsService.getAssessmentStats(classroomId, query);
  }

  @Post('assessments')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.ADMIN, UserRole.OWNER)
  async createAssessment(
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @Body() dto: CreateAssessmentDto,
  ) {
    return this.academicsService.createAssessment(classroomId, user.id, dto);
  }

  @Patch('assessments/:id')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.ADMIN, UserRole.OWNER)
  async updateAssessment(
    @CurrentClassroom() classroomId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAssessmentDto,
  ) {
    return this.academicsService.updateAssessment(classroomId, id, dto);
  }

  @Delete('assessments/:id')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.ADMIN, UserRole.OWNER)
  async deleteAssessment(
    @CurrentClassroom() classroomId: string,
    @Param('id') id: string,
  ) {
    return this.academicsService.deleteAssessment(classroomId, id);
  }

  @Post('assessments/:id/rating')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.STUDENT, UserRole.ADMIN, UserRole.OWNER)
  async rateAssessment(
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: RateAssessmentDto,
  ) {
    return this.academicsService.rateAssessment(
      classroomId,
      id,
      user.id,
      dto.vote,
    );
  }

  @Delete('assessments/:id/rating')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.STUDENT, UserRole.ADMIN, UserRole.OWNER)
  async clearAssessmentRating(
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @Param('id') id: string,
  ) {
    return this.academicsService.clearAssessmentRating(
      classroomId,
      id,
      user.id,
    );
  }

  // ================= COURSES =================

  @Get('courses')
  async getCourses(
    @CurrentClassroom() classroomId: string,
    @Query() query: CourseQueryDto,
  ) {
    return this.academicsService.getCourses(classroomId, query);
  }

  @Get('courses/stats')
  async getCourseStats(
    @CurrentClassroom() classroomId: string,
    @Query() query: CourseQueryDto,
  ) {
    return this.academicsService.getCourseStats(classroomId, query);
  }

  @Get('courses/:id')
  async getCourse(
    @CurrentClassroom() classroomId: string,
    @Param('id') courseId: string,
  ) {
    return this.academicsService.getCourseById(classroomId, courseId);
  }

  @Post('courses')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.OWNER)
  async createCourse(
    @CurrentClassroom() classroomId: string,
    @Body() dto: CreateCourseDto,
  ) {
    return this.academicsService.createCourse(classroomId, dto);
  }

  @Patch('courses/:id')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.OWNER)
  async updateCourse(
    @CurrentClassroom() classroomId: string,
    @Param('id') courseId: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.academicsService.updateCourse(classroomId, courseId, dto);
  }

  @Delete('courses/:id')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.OWNER)
  async deleteCourse(
    @CurrentClassroom() classroomId: string,
    @Param('id') courseId: string,
  ) {
    return this.academicsService.deleteCourse(classroomId, courseId);
  }

  // ================= SCHEDULE =================

  @Get('schedule')
  async getWeeklySchedule(@CurrentClassroom() classroomId: string) {
    return this.academicsService.getWeeklySchedule(classroomId);
  }

  @Post('schedule')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.ADMIN, UserRole.OWNER)
  async createScheduleItem(
    @CurrentClassroom() classroomId: string,
    @Body() dto: CreateScheduleItemDto,
  ) {
    return this.academicsService.createScheduleItem(classroomId, dto);
  }

  @Patch('schedule/:id')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.ADMIN, UserRole.OWNER)
  async updateScheduleItem(
    @CurrentClassroom() classroomId: string,
    @Param('id') id: string,
    @Body() dto: UpdateScheduleItemDto,
  ) {
    return this.academicsService.updateScheduleItem(classroomId, id, dto);
  }

  @Delete('schedule/:id')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.ADMIN, UserRole.OWNER)
  async deleteScheduleItem(
    @CurrentClassroom() classroomId: string,
    @Param('id') id: string,
  ) {
    return this.academicsService.deleteScheduleItem(classroomId, id);
  }

  @Post('schedule/publish')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.ADMIN, UserRole.OWNER)
  async publishScheduleDrafts(@CurrentClassroom() classroomId: string) {
    return this.academicsService.publishScheduleDrafts(classroomId);
  }

  @Post('schedule/:id/confirm')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.ADMIN, UserRole.OWNER)
  async confirmScheduleItem(
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @Param('id') id: string,
  ) {
    return this.academicsService.confirmScheduleItem(classroomId, id, user.id);
  }

  @Post('schedule/:id/unconfirm')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.ADMIN, UserRole.OWNER)
  async unconfirmScheduleItem(
    @CurrentClassroom() classroomId: string,
    @Param('id') id: string,
  ) {
    return this.academicsService.unconfirmScheduleItem(classroomId, id);
  }
}
