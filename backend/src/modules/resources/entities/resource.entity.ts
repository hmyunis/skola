import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Classroom } from '../../classrooms/entities/classroom.entity';
import { Course } from '../../academics/entities/course.entity';
import { ResourceVote } from './resource-vote.entity';
import { ResourceReport } from './resource-report.entity';

export enum ResourceType {
  NOTE = 'note',
  SLIDE = 'slide',
  PAST_PAPER = 'past_paper',
  EBOOK = 'ebook',
  OTHER = 'other',
}

@Entity('resources')
export class Resource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Classroom, (classroom) => classroom.resources, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'classroomId' })
  classroom: Classroom;

  @Column()
  classroomId: string;

  @ManyToOne(() => Course, (course) => course.resources, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'courseId' })
  course: Course;

  @Column()
  courseId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'uploaderId' })
  uploader: User;

  @Column({ nullable: true })
  uploaderId: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: ResourceType, default: ResourceType.NOTE })
  type: ResourceType;

  // File Metadata
  @Column({ nullable: true })
  fileUrl: string; // e.g., "/public/uploads/resources/math_notes.pdf"

  @Column({ nullable: true })
  fileName: string;

  @Column({ type: 'int', nullable: true })
  fileSize: number; // in bytes

  @Column({ nullable: true })
  externalUrl: string; // For link-only resources

  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  // Statistics
  @Column({ type: 'int', default: 0 })
  upvotes: number;

  @Column({ type: 'int', default: 0 })
  downvotes: number;

  @OneToMany(() => ResourceVote, (vote) => vote.resource)
  votes: ResourceVote[];

  @OneToMany(() => ResourceReport, (report) => report.resource)
  reports: ResourceReport[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
