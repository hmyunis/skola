import { Controller, Get, Put, Body, UseGuards, Delete } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { User, UserRole } from './entities/user.entity';
import { ClassroomRoleGuard } from '../../core/guards/classroom-role.guard';
import { RequireClassroomRole } from '../../core/decorators/roles.decorator';
import { CurrentClassroom } from '../../core/decorators/current-classroom.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getProfile(@CurrentUser() user: User) {
    return user;
  }

  @Put('me/theme')
  @UseGuards(JwtAuthGuard)
  updateThemeSettings(@CurrentUser() user: User, @Body() themeSettings: any) {
    return this.usersService.updateThemeSettings(user.id, themeSettings);
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.OWNER)
  async deleteMyAccount(
    @CurrentUser() user: User,
    @CurrentClassroom() classroomId: string,
    @Body() dto: { successorMemberId: string },
  ) {
    await this.usersService.deleteOwnerAccountWithSuccessor(
      user.id,
      classroomId,
      dto?.successorMemberId,
    );
    return { success: true };
  }
}
