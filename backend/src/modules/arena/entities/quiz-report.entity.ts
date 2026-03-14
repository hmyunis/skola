import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Quiz } from './quiz.entity';
import { User } from '../../users/entities/user.entity';

export enum QuizReportStatus {
  PENDING = 'pending',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

@Entity('quiz_reports')
export class QuizReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Quiz, (quiz) => quiz.reports, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'quizId' })
  quiz: Quiz;

  @Column({ nullable: true })
  quizId: string;

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

  @Column({ type: 'enum', enum: QuizReportStatus, default: QuizReportStatus.PENDING })
  status: QuizReportStatus;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
