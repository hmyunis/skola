import { Controller, Get, Put, Body, UseGuards, Delete } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { User } from './entities/user.entity';
import { ClassroomRoleGuard } from '../../core/guards/classroom-role.guard';
import { CurrentClassroom } from '../../core/decorators/current-classroom.decorator';
import { UpdateImageUploadSettingsDto } from './dto/update-image-upload-settings.dto';
import { DeleteMyAccountDto } from './dto/delete-my-account.dto';

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

  @Get('me/account-deletion-context')
  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  getAccountDeletionContext(
    @CurrentUser() user: User,
    @CurrentClassroom() classroomId: string,
  ) {
    return this.usersService.getAccountDeletionContext(user.id, classroomId);
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard, ClassroomRoleGuard)
  async deleteMyAccount(
    @CurrentUser() user: User,
    @CurrentClassroom() classroomId: string,
    @Body()
    dto: DeleteMyAccountDto,
  ) {
    await this.usersService.deleteAccountInCurrentClassroom(
      user.id,
      classroomId,
      dto?.successorMemberId,
    );
    return { success: true };
  }
}
