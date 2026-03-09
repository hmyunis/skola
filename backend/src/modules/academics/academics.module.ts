import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Semester } from './entities/semester.entity';
import { Course } from './entities/course.entity';
import { ScheduleItem } from './entities/schedule-item.entity';
import { AcademicsService } from './academics.service';
import { AcademicsController } from './academics.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Semester, Course, ScheduleItem])],
  controllers: [AcademicsController],
  providers: [AcademicsService],
  exports:[AcademicsService],
})
export class AcademicsModule {}
