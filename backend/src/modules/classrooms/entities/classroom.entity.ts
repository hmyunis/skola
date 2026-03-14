import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { ClassroomMember } from './classroom-member.entity';
import { Semester } from '../../academics/entities/semester.entity';
import { Resource } from '../../resources/entities/resource.entity';
import { LoungePost } from '../../lounge/entities/lounge-post.entity';
import { Quiz } from '../../arena/entities/quiz.entity';

@Entity('classrooms')
export class Classroom {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string; // e.g., "Computer Science - Class of 2026"

  @Column({ type: 'simple-json', nullable: true })
  theme: any; // Store the whole theme object

  @Column({ unique: true })
  telegramGroupId: string;

  @Column({ unique: true })
  inviteCode: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'simple-json', nullable: true })
  featureToggles: any; // Store the array of FeatureToggle objects

  @OneToMany(() => ClassroomMember, (member) => member.classroom)
  members: ClassroomMember[];

  @OneToMany(() => Semester, (semester) => semester.classroom)
  semesters: Semester[];

  @OneToMany(() => Resource, (resource) => resource.classroom)
  resources: Resource[];

  @OneToMany(() => LoungePost, (post) => post.classroom)
  loungePosts: LoungePost[];

  @OneToMany(() => Quiz, (quiz) => quiz.classroom)
  quizzes: Quiz[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
