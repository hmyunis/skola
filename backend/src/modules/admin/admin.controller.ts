import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Param,
  Put,
  Delete,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClassroomRoleGuard } from '../../core/guards/classroom-role.guard';
import { RequireClassroomRole } from '../../core/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentClassroom } from '../../core/decorators/current-classroom.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { AdminService, OwnerExportDatasetId } from './admin.service';
import {
  AnnouncementTargetAudience,
  PriorityLevel,
} from './entities/announcement.entity';
import { ModerationQueryDto } from './dto/moderation-query.dto';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ================= ADMIN ROUTES =================
  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  @Get('announcements')
  @RequireClassroomRole(UserRole.STUDENT, UserRole.ADMIN, UserRole.OWNER)
  async getAnnouncements(
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
  ) {
    return this.adminService.getAnnouncements(classroomId, user.id);
  }

  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  @Post('announcements')
  @RequireClassroomRole(UserRole.ADMIN, UserRole.OWNER)
  async createAnnouncement(
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @Body()
    dto: {
      title: string;
      content: string;
      priority?: PriorityLevel;
      targetAudience?: AnnouncementTargetAudience;
      pinned?: boolean;
      expiresAt?: string | Date;
      sendTelegram?: boolean;
    },
  ) {
    return this.adminService.createAnnouncement(classroomId, user.id, dto);
  }

  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  @Post('surprise-assessment/trigger')
  @RequireClassroomRole(UserRole.ADMIN, UserRole.OWNER)
  async triggerSurpriseAssessment(
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
  ) {
    return this.adminService.triggerSurpriseAssessment(classroomId, user.id);
  }

  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  @Post('surprise-assessment/stop')
  @RequireClassroomRole(UserRole.ADMIN, UserRole.OWNER)
  async stopSurpriseAssessment(@CurrentClassroom() classroomId: string) {
    return this.adminService.stopSurpriseAssessment(classroomId);
  }

  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  @Put('announcements/:id')
  @RequireClassroomRole(UserRole.ADMIN, UserRole.OWNER)
  async updateAnnouncement(
    @CurrentClassroom() classroomId: string,
    @Param('id') id: string,
    @Body()
    dto: {
      title: string;
      content: string;
      priority?: PriorityLevel;
      targetAudience?: AnnouncementTargetAudience;
      pinned?: boolean;
      expiresAt?: string | Date;
    },
  ) {
    return this.adminService.updateAnnouncement(classroomId, id, dto);
  }

  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  @Delete('announcements/:id')
  @RequireClassroomRole(UserRole.ADMIN, UserRole.OWNER)
  async deleteAnnouncement(
    @CurrentClassroom() classroomId: string,
    @Param('id') id: string,
  ) {
    return this.adminService.deleteAnnouncement(classroomId, id);
  }

  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  @Post('invites/generate')
  @RequireClassroomRole(UserRole.ADMIN, UserRole.OWNER)
  async generateInviteCode(
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @Body() dto: { maxUses?: number; expiresAt?: Date },
  ) {
    return this.adminService.generateInviteCode(classroomId, user.id, dto);
  }

  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  @Get('invites')
  @RequireClassroomRole(UserRole.ADMIN, UserRole.OWNER)
  async getInviteCodes(@CurrentClassroom() classroomId: string) {
    return this.adminService.getInviteCodes(classroomId);
  }

  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  @Post('invites/:id/deactivate')
  @RequireClassroomRole(UserRole.ADMIN, UserRole.OWNER)
  async deactivateInviteCode(
    @Param('id') id: string,
    @CurrentClassroom() classroomId: string,
  ) {
    return this.adminService.deactivateInviteCode(classroomId, id);
  }

  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  @Post('invites/:id/delete') // Or DELETE /admin/invites/:id
  @RequireClassroomRole(UserRole.ADMIN, UserRole.OWNER)
  async deleteInviteCode(
    @Param('id') id: string,
    @CurrentClassroom() classroomId: string,
  ) {
    return this.adminService.deleteInviteCode(classroomId, id);
  }

  @Get('invites/validate/:code')
  async validateInviteCode(@Param('code') code: string) {
    return this.adminService.validateInviteCode(code);
  }

  // ================= OWNER SUITE ROUTES =================
  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  @Get('analytics')
  @RequireClassroomRole(UserRole.OWNER)
  async getOwnerAnalytics(@CurrentClassroom() classroomId: string) {
    return this.adminService.getOwnerAnalytics(classroomId);
  }

  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  @Get('moderation/reports')
  @RequireClassroomRole(UserRole.ADMIN, UserRole.OWNER)
  async getModerationReports(
    @CurrentClassroom() classroomId: string,
    @Query() query: ModerationQueryDto,
  ) {
    return this.adminService.getModerationReports(classroomId, query);
  }

  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  @Get('moderation/stats')
  @RequireClassroomRole(UserRole.ADMIN, UserRole.OWNER)
  async getModerationStats(
    @CurrentClassroom() classroomId: string,
    @Query() query: ModerationQueryDto,
  ) {
    return this.adminService.getModerationStats(classroomId, query);
  }

  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  @Get('exports/datasets')
  @RequireClassroomRole(UserRole.OWNER)
  async getExportDatasets(@CurrentClassroom() classroomId: string) {
    return this.adminService.getOwnerExportDatasets(classroomId);
  }

  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  @Post('exports')
  @RequireClassroomRole(UserRole.OWNER)
  async exportOwnerData(
    @CurrentClassroom() classroomId: string,
    @Body() dto: { datasetIds: OwnerExportDatasetId[] },
  ) {
    return this.adminService.exportOwnerData(
      classroomId,
      dto?.datasetIds || [],
    );
  }

  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  @Post('settings/features')
  @RequireClassroomRole(UserRole.OWNER) // ONLY the Owner can toggle global features
  async updateFeatureToggles(
    @CurrentClassroom() classroomId: string,
    @Body() toggles: Record<string, boolean>, // e.g., { social: false, arena: true }
  ) {
    return this.adminService.updateFeatureToggles(classroomId, toggles);
  }
}
