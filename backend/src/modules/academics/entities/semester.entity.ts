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

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  @Column({ default: false })
  isActive: boolean; // Only ONE semester should be active per classroom

  @OneToMany(() => Course, (course) => course.semester)
  courses: Course[];
}
