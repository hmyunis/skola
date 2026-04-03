import { Controller, Get, Put, Body, UseGuards, Delete } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { User, UserRole } from './entities/user.entity';
import { ClassroomRoleGuard } from '../../core/guards/classroom-role.guard';
import { RequireClassroomRole } from '../../core/decorators/roles.decorator';
import { CurrentClassroom } from '../../core/decorators/current-classroom.decorator';
import { UpdateImageUploadSettingsDto } from './dto/update-image-upload-settings.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  getProfile(
    @CurrentUser() user: User,
    @CurrentClassroom() classroomId: string,
  ) {
    return this.usersService.getScopedProfile(user.id, classroomId);
  }

  @Put('me/theme')
  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  updateThemeSettings(
    @CurrentUser() user: User,
    @CurrentClassroom() classroomId: string,
    @Body() themeSettings: any,
  ) {
    return this.usersService.updateThemeSettings(
      user.id,
      classroomId,
      themeSettings,
    );
  }

  @Get('me/image-upload-settings')
  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  getImageUploadSettings(
    @CurrentUser() user: User,
    @CurrentClassroom() classroomId: string,
  ) {
    return this.usersService.getImageUploadSettings(user.id, classroomId);
  }

  @Put('me/image-upload-settings')
  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  updateImageUploadSettings(
    @CurrentUser() user: User,
    @CurrentClassroom() classroomId: string,
    @Body() dto: UpdateImageUploadSettingsDto,
  ) {
    return this.usersService.updateImageUploadSettings(
      user.id,
      classroomId,
      dto,
    );
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
