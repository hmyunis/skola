import { Controller, Post, Body, UseGuards, Get, Param } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClassroomRoleGuard } from '../../core/guards/classroom-role.guard';
import { RequireClassroomRole } from '../../core/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentClassroom } from '../../core/decorators/current-classroom.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { AdminService } from './admin.service';
import { PriorityLevel } from './entities/announcement.entity';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ================= ADMIN ROUTES =================
  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  @Post('announcements')
  @RequireClassroomRole(UserRole.ADMIN, UserRole.OWNER)
  async createAnnouncement(
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @Body() dto: { title: string; content: string; priority?: PriorityLevel }
  ) {
    return this.adminService.createAnnouncement(classroomId, user.id, dto);
  }

  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  @Post('invites/generate')
  @RequireClassroomRole(UserRole.ADMIN, UserRole.OWNER)
  async generateInviteCode(
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @Body() dto: { maxUses?: number; expiresAt?: Date }
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
  async deactivateInviteCode(@Param('id') id: string) {
    return this.adminService.deactivateInviteCode(id);
  }

  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  @Post('invites/:id/delete') // Or DELETE /admin/invites/:id
  @RequireClassroomRole(UserRole.ADMIN, UserRole.OWNER)
  async deleteInviteCode(@Param('id') id: string) {
    return this.adminService.deleteInviteCode(id);
  }

  @Get('invites/validate/:code')
  async validateInviteCode(@Param('code') code: string) {
    return this.adminService.validateInviteCode(code);
  }

  // ================= OWNER SUITE ROUTES =================
  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  @Post('settings/features')
  @RequireClassroomRole(UserRole.OWNER) // ONLY the Owner can toggle global features
  async updateFeatureToggles(
    @CurrentClassroom() classroomId: string,
    @Body() toggles: Record<string, boolean> // e.g., { social: false, arena: true }
  ) {
    return this.adminService.updateFeatureToggles(classroomId, toggles);
  }
}
