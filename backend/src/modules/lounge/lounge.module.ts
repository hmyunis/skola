import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoungePost } from './entities/lounge-post.entity';
import { LoungeReaction } from './entities/lounge-reaction.entity';
import { LoungeReport } from './entities/lounge-report.entity';
import { LoungeService } from './lounge.service';
import { LoungeController } from './lounge.controller';
import { ClassroomsModule } from '../classrooms/classrooms.module';
import { ClassroomMember } from '../classrooms/entities/classroom-member.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([LoungePost, LoungeReaction, LoungeReport, ClassroomMember]),
    ClassroomsModule,
  ],
  controllers: [LoungeController],
  providers: [LoungeService],
  exports: [LoungeService],
})
export class LoungeModule {}
