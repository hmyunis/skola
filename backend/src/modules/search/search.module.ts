import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Assessment } from '../academics/entities/assessment.entity';
import { Course } from '../academics/entities/course.entity';
import { Quiz } from '../arena/entities/quiz.entity';
import { ClassroomMember } from '../classrooms/entities/classroom-member.entity';
import { ClassroomsModule } from '../classrooms/classrooms.module';
import { LoungePost } from '../lounge/entities/lounge-post.entity';
import { Resource } from '../resources/entities/resource.entity';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Course,
      Assessment,
      Resource,
      Quiz,
      LoungePost,
      ClassroomMember,
    ]),
    ClassroomsModule,
  ],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
