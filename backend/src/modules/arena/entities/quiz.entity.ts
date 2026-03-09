import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Classroom } from '../../classrooms/entities/classroom.entity';
import { Course } from '../../academics/entities/course.entity';
import { User } from '../../users/entities/user.entity';
import { QuizQuestion } from './quiz-question.entity';

@Entity('quizzes')
export class Quiz {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Classroom, (classroom) => classroom.quizzes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'classroomId' })
  classroom: Classroom;

  @Column()
  classroomId: string;

  @ManyToOne(() => Course, (course) => course.quizzes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'courseId' })
  course: Course;

  @Column()
  courseId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' }) // Students can create quizzes too!
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Column({ nullable: true })
  authorId: string;

  @Column()
  title: string;

  @Column({ type: 'int', default: 0 })
  timeLimitMinutes: number; // 0 means no limit

  @Column({ default: true })
  isPublished: boolean;

  @OneToMany(() => QuizQuestion, (question) => question.quiz, { cascade: true })
  questions: QuizQuestion[];

  @CreateDateColumn()
  createdAt: Date;
}
