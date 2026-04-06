import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { Assessment } from './assessment.entity';
import { User } from '../../users/entities/user.entity';

export enum AssessmentConfidenceVote {
  CONFIDENT = 'confident',
  NEUTRAL = 'neutral',
  STRUGGLING = 'struggling',
}

@Entity('assessment_ratings')
@Unique(['assessmentId', 'userId'])
export class AssessmentRating {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Assessment, (assessment) => assessment.ratings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'assessmentId' })
  assessment: Assessment;

  @Column({ type: 'uuid' })
  assessmentId: string;

  @Column({ type: 'uuid' })
  classroomId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: AssessmentConfidenceVote })
  vote: AssessmentConfidenceVote;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
