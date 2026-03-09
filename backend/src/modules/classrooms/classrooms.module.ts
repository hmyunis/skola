import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { Classroom } from './entities/classroom.entity';
import { ClassroomMember } from './entities/classroom-member.entity';
import { User } from '../users/entities/user.entity';
import { InviteCode } from '../admin/entities/invite-code.entity';
import { ClassroomsService } from './classrooms.service';
import { ClassroomsController } from './classrooms.controller';
import { ClassroomRoleGuard } from '../../core/guards/classroom-role.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Classroom, ClassroomMember, User, InviteCode]),
    HttpModule,
    ConfigModule,
    AuthModule,
  ],
  controllers: [ClassroomsController],
  providers: [ClassroomsService, ClassroomRoleGuard],
  exports: [ClassroomsService, ClassroomRoleGuard, TypeOrmModule],
})
export class ClassroomsModule {}
