import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Classroom } from '../../classrooms/entities/classroom.entity';
import { Semester } from './semester.entity';
import { User } from '../../users/entities/user.entity';
import { AssessmentRating } from './assessment-rating.entity';

export enum AssessmentType {
  EXAM = 'exam',
  QUIZ = 'quiz',
  ASSIGNMENT = 'assignment',
  PROJECT = 'project',
}

export enum AssessmentStatus {
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  GRADED = 'graded',
}

export enum AssessmentSource {
  CLASSROOM = 'classroom',
  DIRECT = 'direct',
  NOTICE = 'notice',
}

@Entity('assessments')
export class Assessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Classroom, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'classroomId' })
  classroom: Classroom;

  @Column({ type: 'uuid' })
  classroomId: string;

  @ManyToOne(() => Semester, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'semesterId' })
  semester: Semester;

  @Column({ type: 'uuid' })
  semesterId: string;

  @Column({ length: 180 })
  title: string;

  @Column({ type: 'enum', enum: AssessmentType })
  type: AssessmentType;

  @Column({ length: 32 })
  courseCode: string;

  @Column({ type: 'date' })
  dueDate: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'int', default: 100 })
  maxScore: number;

  @Column({ type: 'int', default: 10 })
  weight: number;

  @Column({ type: 'enum', enum: AssessmentStatus, default: AssessmentStatus.PENDING })
  status: AssessmentStatus;

  @Column({ type: 'enum', enum: AssessmentSource, default: AssessmentSource.CLASSROOM })
  source: AssessmentSource;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Column({ type: 'uuid', nullable: true })
  authorId: string | null;

  @OneToMany(() => AssessmentRating, (rating) => rating.assessment)
  ratings: AssessmentRating[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
