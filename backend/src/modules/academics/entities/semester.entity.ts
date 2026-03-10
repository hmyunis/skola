import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Classroom } from '../../classrooms/entities/classroom.entity';
import { Course } from './course.entity';

@Entity('semesters')
export class Semester {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Classroom, (classroom) => classroom.semesters, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'classroomId' })
  classroom: Classroom;

  @Column()
  classroomId: string; // Stored explicitly for easy querying

  @Column()
  name: string; // e.g., "Year 3 Sem 2"

  @Column({ type: 'int', default: 2026 })
  year: number;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  @Column({
    type: 'enum',
    enum: ['active', 'upcoming', 'archived'],
    default: 'upcoming',
  })
  status: 'active' | 'upcoming' | 'archived';

  @Column({ type: 'json', nullable: true })
  examPeriod: { start: string; end: string };

  @Column({ type: 'json', nullable: true })
  breaks: { name: string; start: string; end: string }[];

  @Column({ default: false })
  isActive: boolean; // Keep for convenience, though status='active' is redundant

  @OneToMany(() => Course, (course) => course.semester)
  courses: Course[];
}
