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
  @UseGuards(JwtAuthGuard)
  getProfile(@CurrentUser() user: User) {
    return user;
  }

  @Put('me/theme')
  @UseGuards(JwtAuthGuard)
  updateThemeSettings(@CurrentUser() user: User, @Body() themeSettings: any) {
    return this.usersService.updateThemeSettings(user.id, themeSettings);
  }

  @Get('me/image-upload-settings')
  @UseGuards(JwtAuthGuard)
  getImageUploadSettings(@CurrentUser() user: User) {
    return this.usersService.getImageUploadSettings(user.id);
  }

  @Put('me/image-upload-settings')
  @UseGuards(JwtAuthGuard)
  updateImageUploadSettings(
    @CurrentUser() user: User,
    @Body() dto: UpdateImageUploadSettingsDto,
  ) {
    return this.usersService.updateImageUploadSettings(user.id, dto);
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
