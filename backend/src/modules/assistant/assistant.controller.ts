import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentClassroom } from '../../core/decorators/current-classroom.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { RequireClassroomRole } from '../../core/decorators/roles.decorator';
import { ClassroomRoleGuard } from '../../core/guards/classroom-role.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User, UserRole } from '../users/entities/user.entity';
import { AssistantService } from './assistant.service';
import { AssistantChatRequestDto } from './dto/assistant-chat-request.dto';

@Controller('assistant')
@UseGuards(JwtAuthGuard, ClassroomRoleGuard)
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Get('suggestions')
  @RequireClassroomRole(UserRole.STUDENT, UserRole.ADMIN, UserRole.OWNER)
  async getSuggestions(@CurrentClassroom() classroomId: string) {
    return this.assistantService.getSuggestions(classroomId);
  }

  @Get('usage')
  @RequireClassroomRole(UserRole.STUDENT, UserRole.ADMIN, UserRole.OWNER)
  async getUsage(
    @CurrentUser() user: User,
    @CurrentClassroom() classroomId: string,
  ) {
    return this.assistantService.getUsage(user.id, classroomId);
  }

  @Post('chat')
  @RequireClassroomRole(UserRole.STUDENT, UserRole.ADMIN, UserRole.OWNER)
  async chat(
    @CurrentUser() user: User,
    @CurrentClassroom() classroomId: string,
    @Body() dto: AssistantChatRequestDto,
  ) {
    return this.assistantService.chat(
      user.id,
      classroomId,
      dto.message,
      dto.history || [],
      {
        timeZone: dto.clientTimeZone,
        locale: dto.clientLocale,
        nowIso: dto.clientNowIso,
      },
    );
  }
}
