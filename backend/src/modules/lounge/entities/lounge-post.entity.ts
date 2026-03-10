import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Classroom } from '../../classrooms/entities/classroom.entity';

@Entity('lounge_posts')
export class LoungePost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Classroom, (classroom) => classroom.loungePosts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'classroomId' })
  classroom: Classroom;

  @Column()
  classroomId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Column()
  authorId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ default: false })
  isAnonymous: boolean;

  @Column({ type: 'simple-array', nullable: true })
  tags: string[]; // e.g., "question", "rant", "meme"

  @Column({ nullable: true })
  course: string; // e.g., "CS301" — optional course reference

  // Self-referencing relationship for threaded replies
  @ManyToOne(() => LoungePost, post => post.replies, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'parentId' })
  parent: LoungePost;

  @Column({ nullable: true })
  parentId: string;

  @OneToMany(() => LoungePost, post => post.parent)
  replies: LoungePost[];

  // JSON column to store emoji reactions: {"💀": 5, "🤡": 2}
  // TypeORM supports simple-json for MySQL
  @Column({ type: 'simple-json', nullable: true })
  reactions: Record<string, number>;

  @CreateDateColumn()
  createdAt: Date;
}
