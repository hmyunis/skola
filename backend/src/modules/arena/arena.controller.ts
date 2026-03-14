import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ArenaService } from './arena.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentClassroom } from '../../core/decorators/current-classroom.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';
import { ClassroomRoleGuard } from '../../core/guards/classroom-role.guard';
import { RequireClassroomRole } from '../../core/decorators/roles.decorator';
import { ArenaQuizQueryDto } from './dto/arena-quiz-query.dto';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { AttemptQuizDto } from './dto/attempt-quiz.dto';
import { ArenaLeaderboardQueryDto } from './dto/arena-leaderboard-query.dto';
import { ReportQuizDto } from './dto/report-quiz.dto';
import { QuizReportQueryDto } from './dto/quiz-report-query.dto';
import { ReviewQuizReportDto } from './dto/review-quiz-report.dto';

@UseGuards(JwtAuthGuard)
@Controller('arena')
export class ArenaController {
  constructor(private readonly arenaService: ArenaService) {}

  @Get('quizzes')
  async getQuizzes(
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @Query() query: ArenaQuizQueryDto,
  ) {
    return this.arenaService.getQuizzes(classroomId, user.id, query);
  }

  @Get('quizzes/:quizId')
  async getQuiz(
    @Param('quizId') quizId: string,
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
  ) {
    return this.arenaService.getQuiz(quizId, classroomId, user.id);
  }

  @Post('quizzes')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.STUDENT, UserRole.ADMIN, UserRole.OWNER)
  async createQuiz(
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @Body() dto: CreateQuizDto,
  ) {
    return this.arenaService.createQuiz(classroomId, user.id, dto);
  }

  @Delete('quizzes/:quizId')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.STUDENT, UserRole.ADMIN, UserRole.OWNER)
  async deleteQuiz(
    @Param('quizId') quizId: string,
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
  ) {
    return this.arenaService.deleteQuiz(quizId, classroomId, user.id);
  }

  @Post('quizzes/:quizId/attempt')
  async submitQuizAttempt(
    @Param('quizId') quizId: string,
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @Body() dto: AttemptQuizDto,
  ) {
    return this.arenaService.submitAttempt(quizId, classroomId, user.id, dto);
  }

  @Get('me/stats')
  async getMyStats(
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
  ) {
    return this.arenaService.getUserStats(classroomId, user.id);
  }

  @Get('leaderboard')
  async getLeaderboard(
    @CurrentClassroom() classroomId: string,
    @Query() query: ArenaLeaderboardQueryDto,
  ) {
    return this.arenaService.getLeaderboard(classroomId, query);
  }

  @Post('quizzes/:quizId/report')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.STUDENT, UserRole.ADMIN, UserRole.OWNER)
  async reportQuiz(
    @Param('quizId') quizId: string,
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @Body() dto: ReportQuizDto,
  ) {
    return this.arenaService.reportQuiz(quizId, classroomId, user.id, dto);
  }

  @Get('moderation/reports')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.ADMIN, UserRole.OWNER)
  async getQuizReports(
    @CurrentClassroom() classroomId: string,
    @Query() query: QuizReportQueryDto,
  ) {
    return this.arenaService.listReports(classroomId, query.status);
  }

  @Post('moderation/reports/:reportId/review')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.ADMIN, UserRole.OWNER)
  async reviewQuizReport(
    @Param('reportId') reportId: string,
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @Body() dto: ReviewQuizReportDto,
  ) {
    return this.arenaService.reviewReport(reportId, classroomId, user.id, dto);
  }
}
