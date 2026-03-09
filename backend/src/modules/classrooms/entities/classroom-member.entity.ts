import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, Unique } from 'typeorm';
import { Classroom } from './classroom.entity';
import { User, UserRole } from '../../users/entities/user.entity';

@Entity('classroom_members')
@Unique(['classroom', 'user']) // A user can only join a specific classroom once
export class ClassroomMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Classroom, classroom => classroom.members, { onDelete: 'CASCADE' })
  classroom: Classroom;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.STUDENT })
  role: UserRole;

  @CreateDateColumn()
  joinedAt: Date;
}
