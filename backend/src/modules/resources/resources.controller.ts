import { Controller, Get, Post, Body, UseGuards, Param, Query, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { ResourcesService } from './resources.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentClassroom } from '../../core/decorators/current-classroom.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ResourceVote, VoteType } from './entities/resource-vote.entity';
import { Resource, ResourceType } from './entities/resource.entity';

@UseGuards(JwtAuthGuard)
@Controller('resources')
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Get()
  async getResources(
    @CurrentClassroom() classroomId: string,
    @Query('courseId') courseId?: string
  ) {
    return this.resourcesService.findAllForClassroom(classroomId, courseId);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './public/uploads/resources',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
      }
    }),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  }))
  async uploadResource(
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
    @Body() data: any
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const resource = await this.resourcesService.createResource({
      classroomId,
      courseId: data.courseId,
      uploaderId: user.id,
      title: data.title,
      description: data.description,
      type: data.type || ResourceType.NOTE,
      fileUrl: `/${file.path}`,
      fileName: file.originalname,
      fileSize: file.size,
      tags: data.tags ? JSON.parse(data.tags) : [],
    });

    return resource;
  }

  @Post(':id/vote')
  async voteResource(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body('voteType') voteType: VoteType
  ) {
    return this.resourcesService.vote(id, user.id, voteType);
  }

  @Get(':id')
  async getResource(@Param('id') id: string) {
    return this.resourcesService.findById(id);
  }
}
