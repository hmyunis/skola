import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoungePost } from './entities/lounge-post.entity';
import { LoungeService } from './lounge.service';
import { LoungeController } from './lounge.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LoungePost])],
  controllers: [LoungeController],
  providers: [LoungeService],
  exports: [LoungeService],
})
export class LoungeModule {}
