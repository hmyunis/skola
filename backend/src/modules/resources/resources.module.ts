import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Resource } from './entities/resource.entity';
import { ResourceVote } from './entities/resource-vote.entity';
import { ResourceReport } from './entities/resource-report.entity';
import { ResourcesService } from './resources.service';
import { ResourcesController } from './resources.controller';
import { ClassroomMember } from '../classrooms/entities/classroom-member.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Resource,
      ResourceVote,
      ResourceReport,
      ClassroomMember,
    ]),
  ],
  controllers: [ResourcesController],
  providers: [ResourcesService],
  exports: [ResourcesService],
})
export class ResourcesModule {}
