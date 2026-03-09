import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoungePost } from './entities/lounge-post.entity';
import { PaginationQueryDto, PaginatedResult } from '../../core/dto/pagination-query.dto';

@Injectable()
export class LoungeService {
  constructor(
    @InjectRepository(LoungePost) private postRepo: Repository<LoungePost>,
  ) {}

  async createPost(classroomId: string, authorId: string, data: Partial<LoungePost>) {
    const post = this.postRepo.create({
      ...data,
      classroomId,
      authorId,
      reactions: { '💀': 0, '🤡': 0, '🧠': 0, '🧢': 0 }, // Init default academic emojis
    });
    return this.postRepo.save(post);
  }

  async getFeed(classroomId: string, pagination: PaginationQueryDto): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20 } = pagination;

    const[posts, total] = await this.postRepo.findAndCount({
      where: { classroomId, parentId: undefined as any }, // Fetch only top-level posts
      relations: ['author', 'replies'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // CRITICAL: Strip identities for anonymous posts
    const sanitizedPosts = posts.map(post => {
      const sanitizedAuthor = post.isAnonymous
        ? { id: null, name: 'Anonymous', anonymousId: post.author.anonymousId, photoUrl: null }
        : { id: post.author.id, name: post.author.name, initials: post.author.initials, photoUrl: post.author.photoUrl };

      return {
        ...post,
        author: sanitizedAuthor,
        replyCount: post.replies.length,
        replies: undefined, // Don't send all replies in feed, fetch them on demand
      };
    });

    return {
      data: sanitizedPosts,
      meta: { total, page, limit, lastPage: Math.ceil(total / limit) }
    };
  }

  async reactToPost(postId: string, emoji: string) {
    const post = await this.postRepo.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');

    if (!post.reactions) post.reactions = {};
    post.reactions[emoji] = (post.reactions[emoji] || 0) + 1;

    // In a real app, track User-Reaction in a pivot table to prevent infinite clicking
    // but for "memes", sometimes infinite clicking is desired gamification.
    
    await this.postRepo.update(postId, { reactions: post.reactions });
    return post.reactions;
  }

  async getReplies(postId: string): Promise<any[]> {
    const replies = await this.postRepo.find({
      where: { parentId: postId },
      relations: ['author'],
      order: { createdAt: 'ASC' }
    });

    // Strip identities for anonymous replies
    return replies.map(reply => {
      const sanitizedAuthor = reply.isAnonymous
        ? { id: null, name: 'Anonymous', anonymousId: reply.author.anonymousId, photoUrl: null }
        : { id: reply.author.id, name: reply.author.name, initials: reply.author.initials, photoUrl: reply.author.photoUrl };

      return {
        ...reply,
        author: sanitizedAuthor
      };
    });
  }

  async addReply(parentId: string, authorId: string, data: Partial<LoungePost>): Promise<any> {
    const parentPost = await this.postRepo.findOne({ where: { id: parentId } });
    if (!parentPost) throw new NotFoundException('Parent post not found');

    const reply = this.postRepo.create({
      ...data,
      classroomId: parentPost.classroomId,
      authorId,
      parentId,
      reactions: { '💀': 0, '🤡': 0, '🧠': 0, '🧢': 0 }
    });

    const savedReply = await this.postRepo.save(reply);
    
    // Return sanitized reply
    const replyWithAuthor = await this.postRepo.findOne({ 
      where: { id: savedReply.id }, 
      relations: ['author'] 
    });
    
    if (!replyWithAuthor?.author) throw new NotFoundException('Author not found');

    const sanitizedAuthor = savedReply.isAnonymous
      ? { id: null, name: 'Anonymous', anonymousId: replyWithAuthor.author.anonymousId, photoUrl: null }
      : { id: replyWithAuthor.author.id, name: replyWithAuthor.author.name, initials: replyWithAuthor.author.initials, photoUrl: replyWithAuthor.author.photoUrl };

    return {
      ...savedReply,
      author: sanitizedAuthor
    };
  }
}
