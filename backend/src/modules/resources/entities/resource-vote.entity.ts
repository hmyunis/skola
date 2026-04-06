import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Resource } from './resource.entity';
import { User } from '../../users/entities/user.entity';

export enum VoteType {
  UP = 'up',
  DOWN = 'down',
}

@Entity('resource_votes')
@Unique(['resource', 'user']) // One vote per user per resource
export class ResourceVote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Resource, (resource) => resource.votes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'resourceId' })
  resource: Resource;

  @Column()
  resourceId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @Column({ type: 'enum', enum: VoteType })
  vote: VoteType;
}
