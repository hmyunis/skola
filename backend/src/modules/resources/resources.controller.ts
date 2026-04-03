import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  UseGuards,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { ResourcesService } from './resources.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentClassroom } from '../../core/decorators/current-classroom.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { VoteType } from './entities/resource-vote.entity';
import { ResourceType } from './entities/resource.entity';
import { ClassroomRoleGuard } from '../../core/guards/classroom-role.guard';
import { RequireClassroomRole } from '../../core/decorators/roles.decorator';
import { existsSync, mkdirSync } from 'fs';
import { ResourceQueryDto } from './dto/resource-query.dto';
import { ReportResourceDto } from './dto/report-resource.dto';
import { ReviewResourceReportDto } from './dto/review-resource-report.dto';
import { ResourceReportQueryDto } from './dto/resource-report-query.dto';

const uploadDestination = './public/uploads/resources';

@UseGuards(JwtAuthGuard, ClassroomRoleGuard)
@Controller('resources')
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Get()
  async getResources(
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @Query() query: ResourceQueryDto,
  ) {
    return this.resourcesService.findAllForClassroom(classroomId, user.id, query);
  }

  @Get('stats')
  async getResourceStats(
    @CurrentClassroom() classroomId: string,
    @Query() query: ResourceQueryDto,
  ) {
    return this.resourcesService.getStatsForClassroom(classroomId, query);
  }

  @Post()
  async createResource(
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @Body() data: any,
  ) {
    return this.resourcesService.createResource({
      classroomId,
      courseId: data.courseId,
      uploaderId: user.id,
      title: data.title,
      description: data.description,
      type: data.type || ResourceType.OTHER,
      externalUrl: data.externalUrl || null,
      tags: Array.isArray(data.tags) ? data.tags : [],
    });
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          if (!existsSync(uploadDestination)) {
            mkdirSync(uploadDestination, { recursive: true });
          }
          cb(null, uploadDestination);
        },
        filename: (_req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  async uploadResource(
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
    @Body() data: any
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const normalizedPath = file.path.replace(/\\/g, '/');
    const resource = await this.resourcesService.createResource({
      classroomId,
      courseId: data.courseId,
      uploaderId: user.id,
      title: data.title,
      description: data.description,
      type: data.type || ResourceType.NOTE,
      fileUrl: `/${normalizedPath}`,
      fileName: file.originalname,
      fileSize: file.size,
      tags: data.tags ? JSON.parse(data.tags) : [],
    });

    return resource;
  }

  @Put(':id')
  async updateResource(
    @Param('id') id: string,
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @Body() data: any,
  ) {
    return this.resourcesService.updateResource(id, user.id, classroomId, data);
  }

  @Put(':id/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          if (!existsSync(uploadDestination)) {
            mkdirSync(uploadDestination, { recursive: true });
          }
          cb(null, uploadDestination);
        },
        filename: (_req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async updateResourceWithFile(
    @Param('id') id: string,
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
    @Body() data: any,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    return this.resourcesService.updateResourceFile(
      id,
      user.id,
      classroomId,
      {
        title: data.title,
        description: data.description,
        courseId: data.courseId,
        type: data.type,
        tags: data.tags ? JSON.parse(data.tags) : [],
      },
      file,
    );
  }

  @Delete(':id')
  async deleteResource(
    @Param('id') id: string,
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
  ) {
    return this.resourcesService.deleteResource(id, user.id, classroomId);
  }

  @Post(':id/vote')
  async voteResource(
    @Param('id') id: string,
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @Body('voteType') voteType: VoteType
  ) {
    return this.resourcesService.vote(id, classroomId, user.id, voteType);
  }

  @Post(':id/report')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.STUDENT, UserRole.ADMIN, UserRole.OWNER)
  async reportResource(
    @Param('id') id: string,
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @Body() data: ReportResourceDto,
  ) {
    return this.resourcesService.reportResource(id, classroomId, user.id, data);
  }

  @Get('moderation/reports')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.ADMIN, UserRole.OWNER)
  async getResourceReports(
    @CurrentClassroom() classroomId: string,
    @Query() query: ResourceReportQueryDto,
  ) {
    return this.resourcesService.listReports(classroomId, query.status);
  }

  @Post('moderation/reports/:reportId/review')
  @UseGuards(ClassroomRoleGuard)
  @RequireClassroomRole(UserRole.ADMIN, UserRole.OWNER)
  async reviewResourceReport(
    @Param('reportId') reportId: string,
    @CurrentClassroom() classroomId: string,
    @CurrentUser() user: User,
    @Body() data: ReviewResourceReportDto,
  ) {
    return this.resourcesService.reviewReport(reportId, classroomId, user.id, data);
  }

  @Get(':id')
  async getResource(
    @Param('id') id: string,
    @CurrentClassroom() classroomId: string,
  ) {
    return this.resourcesService.findById(id, classroomId);
  }
}
