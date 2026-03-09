import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Quiz } from './quiz.entity';

@Entity('quiz_questions')
export class QuizQuestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Quiz, quiz => quiz.questions, { onDelete: 'CASCADE' })
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
}
