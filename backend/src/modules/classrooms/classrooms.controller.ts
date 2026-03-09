import { Controller, Get, Post, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ClassroomsService } from './classrooms.service';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User, UserRole } from '../users/entities/user.entity';
import { ClassroomRoleGuard } from '../../core/guards/classroom-role.guard';
import { RequireClassroomRole } from '../../core/decorators/roles.decorator';

@Controller('classrooms')
export class ClassroomsController {
  constructor(private readonly classroomsService: ClassroomsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async createClassroom(
    @Body() data: any,
    @CurrentUser() user: User
  ) {
    return this.classroomsService.createClassroom(data, user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('join')
  @HttpCode(HttpStatus.OK)
  async joinClassroom(
    @Body('inviteCode') inviteCode: string,
    @CurrentUser() user: User
  ) {
    return this.classroomsService.joinClassroom(inviteCode, user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('onboard')
  async onboardByTelegramGroupId(
    @Body('telegramGroupId') telegramGroupId: string,
    @CurrentUser() user: User
  ) {
    return this.classroomsService.onboardByTelegramGroupId(telegramGroupId, user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  async getUserClassrooms(@CurrentUser() user: User) {
    return this.classroomsService.getUserClassrooms(user.id);
  }

  @Get(':id')
  async getClassroom(@Param('id') id: string) {
    return this.classroomsService.getClassroomById(id);
  }

  @Get(':id/members')
  async getClassroomMembers(@Param('id') id: string) {
    return this.classroomsService.getClassroomMembers(id);
  }

  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  @Post('members/:memberId/status')
  @RequireClassroomRole(UserRole.ADMIN, UserRole.OWNER)
  async updateUserStatus(
    @Param('memberId') memberId: string,
    @Body() dto: { status: 'active' | 'suspended' | 'banned'; suspendedUntil?: Date }
  ) {
    return this.classroomsService.updateMemberStatus(memberId, dto);
  }

  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  @Post('members/:memberId/role')
  @RequireClassroomRole(UserRole.OWNER)
  async updateUserRole(
    @Param('memberId') memberId: string,
    @Body() dto: { role: UserRole }
  ) {
    return this.classroomsService.updateMemberRole(memberId, dto);
  }
}
