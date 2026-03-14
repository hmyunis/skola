import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { LoungePost } from './entities/lounge-post.entity';
import { LoungeReaction } from './entities/lounge-reaction.entity';
import { PaginationQueryDto, PaginatedResult } from '../../core/dto/pagination-query.dto';
import { User, UserRole } from '../users/entities/user.entity';
import { ClassroomsService } from '../classrooms/classrooms.service';

interface LoungeFeedQueryDto {
  page?: number;
  limit?: number;
  search?: string;
  tag?: string;
  course?: string;
  sort?: string;
}

interface FeedFilters {
  search?: string;
  tag?: string;
  course?: string;
  sort?: string; // 'newest' | 'trending' | 'discussed'
}

@Injectable()
export class LoungeService {
  constructor(
    @InjectRepository(LoungePost) private postRepo: Repository<LoungePost>,
    @InjectRepository(LoungeReaction) private reactionRepo: Repository<LoungeReaction>,
    private classroomService: ClassroomsService,
  ) {}

  async createPost(classroomId: string, authorId: string, data: { content: string; tags?: string[]; course?: string; isAnonymous?: boolean }) {
    if (data.isAnonymous) {
      const classroom = await this.classroomService.getClassroomById(classroomId);
      const feature = (classroom.featureToggles as any[])?.find(f => f.id === 'ft-anon-posting');
      if (feature && !feature.enabled) {
        throw new BadRequestException('Anonymous posting is disabled in this classroom');
      }
    }

    const post = this.postRepo.create({
      content: data.content,
      tags: data.tags || [],
      course: data.course || undefined,
      isAnonymous: data.isAnonymous ?? false,
      classroomId,
      authorId,
      reactions: { '🧠': 0, '💀': 0, '🔥': 0, '📚': 0, '😭': 0, '🤝': 0 },
    });
    const saved = await this.postRepo.save(post);

    const withAuthor = await this.postRepo.findOne({
      where: { id: saved.id },
      relations: ['author'],
    });

    if (!withAuthor) throw new NotFoundException('Post not found after creation');

    return { ...this.sanitizePost(withAuthor, 0), userReaction: null };
  }

  async getFeed(classroomId: string, pagination: PaginationQueryDto, filters: FeedFilters, userId?: string): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20 } = pagination;

    const qb = this.postRepo.createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .loadRelationCountAndMap('post.replyCount', 'post.replies')
      .where('post.classroomId = :classroomId', { classroomId })
      .andWhere('post.parentId IS NULL');

    if (filters.search) {
      qb.andWhere('post.content LIKE :search', { search: `%${filters.search}%` });
    }

    if (filters.tag) {
      qb.andWhere('post.tags LIKE :tag', { tag: `%${filters.tag}%` });
    }

    if (filters.course) {
      qb.andWhere('post.course = :course', { course: filters.course });
    }

    qb.orderBy('post.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [posts, total] = await qb.getManyAndCount();

    // Batch-fetch the current user's reactions for all posts in this page
    let userReactionMap: Record<string, string> = {};
    if (userId && posts.length > 0) {
      const postIds = posts.map(p => p.id);
      const userReactions = await this.reactionRepo
        .createQueryBuilder('r')
        .where('r.userId = :userId', { userId })
        .andWhere('r.postId IN (:...postIds)', { postIds })
        .getMany();
      for (const r of userReactions) {
        userReactionMap[r.postId] = r.emoji;
      }
    }

    const sanitizedPosts = posts.map(post => {
      const replyCount = (post as any).replyCount ?? 0;
      return {
        ...this.sanitizePost(post, replyCount),
        userReaction: userReactionMap[post.id] ?? null,
      };
    });

    return {
      data: sanitizedPosts,
      meta: { total, page, limit, lastPage: Math.ceil(total / limit) }
    };
  }

  async editPost(postId: string, userId: string, data: { content?: string; tags?: string[]; course?: string }) {
    const post = await this.postRepo.findOne({ where: { id: postId }, relations: ['author'] });
    if (!post) throw new NotFoundException('Post not found');
    if (post.authorId !== userId) throw new ForbiddenException('You can only edit your own posts');

    if (data.content !== undefined) post.content = data.content;
    if (data.tags !== undefined) post.tags = data.tags;
    if (data.course !== undefined) post.course = data.course;

    await this.postRepo.save(post);
    return this.sanitizePost(post, 0);
  }

  async deletePost(postId: string, user: User) {
    const post = await this.postRepo.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');

    const isAuthor = post.authorId === user.id;
    const isPrivileged = user.role === UserRole.ADMIN || user.role === UserRole.OWNER;

    if (!isAuthor && !isPrivileged) {
      throw new ForbiddenException('You do not have permission to delete this post');
    }

    await this.postRepo.remove(post);
    return { deleted: true };
  }

  async reactToPost(postId: string, userId: string, emoji: string) {
    const post = await this.postRepo.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');
    if (!post.reactions) post.reactions = {};

    const existing = await this.reactionRepo.findOne({
      where: { postId, userId },
    });

    let userReaction: string | null = null;

    if (existing) {
      if (existing.emoji === emoji) {
        // Same emoji clicked again — toggle off
        post.reactions[emoji] = Math.max((post.reactions[emoji] || 0) - 1, 0);
        await this.reactionRepo.remove(existing);
        userReaction = null;
      } else {
        // Different emoji — remove old, apply new
        post.reactions[existing.emoji] = Math.max((post.reactions[existing.emoji] || 0) - 1, 0);
        post.reactions[emoji] = (post.reactions[emoji] || 0) + 1;
        existing.emoji = emoji;
        await this.reactionRepo.save(existing);
        userReaction = emoji;
      }
    } else {
      // No existing reaction — add new
      post.reactions[emoji] = (post.reactions[emoji] || 0) + 1;
      await this.reactionRepo.save(this.reactionRepo.create({ postId, userId, emoji }));
      userReaction = emoji;
    }

    await this.postRepo.update(postId, { reactions: post.reactions });
    return { reactions: post.reactions, userReaction };
  }

  async getReplies(postId: string): Promise<any[]> {
    const replies = await this.postRepo.find({
      where: { parentId: postId },
      relations: ['author'],
      order: { createdAt: 'ASC' }
    });

    return replies.map(reply => this.sanitizeReply(reply));
  }

  async addReply(parentId: string, authorId: string, data: { content: string; isAnonymous?: boolean }): Promise<any> {
    const parentPost = await this.postRepo.findOne({ where: { id: parentId } });
    if (!parentPost) throw new NotFoundException('Parent post not found');

    if (data.isAnonymous) {
      const classroom = await this.classroomService.getClassroomById(parentPost.classroomId);
      const feature = (classroom.featureToggles as any[])?.find(f => f.id === 'ft-anon-posting');
      if (feature && !feature.enabled) {
        throw new BadRequestException('Anonymous posting is disabled in this classroom');
      }
    }

    const reply = this.postRepo.create({
      content: data.content,
      isAnonymous: data.isAnonymous ?? false,
      classroomId: parentPost.classroomId,
      authorId,
      parentId,
      reactions: { '🧠': 0, '💀': 0, '🔥': 0, '📚': 0, '😭': 0, '🤝': 0 },
    });

    const savedReply = await this.postRepo.save(reply);
    
    const replyWithAuthor = await this.postRepo.findOne({ 
      where: { id: savedReply.id }, 
      relations: ['author'] 
    });
    
    if (!replyWithAuthor?.author) throw new NotFoundException('Author not found');

    return this.sanitizeReply(replyWithAuthor);
  }

  async deleteReply(replyId: string, user: User) {
    const reply = await this.postRepo.findOne({ where: { id: replyId } });
    if (!reply) throw new NotFoundException('Reply not found');

    const isAuthor = reply.authorId === user.id;
    const isPrivileged = user.role === UserRole.ADMIN || user.role === UserRole.OWNER;

    if (!isAuthor && !isPrivileged) {
      throw new ForbiddenException('You do not have permission to delete this reply');
    }

    await this.postRepo.remove(reply);
    return { deleted: true };
  }

  // ─── Helpers ───

  private sanitizePost(post: LoungePost, replyCount: number) {
    const sanitizedAuthor = post.isAnonymous
      ? { id: null, name: 'Anonymous', anonymousId: post.author?.anonymousId ?? null, photoUrl: null }
      : {
          id: post.author?.id ?? null,
          name: post.author?.name ?? 'Unknown',
          initials: post.author?.initials ?? '??',
          photoUrl: post.author?.photoUrl ?? null,
        };

    return {
      id: post.id,
      content: post.content,
      tags: post.tags,
      course: post.course,
      isAnonymous: post.isAnonymous,
      reactions: post.reactions ?? {},
      replyCount,
      author: sanitizedAuthor,
      authorId: post.authorId,
      createdAt: post.createdAt,
    };
  }

  private sanitizeReply(reply: LoungePost) {
    const sanitizedAuthor = reply.isAnonymous
      ? { id: null, name: 'Anonymous', anonymousId: reply.author?.anonymousId ?? null, photoUrl: null }
      : {
          id: reply.author?.id ?? null,
          name: reply.author?.name ?? 'Unknown',
          initials: reply.author?.initials ?? '??',
          photoUrl: reply.author?.photoUrl ?? null,
        };

    return {
      id: reply.id,
      content: reply.content,
      isAnonymous: reply.isAnonymous,
      reactions: reply.reactions ?? {},
      author: sanitizedAuthor,
      authorId: reply.authorId,
      createdAt: reply.createdAt,
    };
  }
}
