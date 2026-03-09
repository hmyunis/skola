import { Controller, Post, Body, UseGuards, Get } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClassroomRoleGuard } from '../../core/guards/classroom-role.guard';
import { RequireClassroomRole } from '../../core/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentClassroom } from '../../core/decorators/current-classroom.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { AdminService } from './admin.service';
import { PriorityLevel } from './entities/announcement.entity';

@UseGuards(JwtAuthGuard, ClassroomRoleGuard) // Order is important! Check JWT first, then Role
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ================= ADMIN ROUTES =================
  @Post('announcements')
  @RequireClassroomRole(UserRole.ADMIN, UserRole.OWNER)
  async createAnnouncement(
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @Body() dto: { title: string; content: string; priority?: PriorityLevel }
  ) {
    return this.adminService.createAnnouncement(classroomId, user.id, dto);
  }

  @Post('invites/generate')
  @RequireClassroomRole(UserRole.ADMIN, UserRole.OWNER)
  async generateInviteCode(
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @Body() dto: { maxUses?: number; expiresAt?: Date }
  ) {
    return this.adminService.generateInviteCode(classroomId, user.id, dto);
  }

  // ================= OWNER SUITE ROUTES =================
  @Post('settings/features')
  @RequireClassroomRole(UserRole.OWNER) // ONLY the Owner can toggle global features
  async updateFeatureToggles(
    @CurrentClassroom() classroomId: string,
    @Body() toggles: Record<string, boolean> // e.g., { social: false, arena: true }
  ) {
    return this.adminService.updateFeatureToggles(classroomId, toggles);
  }
}
