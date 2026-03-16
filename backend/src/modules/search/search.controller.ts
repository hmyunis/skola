import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentClassroom } from '../../core/decorators/current-classroom.decorator';
import { RequireClassroomRole } from '../../core/decorators/roles.decorator';
import { ClassroomRoleGuard } from '../../core/guards/classroom-role.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from '../users/entities/user.entity';
import { CommandPaletteSearchQueryDto } from './dto/command-palette-search-query.dto';
import { SearchService } from './search.service';

@Controller('search')
@UseGuards(JwtAuthGuard, ClassroomRoleGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('command-palette')
  @RequireClassroomRole(UserRole.STUDENT, UserRole.ADMIN, UserRole.OWNER)
  async searchCommandPalette(
    @CurrentClassroom() classroomId: string,
    @Query() query: CommandPaletteSearchQueryDto,
  ) {
    return this.searchService.searchCommandPalette(
      classroomId,
      query.q || '',
      query.limit ?? 5,
    );
  }
}
