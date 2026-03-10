import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { LoungePost } from './lounge-post.entity';

@Entity('lounge_reactions')
@Unique(['post', 'user']) // One reaction per user per post
export class LoungeReaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => LoungePost, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'postId' })
  post: LoungePost;

  @Column()
  postId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @Column()
  emoji: string;
}
