import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';
import { Semester } from './semester.entity';
import { ScheduleItem } from './schedule-item.entity';
import { Resource } from '../../resources/entities/resource.entity';
import { Quiz } from '../../arena/entities/quiz.entity';

@Entity('courses')
export class Course {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Semester, (semester) => semester.courses, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'semesterId' })
  semester: Semester;

  @Column()
  semesterId: string;

  @Column()
  name: string; // e.g., "Thermodynamics"

  @Column({ nullable: true })
  code: string; // e.g., "MECH301"

  @Column({ type: 'int', nullable: true })
  credits: number;

  @Column({ nullable: true })
  instructor: string;

  @Column({ nullable: true, type: 'uuid' })
  classroomId: string;

  @OneToMany(() => ScheduleItem, (scheduleItem) => scheduleItem.course)
  scheduleItems: ScheduleItem[];

  @OneToMany(() => Resource, (resource) => resource.course)
  resources: Resource[];

  @OneToMany(() => Quiz, (quiz) => quiz.course)
  quizzes: Quiz[];

  @CreateDateColumn()
  createdAt: Date;
}
