import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Delete,
  ForbiddenException,
} from '@nestjs/common';
import { ClassroomsService } from './classrooms.service';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { CurrentClassroom } from '../../core/decorators/current-classroom.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User, UserRole } from '../users/entities/user.entity';
import { ClassroomRoleGuard } from '../../core/guards/classroom-role.guard';
import { RequireClassroomRole } from '../../core/decorators/roles.decorator';

@Controller('classrooms')
export class ClassroomsController {
  constructor(private readonly classroomsService: ClassroomsService) {}

  private assertClassroomScope(routeClassroomId: string, headerClassroomId: string) {
    if (routeClassroomId !== headerClassroomId) {
      throw new ForbiddenException('Classroom scope mismatch');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async createClassroom(@Body() data: any, @CurrentUser() user: User) {
    return this.classroomsService.createClassroom(data, user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('join')
  @HttpCode(HttpStatus.OK)
  async joinClassroom(
    @Body() dto: { inviteCode: string; telegramGroupId?: string },
    @CurrentUser() user: User,
  ) {
    return this.classroomsService.joinClassroom(
      dto.inviteCode,
      user,
      dto.telegramGroupId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('onboard')
  async onboardByTelegramGroupId(
    @Body('telegramGroupId') telegramGroupId: string,
    @CurrentUser() user: User,
  ) {
    return this.classroomsService.onboardByTelegramGroupId(
      telegramGroupId,
      user,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  async getUserClassrooms(@CurrentUser() user: User) {
    const {
      classrooms,
      memberships,
      user: fullUser,
    } = await this.classroomsService.getUserClassrooms(user.id);
    return { classrooms, memberships, user: fullUser };
  }

  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.STUDENT, UserRole.ADMIN, UserRole.OWNER)
  @Get(':id')
  async getClassroom(
    @Param('id') id: string,
    @CurrentClassroom() classroomId: string,
  ) {
    this.assertClassroomScope(id, classroomId);
    return this.classroomsService.getClassroomById(id);
  }

  @Put(':id/theme')
  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.OWNER)
  async updateClassroomTheme(
    @Param('id') id: string,
    @CurrentClassroom() classroomId: string,
    @Body() theme: any,
  ) {
    this.assertClassroomScope(id, classroomId);
    return this.classroomsService.updateTheme(id, theme);
  }

  @Put(':id/features')
  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.OWNER)
  async updateClassroomFeatures(
    @Param('id') id: string,
    @CurrentClassroom() classroomId: string,
    @Body() features: any,
  ) {
    this.assertClassroomScope(id, classroomId);
    return this.classroomsService.updateFeatures(id, features);
  }

  @Put(':id/telegram-group')
  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.OWNER)
  async updateClassroomTelegramGroup(
    @Param('id') id: string,
    @CurrentClassroom() classroomId: string,
    @Body('telegramGroupId') telegramGroupId: string,
    @CurrentUser() user: User,
  ) {
    this.assertClassroomScope(id, classroomId);
    return this.classroomsService.updateTelegramGroupId(
      id,
      telegramGroupId,
      user,
    );
  }

  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.STUDENT, UserRole.ADMIN, UserRole.OWNER)
  @Get(':id/members')
  async getClassroomMembers(
    @Param('id') id: string,
    @CurrentClassroom() classroomId: string,
  ) {
    this.assertClassroomScope(id, classroomId);
    return this.classroomsService.getClassroomMembers(id);
  }

  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.STUDENT, UserRole.ADMIN, UserRole.OWNER)
  @Get(':id/members/stats')
  async getClassroomMemberStats(
    @Param('id') id: string,
    @CurrentClassroom() classroomId: string,
  ) {
    this.assertClassroomScope(id, classroomId);
    return this.classroomsService.getClassroomMemberStats(id);
  }

  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  @Post('members/:memberId/status')
  @RequireClassroomRole(UserRole.ADMIN, UserRole.OWNER)
  async updateUserStatus(
    @Param('memberId') memberId: string,
    @CurrentClassroom() classroomId: string,
    @Body()
    dto: { status: 'active' | 'suspended' | 'banned'; suspendedUntil?: Date },
  ) {
    return this.classroomsService.updateMemberStatus(classroomId, memberId, dto);
  }

  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  @Post('members/:memberId/role')
  @RequireClassroomRole(UserRole.OWNER)
  async updateUserRole(
    @Param('memberId') memberId: string,
    @CurrentClassroom() classroomId: string,
    @Body() dto: { role: UserRole },
  ) {
    return this.classroomsService.updateMemberRole(classroomId, memberId, dto);
  }

  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  @Delete('members/:memberId')
  @RequireClassroomRole(UserRole.OWNER)
  async removeMember(
    @Param('memberId') memberId: string,
    @CurrentClassroom() classroomId: string,
  ) {
    return this.classroomsService.removeMember(classroomId, memberId);
  }
}
