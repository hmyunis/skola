import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Quiz } from './quiz.entity';
import { User } from '../../users/entities/user.entity';

@Entity('quiz_attempts')
export class QuizAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Quiz, (quiz) => quiz.attempts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quizId' })
  quiz: Quiz;

  @Column()
  quizId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @Column({ type: 'int' })
  score: number; // e.g., Number of correct answers * 10

  @Column({ type: 'int' })
  totalQuestions: number;

  @Column({ type: 'int', default: 0 })
  correctAnswers: number;

  @Column({ default: false })
  won: boolean;

  @CreateDateColumn()
  completedAt: Date;
}
