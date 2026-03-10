import { Controller, Get, Post, Put, Body, Param, UseGuards, HttpCode, HttpStatus, Delete } from '@nestjs/common';
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
    const { classrooms, user: fullUser } = await this.classroomsService.getUserClassrooms(user.id);
    return { classrooms, user: fullUser };
  }

  @Get(':id')
  async getClassroom(@Param('id') id: string) {
    return this.classroomsService.getClassroomById(id);
  }

  @Put(':id/theme')
  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.OWNER)
  async updateClassroomTheme(@Param('id') id: string, @Body() theme: any) {
    return this.classroomsService.updateTheme(id, theme);
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

  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  @Delete('members/:memberId')
  @RequireClassroomRole(UserRole.OWNER)
  async removeMember(@Param('memberId') memberId: string) {
    return this.classroomsService.removeMember(memberId);
  }
}
