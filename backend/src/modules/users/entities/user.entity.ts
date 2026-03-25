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

  @Column({ nullable: true })
  telegramUsername: string;

  @Column({ nullable: true })
  photoUrl: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.STUDENT })
  role: UserRole;

  // Academic Details
  @Column({ nullable: true })
  code: string; // Invite code used to join

  @Column({ type: 'int', default: 1 })
  year: number;

  @Column({ type: 'int', default: 1 })
  semester: number;

  @Column({ nullable: true })
  batch: string;

  // Social / Identity
  @Column({ nullable: true, unique: true })
  anonymousId: string; // e.g., "Anon#4A2B"

  // Status limits
  @Column({ default: false })
  isBanned: boolean;

  @Column({ type: 'timestamp', nullable: true })
  suspendedUntil: Date;

  @Column({ type: 'simple-json', nullable: true })
  themeSettings: {
    colorMode?: 'light' | 'dark';
    fontFamily?: string;
    accentColor?: string;
  };

  @Column({ type: 'simple-json', nullable: true })
  notificationPreferences: UserNotificationPreferences | null;

  @Column({ type: 'boolean', default: false })
  usePersonalImgBbApiKey: boolean;

  @Column({ type: 'text', nullable: true, select: false })
  imgbbApiKeyCiphertext: string | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  imgbbApiKeyHint: string | null;

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
