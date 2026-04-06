import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Classroom } from '../../classrooms/entities/classroom.entity';
import { User } from '../../users/entities/user.entity';

export enum PriorityLevel {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent', // Urgent creates the persistent banner
}

export enum AnnouncementTargetAudience {
  ALL = 'all',
  STUDENTS = 'students',
  ADMINS = 'admins',
}

@Entity('announcements')
export class Announcement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Classroom, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'classroomId' })
  classroom: Classroom;

  @Column()
  classroomId: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'enum', enum: PriorityLevel, default: PriorityLevel.NORMAL })
  priority: PriorityLevel;

  @Column({
    type: 'enum',
    enum: AnnouncementTargetAudience,
    default: AnnouncementTargetAudience.ALL,
  })
  targetAudience: AnnouncementTargetAudience;

  @Column({ default: false })
  pinned: boolean;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Column({ nullable: true })
  authorId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
