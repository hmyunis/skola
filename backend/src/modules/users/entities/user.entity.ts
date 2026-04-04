import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum UserRole {
  STUDENT = 'student',
  ADMIN = 'admin',
  OWNER = 'owner',
}

export interface UserNotificationPreferences {
  inAppAnnouncements?: boolean;
  browserPushAnnouncements?: boolean;
  botDmAnnouncements?: boolean;
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'bigint', unique: true })
  telegramId: number;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  telegramUsername: string | null;

  @Column({ type: 'varchar', nullable: true })
  photoUrl: string | null;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.STUDENT })
  role: UserRole;

  // Academic Details
  @Column({ type: 'varchar', nullable: true })
  code: string | null; // Invite code used to join

  @Column({ type: 'int', default: 1 })
  year: number;

  @Column({ type: 'int', default: 1 })
  semester: number;

  @Column({ type: 'varchar', nullable: true })
  batch: string | null;

  // Social / Identity
  @Column({ type: 'varchar', nullable: true, unique: true })
  anonymousId: string | null; // e.g., "Anon#4A2B"

  // Status limits
  @Column({ default: false })
  isBanned: boolean;

  @Column({ type: 'timestamp', nullable: true })
  suspendedUntil: Date | null;

  @Column({ type: 'simple-json', nullable: true })
  themeSettings: {
    colorMode?: 'light' | 'dark';
    fontFamily?: string;
    accentColor?: string;
  } | null;

  @Column({ type: 'simple-json', nullable: true })
  notificationPreferences: UserNotificationPreferences | null;

  @Column({ type: 'boolean', default: false })
  usePersonalImgBbApiKey: boolean;

  @Column({ type: 'text', nullable: true, select: false })
  imgbbApiKeyCiphertext: string | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  imgbbApiKeyHint: string | null;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Virtual property to match frontend's 'initials'
  get initials(): string {
    return this.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }
}
