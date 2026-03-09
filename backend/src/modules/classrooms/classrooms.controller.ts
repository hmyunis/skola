import { Controller, Get, Post, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ClassroomsService } from './classrooms.service';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('classrooms')
export class ClassroomsController {
  constructor(private readonly classroomsService: ClassroomsService) {}

  @Post()
  async createClassroom(@Body() data: any) {
    return this.classroomsService.createClassroom(data);
  }

  @Post('join')
  @HttpCode(HttpStatus.OK)
  async joinClassroom(
    @Body('inviteCode') inviteCode: string,
    @CurrentUser() user: User
  ) {
    return this.classroomsService.joinClassroom(inviteCode, user);
  }

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
}
