import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Resource } from './resource.entity';
import { User } from '../../users/entities/user.entity';

export enum ResourceReportStatus {
  PENDING = 'pending',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

@Entity('resource_reports')
export class ResourceReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Resource, (resource) => resource.reports, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'resourceId' })
  resource: Resource;

  @Column()
  resourceId: string;

  @Column()
  classroomId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporterId' })
  reporter: User;

  @Column()
  reporterId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reviewedById' })
  reviewedBy: User;

  @Column({ nullable: true })
  reviewedById: string;

  @Column()
  reason: string;

  @Column({ type: 'text', nullable: true })
  details: string;

  @Column({ type: 'enum', enum: ResourceReportStatus, default: ResourceReportStatus.PENDING })
  status: ResourceReportStatus;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
