import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import { Resource } from './entities/resource.entity';
import { ResourceVote, VoteType } from './entities/resource-vote.entity';
import { ResourceReport, ResourceReportStatus } from './entities/resource-report.entity';
import { ClassroomMember } from '../classrooms/entities/classroom-member.entity';
import { UserRole } from '../users/entities/user.entity';
import { ResourceQueryDto } from './dto/resource-query.dto';

@Injectable()
export class ResourcesService {
  constructor(
    @InjectRepository(Resource) private resourceRepo: Repository<Resource>,
    @InjectRepository(ResourceVote) private voteRepo: Repository<ResourceVote>,
    @InjectRepository(ResourceReport) private reportRepo: Repository<ResourceReport>,
    @InjectRepository(ClassroomMember) private memberRepo: Repository<ClassroomMember>,
  ) {}

  private async getClassroomRole(classroomId: string, userId: string): Promise<UserRole | null> {
    const member = await this.memberRepo.findOne({
      where: { classroom: { id: classroomId }, user: { id: userId } },
    });
    return member?.role || null;
  }

  private async canModerate(classroomId: string, userId: string): Promise<boolean> {
    const role = await this.getClassroomRole(classroomId, userId);
    return role === UserRole.ADMIN || role === UserRole.OWNER;
  }

  private toResponse(resource: Resource, userVote?: VoteType | null) {
    return {
      ...resource,
      uploader: resource.uploader
        ? { id: resource.uploader.id, name: resource.uploader.name, initials: resource.uploader.initials }
        : null,
      userVote: userVote || null,
    };
  }

  private applyResourceFilters(
    query: SelectQueryBuilder<Resource>,
    queryDto: ResourceQueryDto,
  ) {
    if (queryDto.courseId) {
      query.andWhere('resource.courseId = :courseId', { courseId: queryDto.courseId });
    }

    if (queryDto.type) {
      query.andWhere('resource.type = :type', { type: queryDto.type });
    }

    if (queryDto.search?.trim()) {
      const search = `%${queryDto.search.trim()}%`;
      query.andWhere(
        '(resource.title LIKE :search OR resource.description LIKE :search OR resource.tags LIKE :search OR course.code LIKE :search OR course.name LIKE :search)',
        { search },
      );
    }
  }

  async findAllForClassroom(classroomId: string, userId: string, queryDto: ResourceQueryDto) {
    const page = queryDto.page || 1;
    const limit = queryDto.limit || 20;

    const query = this.resourceRepo
      .createQueryBuilder('resource')
      .leftJoinAndSelect('resource.uploader', 'uploader')
      .leftJoinAndSelect('resource.course', 'course')
      .where('resource.classroomId = :classroomId', { classroomId });

    this.applyResourceFilters(query, queryDto);

    const total = await query.clone().getCount();

    query
      .orderBy('resource.upvotes', 'DESC')
      .addOrderBy('resource.downvotes', 'ASC')
      .addOrderBy('resource.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const resources = await query.getMany();

    const votes = resources.length
      ? await this.voteRepo.find({
          where: {
            userId,
            resourceId: In(resources.map((r) => r.id)),
          },
        })
      : [];
    const voteMap = new Map(votes.map((v) => [v.resourceId, v.vote]));

    return {
      data: resources.map((res) => this.toResponse(res, voteMap.get(res.id) || null)),
      meta: {
        total,
        page,
        limit,
        lastPage: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getStatsForClassroom(classroomId: string, queryDto: ResourceQueryDto) {
    const query = this.resourceRepo
      .createQueryBuilder('resource')
      .leftJoin('resource.course', 'course')
      .where('resource.classroomId = :classroomId', { classroomId });

    this.applyResourceFilters(query, queryDto);

    const statsRaw = await query
      .select('COUNT(resource.id)', 'totalResources')
      .addSelect('COALESCE(SUM(resource.upvotes), 0)', 'totalUpvotes')
      .addSelect('COALESCE(SUM(resource.downvotes), 0)', 'totalDownvotes')
      .addSelect('COUNT(DISTINCT resource.type)', 'totalTypes')
      .getRawOne();

    return {
      totalResources: Number(statsRaw?.totalResources || 0),
      totalUpvotes: Number(statsRaw?.totalUpvotes || 0),
      totalDownvotes: Number(statsRaw?.totalDownvotes || 0),
      totalTypes: Number(statsRaw?.totalTypes || 0),
    };
  }

  async vote(
    resourceId: string,
    classroomId: string,
    userId: string,
    voteType: VoteType,
  ) {
    const resource = await this.resourceRepo.findOne({
      where: { id: resourceId, classroomId },
    });
    if (!resource) throw new NotFoundException('Resource not found');

    let existingVote = await this.voteRepo.findOne({ where: { resourceId, userId } });

    if (existingVote) {
      if (existingVote.vote === voteType) {
        // Toggle off if clicking the same vote
        await this.voteRepo.remove(existingVote);
        voteType === VoteType.UP ? resource.upvotes-- : resource.downvotes--;
      } else {
        // Switch vote
        existingVote.vote = voteType;
        await this.voteRepo.save(existingVote);
        if (voteType === VoteType.UP) {
          resource.upvotes++; resource.downvotes--;
        } else {
          resource.upvotes--; resource.downvotes++;
        }
      }
    } else {
      // New vote
      const newVote = this.voteRepo.create({ resourceId, userId, vote: voteType });
      await this.voteRepo.save(newVote);
      voteType === VoteType.UP ? resource.upvotes++ : resource.downvotes++;
    }

    await this.resourceRepo.save(resource);
    const currentVote = await this.voteRepo.findOne({ where: { resourceId, userId } });
    return { upvotes: resource.upvotes, downvotes: resource.downvotes, userVote: currentVote?.vote || null };
  }

  async createResource(data: Partial<Resource>): Promise<Resource> {
    if (!data.fileUrl && !data.externalUrl) {
      throw new BadRequestException('Either fileUrl or externalUrl must be provided');
    }

    const resource = this.resourceRepo.create(data);
    const saved = await this.resourceRepo.save(resource);
    const full = await this.resourceRepo.findOne({
      where: { id: saved.id },
      relations: ['uploader', 'course'],
    });
    if (!full) throw new NotFoundException('Resource not found after create');
    return full;
  }

  async updateResource(resourceId: string, userId: string, classroomId: string, data: Partial<Resource>) {
    const resource = await this.resourceRepo.findOne({
      where: { id: resourceId },
      relations: ['uploader', 'course'],
    });
    if (!resource) throw new NotFoundException('Resource not found');
    if (resource.classroomId !== classroomId) throw new ForbiddenException('Not allowed in this classroom');

    const canEdit = resource.uploaderId === userId;
    if (!canEdit) {
      throw new ForbiddenException('Only the resource owner can edit this resource');
    }

    Object.assign(resource, data);
    const saved = await this.resourceRepo.save(resource);
    return this.toResponse(saved);
  }

  async updateResourceFile(
    resourceId: string,
    userId: string,
    classroomId: string,
    data: Partial<Resource>,
    file: Express.Multer.File,
  ) {
    const resource = await this.resourceRepo.findOne({
      where: { id: resourceId },
      relations: ['uploader', 'course'],
    });
    if (!resource) throw new NotFoundException('Resource not found');
    if (resource.classroomId !== classroomId) throw new ForbiddenException('Not allowed in this classroom');

    const canEdit = resource.uploaderId === userId;
    if (!canEdit) {
      throw new ForbiddenException('Only the resource owner can edit this resource');
    }

    const normalizedPath = file.path.replace(/\\/g, '/');
    Object.assign(resource, {
      ...data,
      fileUrl: `/${normalizedPath}`,
      fileName: file.originalname,
      fileSize: file.size,
      externalUrl: null,
    });

    const saved = await this.resourceRepo.save(resource);
    return this.toResponse(saved);
  }

  async deleteResource(resourceId: string, userId: string, classroomId: string) {
    const resource = await this.resourceRepo.findOne({ where: { id: resourceId } });
    if (!resource) throw new NotFoundException('Resource not found');
    if (resource.classroomId !== classroomId) throw new ForbiddenException('Not allowed in this classroom');

    const canDelete = resource.uploaderId === userId || (await this.canModerate(classroomId, userId));
    if (!canDelete) {
      throw new ForbiddenException('You can only delete your own resources');
    }

    await this.resourceRepo.remove(resource);
    return { success: true };
  }

  async reportResource(
    resourceId: string,
    classroomId: string,
    reporterId: string,
    data: { reason: string; details?: string },
  ) {
    const resource = await this.resourceRepo.findOne({ where: { id: resourceId } });
    if (!resource) throw new NotFoundException('Resource not found');
    if (resource.classroomId !== classroomId) throw new ForbiddenException('Not allowed in this classroom');
    if (resource.uploaderId === reporterId) {
      throw new BadRequestException('You cannot report your own resource');
    }

    const reason = (data.reason || '').trim();
    if (!reason) {
      throw new BadRequestException('Reason is required');
    }

    const existing = await this.reportRepo.findOne({
      where: { resourceId, reporterId, status: ResourceReportStatus.PENDING },
    });
    if (existing) {
      throw new BadRequestException('You already submitted a pending report for this resource');
    }

    const report = this.reportRepo.create({
      resourceId,
      classroomId,
      reporterId,
      reason,
      details: data.details?.trim() || undefined,
    });
    return this.reportRepo.save(report);
  }

  async listReports(classroomId: string, status?: ResourceReportStatus) {
    const where: any = { classroomId };
    if (status) where.status = status;

    const reports = await this.reportRepo.find({
      where,
      relations: ['resource', 'resource.uploader', 'reporter', 'reviewedBy'],
      order: { createdAt: 'DESC' },
    });

    return reports.map((report) => ({
      id: report.id,
      type: 'resource',
      contentId: report.resourceId,
      content: report.resource?.title || 'Deleted resource',
      author: report.resource?.uploader?.name || 'Unknown',
      reason: report.reason,
      details: report.details,
      reportedBy: report.reporter?.name || 'Unknown',
      reportedAt: report.createdAt,
      status: report.status,
      reviewedAt: report.reviewedAt,
      reviewedBy: report.reviewedBy?.name,
    }));
  }

  async reviewReport(
    reportId: string,
    classroomId: string,
    reviewerId: string,
    data: { status: ResourceReportStatus.RESOLVED | ResourceReportStatus.DISMISSED; removeResource?: boolean },
  ) {
    const report = await this.reportRepo.findOne({ where: { id: reportId }, relations: ['resource'] });
    if (!report) throw new NotFoundException('Report not found');
    if (report.classroomId !== classroomId) throw new ForbiddenException('Not allowed in this classroom');
    if (report.status !== ResourceReportStatus.PENDING) {
      throw new BadRequestException('This report was already reviewed');
    }

    report.status = data.status;
    report.reviewedById = reviewerId;
    report.reviewedAt = new Date();
    await this.reportRepo.save(report);

    if (data.status === ResourceReportStatus.RESOLVED && data.removeResource && report.resource) {
      await this.resourceRepo.remove(report.resource);
      await this.reportRepo.update(
        { resourceId: report.resourceId, status: ResourceReportStatus.PENDING },
        {
          status: ResourceReportStatus.RESOLVED,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
        },
      );
    }

    return { success: true };
  }

  async findById(id: string, classroomId: string): Promise<Resource> {
    const resource = await this.resourceRepo.findOne({ 
      where: { id, classroomId },
      relations: ['uploader', 'course']
    });
    if (!resource) throw new NotFoundException('Resource not found');
    return resource;
  }
}
