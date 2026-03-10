import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { User } from './entities/user.entity';

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
}
