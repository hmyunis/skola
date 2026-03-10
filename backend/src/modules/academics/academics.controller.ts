import {
  Controller,
  Get,
  Post,
  Put,
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
import { UserRole } from '../users/entities/user.entity';
import { RequireClassroomRole } from '../../core/decorators/roles.decorator';
import { ClassroomRoleGuard } from '../../core/guards/classroom-role.guard';

@UseGuards(JwtAuthGuard)
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

  // ================= COURSES =================

  @Get('courses')
  async getCourses(
    @CurrentClassroom() classroomId: string,
    @Query() query: CourseQueryDto,
  ) {
    return this.academicsService.getCourses(classroomId, query);
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

  @Post('schedule/:courseId')
  async addScheduleItem(
    @Param('courseId') courseId: string,
    @Body() dto: any, // Replace with CreateScheduleItemDto
  ) {
    return this.academicsService.addScheduleItem(courseId, dto);
  }
}
