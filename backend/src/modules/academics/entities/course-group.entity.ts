import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CourseGroupFormation } from './course-group-formation.entity';
import { User } from '../../users/entities/user.entity';
import { CourseGroupMember } from './course-group-member.entity';

@Entity('course_groups')
export class CourseGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CourseGroupFormation, (formation) => formation.groups, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'formationId' })
  formation: CourseGroupFormation;

  @Column()
  formationId: string;

  @Column({ type: 'uuid' })
  classroomId: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy: User | null;

  @Column({ type: 'uuid', nullable: true })
  createdById: string | null;

  @OneToMany(() => CourseGroupMember, (member) => member.group)
  members: CourseGroupMember[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
