import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Classroom } from '../../classrooms/entities/classroom.entity';
import { Course } from '../../academics/entities/course.entity';
import { User } from '../../users/entities/user.entity';
import { QuizQuestion } from './quiz-question.entity';
import { QuizAttempt } from './quiz-attempt.entity';
import { QuizReport } from './quiz-report.entity';

@Entity('quizzes')
export class Quiz {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Classroom, (classroom) => classroom.quizzes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'classroomId' })
  classroom: Classroom;

  @Column()
  classroomId: string;

  @ManyToOne(() => Course, (course) => course.quizzes, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'courseId' })
  course: Course;

  @Column({ nullable: true })
  courseId: string | null;

  @Column()
  courseCode: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' }) // Students can create quizzes too!
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Column({ nullable: true })
  authorId: string;

  @Column()
  title: string;

  @Column({ type: 'int', default: 0 })
  timeLimitMinutes: number; // 0 means no limit

  @Column({ default: false })
  isAnonymous: boolean;

  @Column({ type: 'int', default: 2 })
  maxAttempts: number;

  @Column({ default: true })
  isPublished: boolean;

  @OneToMany(() => QuizQuestion, (question) => question.quiz, { cascade: true })
  questions: QuizQuestion[];

  @OneToMany(() => QuizAttempt, (attempt) => attempt.quiz)
  attempts: QuizAttempt[];

  @OneToMany(() => QuizReport, (report) => report.quiz)
  reports: QuizReport[];

  @CreateDateColumn()
  createdAt: Date;
}
