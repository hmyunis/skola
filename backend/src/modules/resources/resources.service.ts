import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Resource } from './entities/resource.entity';
import { ResourceVote, VoteType } from './entities/resource-vote.entity';

@Injectable()
export class ResourcesService {
  constructor(
    @InjectRepository(Resource) private resourceRepo: Repository<Resource>,
    @InjectRepository(ResourceVote) private voteRepo: Repository<ResourceVote>,
  ) {}

  async findAllForClassroom(classroomId: string, courseId?: string) {
    const query = this.resourceRepo.createQueryBuilder('resource')
      .leftJoinAndSelect('resource.uploader', 'uploader')
      .where('resource.classroomId = :classroomId', { classroomId });

    if (courseId) {
      query.andWhere('resource.courseId = :courseId', { courseId });
    }

    // Sort by most helpful (upvotes - downvotes)
    query.orderBy('(resource.upvotes - resource.downvotes)', 'DESC');

    const resources = await query.getMany();
    
    // Sanitize uploader info before returning
    return resources.map(res => ({
      ...res,
      uploader: res.uploader ? { id: res.uploader.id, name: res.uploader.name, initials: res.uploader.initials } : null
    }));
  }

  async vote(resourceId: string, userId: string, voteType: VoteType) {
    const resource = await this.resourceRepo.findOne({ where: { id: resourceId } });
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
    return { upvotes: resource.upvotes, downvotes: resource.downvotes };
  }

  async createResource(data: Partial<Resource>): Promise<Resource> {
    const resource = this.resourceRepo.create(data);
    return this.resourceRepo.save(resource);
  }

  async findById(id: string): Promise<Resource> {
    const resource = await this.resourceRepo.findOne({ 
      where: { id },
      relations: ['uploader']
    });
    if (!resource) throw new NotFoundException('Resource not found');
    return resource;
  }
}
