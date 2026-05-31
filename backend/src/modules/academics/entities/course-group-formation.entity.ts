import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { Course } from './course.entity';
import { User } from '../../users/entities/user.entity';
import { CourseGroup } from './course-group.entity';

@Entity('course_group_formations')
@Unique(['courseId'])
export class CourseGroupFormation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Course, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'courseId' })
  course: Course;

  @Column()
  courseId: string;

  @Column({ type: 'uuid' })
  classroomId: string;

  @Column({ type: 'int', default: 4 })
  maxMembers: number;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy: User | null;

  @Column({ type: 'uuid', nullable: true })
  createdById: string | null;

  @OneToMany(() => CourseGroup, (group) => group.formation)
  groups: CourseGroup[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
