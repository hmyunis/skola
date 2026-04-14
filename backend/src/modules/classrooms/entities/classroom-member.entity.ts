import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { Classroom } from './classroom.entity';
import {
  User,
  UserNotificationPreferences,
  UserRole,
} from '../../users/entities/user.entity';

export enum ClassroomMemberStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  BANNED = 'banned',
}

export interface ClassroomThemeSettings {
  colorMode?: 'light' | 'dark';
  fontFamily?: string;
  accentColor?: string;
}

@Entity('classroom_members')
@Unique(['classroom', 'user']) // A user can only join a specific classroom once
export class ClassroomMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Classroom, (classroom) => classroom.members, {
    onDelete: 'CASCADE',
  })
  classroom: Classroom;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.STUDENT })
  role: UserRole;

  @Column({
    type: 'enum',
    enum: ClassroomMemberStatus,
    default: ClassroomMemberStatus.ACTIVE,
  })
  status: ClassroomMemberStatus;

  @Column({ type: 'timestamp', nullable: true })
  suspendedUntil: Date | null;

  @Column({ type: 'simple-json', nullable: true })
  themeSettings: ClassroomThemeSettings | null;

  @Column({ type: 'simple-json', nullable: true })
  notificationPreferences: UserNotificationPreferences | null;

  @Column({ type: 'boolean', default: false })
  usePersonalImgBbApiKey: boolean;

  @Column({ type: 'text', nullable: true, select: false })
  imgbbApiKeyCiphertext: string | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  imgbbApiKeyHint: string | null;

  @Column({ type: 'boolean', default: false })
  usePersonalOpenAIApiKey: boolean;

  @Column({ type: 'text', nullable: true, select: false })
  openAIApiKeyCiphertext: string | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  openAIApiKeyHint: string | null;

  @CreateDateColumn()
  joinedAt: Date;
}
