import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Repository } from 'typeorm';
import { LoungePost } from './entities/lounge-post.entity';
import { LoungeReaction } from './entities/lounge-reaction.entity';
import { PaginationQueryDto, PaginatedResult } from '../../core/dto/pagination-query.dto';
import { User, UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { ClassroomsService } from '../classrooms/classrooms.service';
import { LoungeReport, LoungeReportContentType, LoungeReportStatus } from './entities/lounge-report.entity';
import { CreateLoungePostDto } from './dto/create-lounge-post.dto';
import { ClassroomMember } from '../classrooms/entities/classroom-member.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { LoungeMentionUsersQueryDto } from './dto/lounge-mention-users-query.dto';

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

interface ImageUploadResult {
  imageUrl: string;
}

interface MentionParseResult {
  mentionedEveryone: boolean;
  tokens: Set<string>;
}

@Injectable()
export class LoungeService {
  private readonly logger = new Logger(LoungeService.name);
  private readonly globalImgbbApiKey: string;
  private readonly maxImageBytes = 8 * 1024 * 1024;
  private readonly allowedImageMimeTypes = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
  ]);

  constructor(
    @InjectRepository(LoungePost) private postRepo: Repository<LoungePost>,
    @InjectRepository(LoungeReaction) private reactionRepo: Repository<LoungeReaction>,
    @InjectRepository(LoungeReport) private reportRepo: Repository<LoungeReport>,
    @InjectRepository(ClassroomMember)
    private classroomMembersRepo: Repository<ClassroomMember>,
    private classroomService: ClassroomsService,
    private usersService: UsersService,
    private notificationsService: NotificationsService,
    private configService: ConfigService,
  ) {
    this.globalImgbbApiKey = (this.configService.get<string>('IMGBB_API_KEY') || '').trim();
  }

  async searchMentionableUsers(
    classroomId: string,
    query: LoungeMentionUsersQueryDto,
  ): Promise<
    PaginatedResult<{
      id: string;
      name: string;
      username: string | null;
      mentionKey: string;
    }>
  > {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.max(1, Math.min(50, Number(query.limit || 20)));
    const rawQ = (query.q || '').trim().replace(/^@+/, '').toLowerCase();

    const qb = this.classroomMembersRepo
      .createQueryBuilder('member')
      .innerJoinAndSelect('member.user', 'user')
      .innerJoin('member.classroom', 'classroom')
      .where('classroom.id = :classroomId', { classroomId });

    if (rawQ) {
      qb.andWhere(
        '(LOWER(user.name) LIKE :query OR LOWER(user.telegramUsername) LIKE :query OR LOWER(user.id) LIKE :query)',
        { query: `%${rawQ}%` },
      );
    }

    qb
      .orderBy('user.name', 'ASC')
      .addOrderBy('user.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [members, total] = await qb.getManyAndCount();
    const data = members.map((member) => {
      const username = this.normalizeTelegramUsername(member.user?.telegramUsername);
      const mentionKey = username || member.user.id;
      return {
        id: member.user.id,
        name: member.user.name || 'Unknown',
        username,
        mentionKey,
      };
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        lastPage: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async createPost(classroomId: string, authorId: string, data: CreateLoungePostDto) {
    if (data.isAnonymous) {
      const classroom = await this.classroomService.getClassroomById(classroomId);
      const feature = (classroom.featureToggles as any[])?.find(f => f.id === 'ft-anon-posting');
      if (feature && !feature.enabled) {
        throw new BadRequestException('Anonymous posting is disabled in this classroom');
      }
    }

    const content = (data.content || '').trim();
    const normalizedCourse = (data.course || '').trim();
    const normalizedTags = this.normalizeTags(data.tags);

    const hasImage = Boolean(data.imageDataUrl?.trim());
    if (!content && !hasImage) {
      throw new BadRequestException('Post content or image is required');
    }

    let imageUploadResult: ImageUploadResult | null = null;
    if (hasImage) {
      const uploadApiKey = await this.resolveApiKeyForUpload(authorId);
      imageUploadResult = await this.uploadImageToImgBb(
        data.imageDataUrl!,
        data.imageName,
        uploadApiKey,
      );
    }

    const post = this.postRepo.create({
      content,
      imageUrl: imageUploadResult?.imageUrl || null,
      tags: normalizedTags,
      course: normalizedCourse || undefined,
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

    await this.dispatchMentionNotificationsForContentChange({
      contextLabel: `post ${withAuthor.id}`,
      classroomId,
      postId: withAuthor.id,
      content,
      authorId,
      authorDisplayName: withAuthor.isAnonymous
        ? 'Someone'
        : withAuthor.author?.name || 'Someone',
    });

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

    const previousContent = post.content || '';
    let changed = false;

    if (data.content !== undefined) {
      const nextContent = String(data.content ?? '').trim();
      if (nextContent !== post.content) {
        post.content = nextContent;
        changed = true;
      }
    }

    if (data.tags !== undefined) {
      const nextTags = this.normalizeTags(data.tags);
      if (!this.areStringArraysEqual(post.tags || [], nextTags)) {
        post.tags = nextTags;
        changed = true;
      }
    }

    if (data.course !== undefined) {
      const nextCourse = String(data.course ?? '').trim();
      if ((post.course || '') !== nextCourse) {
        post.course = nextCourse || null;
        changed = true;
      }
    }

    if (!changed) {
      return this.sanitizePost(post, 0);
    }

    post.editedAt = new Date();

    await this.postRepo.save(post);

    if (data.content !== undefined) {
      await this.dispatchMentionNotificationsForContentChange({
        contextLabel: `edited post ${post.id}`,
        classroomId: post.classroomId,
        postId: post.id,
        content: post.content || '',
        previousContent,
        authorId: post.authorId,
        authorDisplayName: post.isAnonymous ? 'Someone' : post.author?.name || 'Someone',
      });
    }

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

    const normalizedContent = String(data.content || '').trim();
    if (!normalizedContent) {
      throw new BadRequestException('Reply content is required');
    }

    const reply = this.postRepo.create({
      content: normalizedContent,
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

    await this.dispatchMentionNotificationsForContentChange({
      contextLabel: `reply ${replyWithAuthor.id}`,
      classroomId: parentPost.classroomId,
      postId: replyWithAuthor.id,
      content: normalizedContent,
      authorId,
      authorDisplayName: replyWithAuthor.isAnonymous
        ? 'Someone'
        : replyWithAuthor.author?.name || 'Someone',
    });

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

  async reportContent(
    classroomId: string,
    reporterId: string,
    dto: { contentType: 'post' | 'reply'; contentId: string; reason: string; details?: string },
  ) {
    const content = await this.postRepo.findOne({
      where: { id: dto.contentId, classroomId },
      relations: ['author'],
    });
    if (!content) throw new NotFoundException('Content not found');

    if (dto.contentType === 'reply' && !content.parentId) {
      throw new BadRequestException('Reply content ID is invalid');
    }
    if (dto.contentType === 'post' && content.parentId) {
      throw new BadRequestException('Post content ID is invalid');
    }
    if (content.authorId === reporterId) {
      throw new BadRequestException('You cannot report your own content');
    }

    const reason = (dto.reason || '').trim();
    if (!reason) {
      throw new BadRequestException('Reason is required');
    }

    const existing = await this.reportRepo.findOne({
      where: {
        classroomId,
        postId: content.id,
        reporterId,
        contentType: dto.contentType === 'reply' ? LoungeReportContentType.REPLY : LoungeReportContentType.POST,
        status: LoungeReportStatus.PENDING,
      },
    });
    if (existing) {
      throw new BadRequestException('You already submitted a pending report for this content');
    }

    const report = this.reportRepo.create({
      classroomId,
      postId: content.id,
      reporterId,
      contentType: dto.contentType === 'reply' ? LoungeReportContentType.REPLY : LoungeReportContentType.POST,
      reason,
      details: dto.details?.trim() || undefined,
    });
    return this.reportRepo.save(report);
  }

  async listReports(
    classroomId: string,
    status?: LoungeReportStatus,
    type?: LoungeReportContentType,
  ) {
    const where: any = { classroomId };
    if (status) where.status = status;
    if (type) where.contentType = type;

    const reports = await this.reportRepo.find({
      where,
      relations: ['post', 'post.author', 'reporter', 'reviewedBy'],
      order: { createdAt: 'DESC' },
    });

    return reports.map((report) => ({
      id: report.id,
      type: report.contentType,
      contentId: report.postId,
      content: report.post?.content || (report.post?.imageUrl ? '[Image attachment]' : 'Deleted content'),
      author: report.post?.author?.name || 'Unknown',
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
    dto: { status: 'resolved' | 'dismissed'; removeContent?: boolean },
  ) {
    const report = await this.reportRepo.findOne({
      where: { id: reportId, classroomId },
      relations: ['post'],
    });
    if (!report) throw new NotFoundException('Report not found');
    if (report.status !== LoungeReportStatus.PENDING) {
      throw new BadRequestException('This report was already reviewed');
    }

    report.status = dto.status === 'resolved' ? LoungeReportStatus.RESOLVED : LoungeReportStatus.DISMISSED;
    report.reviewedById = reviewerId;
    report.reviewedAt = new Date();
    await this.reportRepo.save(report);

    if (dto.status === 'resolved' && dto.removeContent && report.post) {
      await this.postRepo.remove(report.post);
      await this.reportRepo.update(
        {
          classroomId,
          postId: report.postId,
          status: LoungeReportStatus.PENDING,
        },
        {
          status: LoungeReportStatus.RESOLVED,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
        },
      );
    }

    return { success: true };
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
      imageUrl: post.imageUrl || null,
      tags: post.tags,
      course: post.course,
      isAnonymous: post.isAnonymous,
      reactions: post.reactions ?? {},
      replyCount,
      author: sanitizedAuthor,
      authorId: post.authorId,
      createdAt: post.createdAt,
      editedAt: post.editedAt || null,
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
      editedAt: reply.editedAt || null,
    };
  }

  private normalizeTags(tags?: string[]): string[] {
    if (!Array.isArray(tags) || tags.length === 0) return [];

    const seen = new Set<string>();
    const normalized: string[] = [];
    for (const tag of tags) {
      const value = String(tag || '').trim().toLowerCase();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      normalized.push(value.slice(0, 32));
      if (normalized.length >= 6) break;
    }
    return normalized;
  }

  private areStringArraysEqual(a: string[], b: string[]) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  private sanitizeImageName(imageName?: string): string | undefined {
    const trimmed = (imageName || '').trim();
    if (!trimmed) return undefined;

    const withoutExt = trimmed.replace(/\.[^./\\]+$/, '');
    const normalized = withoutExt
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);

    return normalized || undefined;
  }

  private parseImagePayload(imageDataUrl: string) {
    const raw = imageDataUrl.trim();
    if (!raw) {
      throw new BadRequestException('Image payload is empty');
    }

    let mimeType = '';
    let base64Payload = raw;

    if (raw.startsWith('data:')) {
      const match = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/i);
      if (!match) {
        throw new BadRequestException('Invalid image format. Use a base64 image data URL.');
      }
      mimeType = match[1].toLowerCase();
      base64Payload = match[2];
    }

    base64Payload = base64Payload.replace(/\s/g, '');
    if (!base64Payload) {
      throw new BadRequestException('Image payload is empty');
    }
    if (!/^[A-Za-z0-9+/=]+$/.test(base64Payload)) {
      throw new BadRequestException('Image payload is not valid base64');
    }

    if (mimeType && !this.allowedImageMimeTypes.has(mimeType)) {
      throw new BadRequestException('Unsupported image type. Use JPG, PNG, WEBP, or GIF.');
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64Payload, 'base64');
    } catch {
      throw new BadRequestException('Image payload is not valid base64');
    }
    if (!buffer.length) {
      throw new BadRequestException('Image payload is empty');
    }
    if (buffer.length > this.maxImageBytes) {
      throw new BadRequestException('Image is too large. Max size is 8MB.');
    }

    const detectedMime = this.detectImageMimeType(buffer);
    const normalizedMime = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType;
    if (normalizedMime && detectedMime && normalizedMime !== detectedMime) {
      throw new BadRequestException('Image payload does not match its MIME type.');
    }

    const finalMime = detectedMime || normalizedMime;
    if (!finalMime || !this.allowedImageMimeTypes.has(finalMime)) {
      throw new BadRequestException('Unsupported image type. Use JPG, PNG, WEBP, or GIF.');
    }

    return {
      base64Payload: buffer.toString('base64'),
    };
  }

  private detectImageMimeType(buffer: Buffer): string | null {
    if (buffer.length >= 8
      && buffer[0] === 0x89
      && buffer[1] === 0x50
      && buffer[2] === 0x4e
      && buffer[3] === 0x47
      && buffer[4] === 0x0d
      && buffer[5] === 0x0a
      && buffer[6] === 0x1a
      && buffer[7] === 0x0a) {
      return 'image/png';
    }

    if (buffer.length >= 3
      && buffer[0] === 0xff
      && buffer[1] === 0xd8
      && buffer[2] === 0xff) {
      return 'image/jpeg';
    }

    if (buffer.length >= 6) {
      const gifHeader = buffer.subarray(0, 6).toString('ascii');
      if (gifHeader === 'GIF87a' || gifHeader === 'GIF89a') {
        return 'image/gif';
      }
    }

    if (buffer.length >= 12) {
      const riff = buffer.subarray(0, 4).toString('ascii');
      const webp = buffer.subarray(8, 12).toString('ascii');
      if (riff === 'RIFF' && webp === 'WEBP') {
        return 'image/webp';
      }
    }

    return null;
  }

  private normalizeImgBbDirectUrl(input: unknown): string | null {
    if (typeof input !== 'string' || !input.trim()) return null;

    try {
      const parsed = new URL(input);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

      const host = parsed.hostname.toLowerCase();
      if (!host.includes('ibb.co') && !host.includes('imgbb.com')) return null;
      return parsed.toString();
    } catch {
      return null;
    }
  }

  private async resolveMentionRecipientIds(
    classroomId: string,
    authorId: string,
    content: string,
  ): Promise<{ recipientUserIds: string[]; mentionedEveryone: boolean }> {
    const parsed = this.parseMentions(content);
    if (!parsed.mentionedEveryone && parsed.tokens.size === 0) {
      return { recipientUserIds: [], mentionedEveryone: false };
    }

    const members = await this.classroomMembersRepo.find({
      where: { classroom: { id: classroomId } },
      relations: ['user'],
    });

    const recipients = new Set<string>();
    const byUsername = new Map<string, string>();
    const byId = new Map<string, string>();

    for (const member of members) {
      const userId = member.user?.id;
      if (!userId) continue;
      byId.set(userId.toLowerCase(), userId);

      const username = this.normalizeTelegramUsername(member.user.telegramUsername);
      if (username) {
        byUsername.set(username.toLowerCase(), userId);
      }
    }

    if (parsed.mentionedEveryone) {
      for (const member of members) {
        const userId = member.user?.id;
        if (!userId || userId === authorId) continue;
        recipients.add(userId);
      }
    }

    for (const token of parsed.tokens) {
      const normalized = token.toLowerCase();
      const matchedId = byUsername.get(normalized) || byId.get(normalized);
      if (!matchedId || matchedId === authorId) continue;
      recipients.add(matchedId);
    }

    return {
      recipientUserIds: Array.from(recipients),
      mentionedEveryone: parsed.mentionedEveryone,
    };
  }

  private async dispatchMentionNotificationsForContentChange(options: {
    contextLabel: string;
    classroomId: string;
    postId: string;
    content: string;
    authorId: string;
    authorDisplayName: string;
    previousContent?: string;
  }) {
    const {
      contextLabel,
      classroomId,
      postId,
      content,
      authorId,
      authorDisplayName,
      previousContent,
    } = options;

    try {
      const nextMentions = await this.resolveMentionRecipientIds(
        classroomId,
        authorId,
        content,
      );

      let recipientUserIds = nextMentions.recipientUserIds;
      let mentionedEveryone = nextMentions.mentionedEveryone;

      if (previousContent !== undefined) {
        const previousMentions = await this.resolveMentionRecipientIds(
          classroomId,
          authorId,
          previousContent,
        );
        if (previousMentions.recipientUserIds.length) {
          const previouslyNotified = new Set(previousMentions.recipientUserIds);
          recipientUserIds = recipientUserIds.filter(
            (userId) => !previouslyNotified.has(userId),
          );
        }
        mentionedEveryone =
          nextMentions.mentionedEveryone && !previousMentions.mentionedEveryone;
      }

      if (!recipientUserIds.length) {
        return;
      }

      await this.notificationsService.dispatchLoungeMentionNotifications({
        classroomId,
        postId,
        content,
        authorId,
        authorDisplayName,
        recipientUserIds,
        mentionedEveryone,
      });
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to dispatch lounge mention notifications for ${contextLabel}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private parseMentions(content: string): MentionParseResult {
    const tokens = new Set<string>();
    let mentionedEveryone = false;
    if (!content) return { mentionedEveryone, tokens };

    // Match mentions in free text while tolerating punctuation and unicode usernames.
    const regex = /(^|[^a-zA-Z0-9._-])@([^\s@]{1,120})/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      const token = String(match[2] || '')
        .trim()
        .replace(/[.,!?;:)\]}>"'`]+$/g, '');
      if (!token) continue;

      if (token.toLowerCase() === 'everyone') {
        mentionedEveryone = true;
        continue;
      }

      tokens.add(token.toLowerCase());
    }

    return { mentionedEveryone, tokens };
  }

  private normalizeTelegramUsername(value?: string | null): string | null {
    const normalized = (value || '').trim().replace(/^@+/, '');
    return normalized || null;
  }

  private async resolveApiKeyForUpload(authorId: string): Promise<string> {
    const personal = await this.usersService.resolveImgbbApiKeyForUser(authorId);
    if (personal.usePersonalApiKey) {
      if (!personal.personalApiKey) {
        throw new BadRequestException(
          'Personal image upload key is enabled, but no key is saved in your settings.',
        );
      }
      return personal.personalApiKey;
    }

    if (!this.globalImgbbApiKey) {
      throw new BadRequestException(
        'Image uploads are unavailable. Configure IMGBB_API_KEY or enable BYOK in settings.',
      );
    }
    return this.globalImgbbApiKey;
  }

  private async uploadImageToImgBb(
    imageDataUrl: string,
    imageName: string | undefined,
    apiKey: string,
  ): Promise<ImageUploadResult> {

    const parsedImage = this.parseImagePayload(imageDataUrl);
    const payload = new URLSearchParams();
    payload.append('image', parsedImage.base64Payload);
    const safeName = this.sanitizeImageName(imageName);
    if (safeName) {
      payload.append('name', safeName);
    }

    try {
      const response = await axios.post(
        `https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`,
        payload.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 12000,
        },
      );

      const body = response.data;
      const directUrl = this.normalizeImgBbDirectUrl(
        body?.data?.url || body?.data?.display_url || body?.data?.image?.url,
      );

      if (!directUrl) {
        throw new BadRequestException('Image upload succeeded but no valid direct image URL was returned.');
      }

      return { imageUrl: directUrl };
    } catch (error: unknown) {
      if (error instanceof BadRequestException) throw error;

      if (axios.isAxiosError(error)) {
        const detail = error.response?.data?.error?.message
          || error.response?.data?.error
          || error.message
          || 'Unknown upload error';
        throw new BadRequestException(`Image upload failed: ${detail}`);
      }

      throw new BadRequestException('Image upload failed. Please try again.');
    }
  }
}
