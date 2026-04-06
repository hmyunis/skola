import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Quiz } from './quiz.entity';

export type QuizDifficulty = 'easy' | 'medium' | 'hard';

@Entity('quiz_questions')
export class QuizQuestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Quiz, (quiz) => quiz.questions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quizId' })
  quiz: Quiz;

  @Column()
  quizId: string;

  @Column({ type: 'text' })
  questionText: string;

  @Column({ type: 'simple-json' })
  options: string[]; // e.g.,["Option A", "Option B", "Option C"]

  @Column({ type: 'int' })
  correctOptionIndex: number; // Index of the correct option in the array (0, 1, 2...)

  @Column({ type: 'enum', enum: ['easy', 'medium', 'hard'], default: 'medium' })
  difficulty: QuizDifficulty;

  @Column({ type: 'int', default: 15 })
  durationSeconds: number;

  @Column({ type: 'int', default: 0 })
  orderIndex: number;
}
