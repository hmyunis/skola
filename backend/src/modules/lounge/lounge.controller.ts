import { Controller, Get, Post, Patch, Delete, Body, UseGuards, Param, Query } from '@nestjs/common';
import { LoungeService } from './lounge.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentClassroom } from '../../core/decorators/current-classroom.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { LoungeFeedQueryDto } from './dto/lounge-feed-query.dto';
import { ClassroomRoleGuard } from '../../core/guards/classroom-role.guard';
import { RequireClassroomRole } from '../../core/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { LoungeReportQueryDto } from './dto/lounge-report-query.dto';

@UseGuards(JwtAuthGuard)
@Controller('lounge')
export class LoungeController {
  constructor(private readonly loungeService: LoungeService) {}

  @Post()
  async createPost(
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @Body() dto: { content: string; tags?: string[]; course?: string; isAnonymous?: boolean }
  ) {
    return this.loungeService.createPost(classroomId, user.id, dto);
  }

  @Get()
  async getFeed(
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @Query() query: LoungeFeedQueryDto,
  ) {
    const { search, tag, course, sort, ...pagination } = query;
    return this.loungeService.getFeed(classroomId, pagination, { search, tag, course, sort }, user.id);
  }

  @Patch(':id')
  async editPost(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: { content?: string; tags?: string[]; course?: string }
  ) {
    return this.loungeService.editPost(id, user.id, dto);
  }

  @Delete(':id')
  async deletePost(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    return this.loungeService.deletePost(id, user);
  }

  @Post(':id/react')
  async react(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body('emoji') emoji: string,
  ) {
    return this.loungeService.reactToPost(id, user.id, emoji);
  }

  @Get(':id/replies')
  async getReplies(@Param('id') id: string) {
    return this.loungeService.getReplies(id);
  }

  @Post(':id/reply')
  async addReply(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: { content: string; isAnonymous?: boolean }
  ) {
    return this.loungeService.addReply(id, user.id, dto);
  }

  @Delete('replies/:id')
  async deleteReply(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    return this.loungeService.deleteReply(id, user);
  }

  @Post('reports')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.STUDENT, UserRole.ADMIN, UserRole.OWNER)
  async reportContent(
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @Body() dto: { contentType: 'post' | 'reply'; contentId: string; reason: string; details?: string },
  ) {
    return this.loungeService.reportContent(classroomId, user.id, dto);
  }

  @Get('reports')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.ADMIN, UserRole.OWNER)
  async getReports(
    @CurrentClassroom() classroomId: string,
    @Query() query: LoungeReportQueryDto,
  ) {
    return this.loungeService.listReports(classroomId, query.status, query.type);
  }

  @Post('reports/:id/review')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.ADMIN, UserRole.OWNER)
  async reviewReport(
    @Param('id') id: string,
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @Body() dto: { status: 'resolved' | 'dismissed'; removeContent?: boolean },
  ) {
    return this.loungeService.reviewReport(id, classroomId, user.id, dto);
  }
}
