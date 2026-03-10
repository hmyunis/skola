import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoungePost } from './entities/lounge-post.entity';
import { LoungeReaction } from './entities/lounge-reaction.entity';
import { LoungeService } from './lounge.service';
import { LoungeController } from './lounge.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LoungePost, LoungeReaction])],
  controllers: [LoungeController],
  providers: [LoungeService],
  exports: [LoungeService],
})
export class LoungeModule {}
