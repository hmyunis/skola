import { Controller, Get, Post, Body, UseGuards, Param, Query } from '@nestjs/common';
import { LoungeService } from './lounge.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentClassroom } from '../../core/decorators/current-classroom.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { PaginationQueryDto } from '../../core/dto/pagination-query.dto';

@UseGuards(JwtAuthGuard)
@Controller('lounge')
export class LoungeController {
  constructor(private readonly loungeService: LoungeService) {}

  @Post()
  async createPost(
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @Body() dto: Partial<any> // e.g. CreatePostDto
  ) {
    return this.loungeService.createPost(classroomId, user.id, dto);
  }

  @Get()
  async getFeed(
    @CurrentClassroom() classroomId: string,
    @Query() pagination: PaginationQueryDto
  ) {
    return this.loungeService.getFeed(classroomId, pagination);
  }

  @Post(':id/react')
  async react(@Param('id') id: string, @Body('emoji') emoji: string) {
    return this.loungeService.reactToPost(id, emoji);
  }

  @Get(':id/replies')
  async getReplies(@Param('id') id: string) {
    return this.loungeService.getReplies(id);
  }

  @Post(':id/reply')
  async addReply(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: Partial<any>
  ) {
    return this.loungeService.addReply(id, user.id, dto);
  }
}
