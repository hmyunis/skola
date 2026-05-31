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
import { DashboardDeadlineFeedQueryDto } from './dto/dashboard-deadline-feed-query.dto';
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

  @Get('dashboard/deadline-feed')
  async getDashboardDeadlineFeed(
    @CurrentClassroom() classroomId: string,
    @Query() query: DashboardDeadlineFeedQueryDto,
  ) {
    return this.academicsService.getDashboardDeadlineFeed(classroomId, query);
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

  // ================= COURSE GROUP FORMATIONS =================

  @Get('group-formations')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.STUDENT, UserRole.ADMIN, UserRole.OWNER)
  async getGroupFormations(
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
  ) {
    return this.academicsService.listGroupFormations(classroomId, user.id);
  }

  @Get('group-formations/:id')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.STUDENT, UserRole.ADMIN, UserRole.OWNER)
  async getGroupFormation(
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @Param('id') id: string,
  ) {
    return this.academicsService.getGroupFormation(classroomId, id, user.id);
  }

  @Post('courses/:id/group-formation')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.OWNER)
  async upsertGroupFormation(
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @Param('id') courseId: string,
    @Body() dto: { maxMembers?: number; isActive?: boolean },
  ) {
    return this.academicsService.upsertGroupFormation(
      classroomId,
      courseId,
      user.id,
      dto,
    );
  }

  @Patch('group-formations/:id')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.OWNER)
  async updateGroupFormation(
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: { maxMembers?: number; isActive?: boolean },
  ) {
    return this.academicsService.updateGroupFormation(
      classroomId,
      id,
      user.id,
      dto,
    );
  }

  @Delete('group-formations/:id')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.OWNER)
  async deleteGroupFormation(
    @CurrentClassroom() classroomId: string,
    @Param('id') id: string,
  ) {
    return this.academicsService.deleteGroupFormation(classroomId, id);
  }

  @Post('group-formations/:id/groups')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.STUDENT, UserRole.ADMIN, UserRole.OWNER)
  async createGroup(
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: { name?: string; hideIdentity?: boolean },
  ) {
    return this.academicsService.createGroup(classroomId, id, user.id, dto);
  }

  @Post('groups/:id/join')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.STUDENT, UserRole.ADMIN, UserRole.OWNER)
  async joinGroup(
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: { hideIdentity?: boolean },
  ) {
    return this.academicsService.joinGroup(classroomId, id, user.id, dto);
  }

  @Post('groups/:id/invites')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.STUDENT, UserRole.ADMIN, UserRole.OWNER)
  async inviteToGroup(
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: { userId: string },
  ) {
    return this.academicsService.inviteToGroup(classroomId, id, user.id, dto);
  }

  @Post('group-invites/:id/accept')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.STUDENT, UserRole.ADMIN, UserRole.OWNER)
  async acceptGroupInvite(
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: { hideIdentity?: boolean },
  ) {
    return this.academicsService.respondToGroupInvite(
      classroomId,
      id,
      user.id,
      'accept',
      dto,
    );
  }

  @Post('group-invites/:id/reject')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.STUDENT, UserRole.ADMIN, UserRole.OWNER)
  async rejectGroupInvite(
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @Param('id') id: string,
  ) {
    return this.academicsService.respondToGroupInvite(
      classroomId,
      id,
      user.id,
      'reject',
    );
  }

  @Post('groups/:id/transfer-leadership')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.STUDENT, UserRole.ADMIN, UserRole.OWNER)
  async transferGroupLeadership(
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: { userId: string },
  ) {
    return this.academicsService.transferGroupLeadership(
      classroomId,
      id,
      user.id,
      dto,
    );
  }

  @Patch('groups/:id/privacy')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.STUDENT, UserRole.ADMIN, UserRole.OWNER)
  async updateMyGroupPrivacy(
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: { hideIdentity?: boolean },
  ) {
    return this.academicsService.updateMyGroupPrivacy(
      classroomId,
      id,
      user.id,
      dto,
    );
  }

  @Delete('groups/:id/members/me')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.STUDENT, UserRole.ADMIN, UserRole.OWNER)
  async leaveGroup(
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @Param('id') id: string,
  ) {
    return this.academicsService.leaveGroup(classroomId, id, user.id);
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
