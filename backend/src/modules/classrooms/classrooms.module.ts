import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Classroom } from './entities/classroom.entity';
import { ClassroomMember } from './entities/classroom-member.entity';
import { ClassroomsService } from './classrooms.service';
import { ClassroomsController } from './classrooms.controller';
import { ClassroomRoleGuard } from '../../core/guards/classroom-role.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Classroom, ClassroomMember])],
  controllers: [ClassroomsController],
  providers: [ClassroomsService, ClassroomRoleGuard],
  exports: [ClassroomsService, ClassroomRoleGuard, TypeOrmModule],
})
export class ClassroomsModule {}
