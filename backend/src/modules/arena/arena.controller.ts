import { Controller, Get, Post, Body, UseGuards, Param, Put } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClassroomRoleGuard } from '../../core/guards/classroom-role.guard';
import { RequireClassroomRole } from '../../core/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { CurrentClassroom } from '../../core/decorators/current-classroom.decorator';
import { User } from '../users/entities/user.entity';
import { ArenaService } from './arena.service';

@UseGuards(JwtAuthGuard)
@Controller('arena')
export class ArenaController {
  constructor(private readonly arenaService: ArenaService) {}

  // ================= STUDENT ROUTES =================
  @Get('quizzes')
  async getQuizzes(@CurrentClassroom() classroomId: string) {
    return this.arenaService.getQuizzes(classroomId);
  }

  @Get('quizzes/:quizId')
  async getQuiz(@Param('quizId') quizId: string) {
    return this.arenaService.getQuiz(quizId);
  }

  @Post('quizzes/:quizId/attempt')
  async submitQuizAttempt(
    @Param('quizId') quizId: string,
    @CurrentUser() user: User,
    @Body() body: { answers: number[] }
  ) {
    return this.arenaService.submitAttempt(quizId, user.id, body.answers);
  }

  @Get('leaderboard')
  async getLeaderboard(@CurrentClassroom() classroomId: string) {
    return this.arenaService.getLeaderboard(classroomId);
  }

  // ================= ADMIN/OWNER ROUTES =================
  @Post('quizzes')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.ADMIN, UserRole.OWNER)
  async createQuiz(
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @Body() body: any // CreateQuizDto
  ) {
    return this.arenaService.createQuiz(classroomId, user.id, body);
  }

  @Put('quizzes/:quizId')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.ADMIN, UserRole.OWNER)
  async updateQuiz(
    @Param('quizId') quizId: string,
    @Body() body: any // UpdateQuizDto
  ) {
    return this.arenaService.updateQuiz(quizId, body);
  }
}
