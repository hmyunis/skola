import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Course } from './course.entity';

export enum ScheduleType {
  LECTURE = 'lecture',
  LAB = 'lab',
  EXAM = 'exam',
  OTHER = 'other',
}

@Entity('schedule_items')
export class ScheduleItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Course, (course) => course.scheduleItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'courseId' })
  course: Course;

  @Column()
  courseId: string;

  @Column({ type: 'enum', enum: ScheduleType, default: ScheduleType.LECTURE })
  type: ScheduleType;

  @Column({ type: 'int' })
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  @Column({ type: 'time' })
  startTime: string; // "09:00:00"

  @Column({ type: 'time' })
  endTime: string; // "10:30:00"

  @Column({ nullable: true })
  location: string;

  @Column({ default: false })
  isOnline: boolean;

  @Column({ default: false })
  isDraft: boolean; // Feature: Admins can toggle Draft/Publish
}
