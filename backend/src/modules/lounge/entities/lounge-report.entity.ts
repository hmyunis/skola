import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LoungePost } from './lounge-post.entity';
import { User } from '../../users/entities/user.entity';

export enum LoungeReportContentType {
  POST = 'post',
  REPLY = 'reply',
}

export enum LoungeReportStatus {
  PENDING = 'pending',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

@Entity('lounge_reports')
export class LoungeReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: LoungeReportContentType })
  contentType: LoungeReportContentType;

  @ManyToOne(() => LoungePost, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'postId' })
  post: LoungePost;

  @Column({ nullable: true })
  postId: string;

  @Column()
  classroomId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporterId' })
  reporter: User;

  @Column()
  reporterId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reviewedById' })
  reviewedBy: User;

  @Column({ nullable: true })
  reviewedById: string;

  @Column()
  reason: string;

  @Column({ type: 'text', nullable: true })
  details: string;

  @Column({
    type: 'enum',
    enum: LoungeReportStatus,
    default: LoungeReportStatus.PENDING,
  })
  status: LoungeReportStatus;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
