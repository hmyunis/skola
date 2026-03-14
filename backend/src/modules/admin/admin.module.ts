import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { Announcement } from './entities/announcement.entity';
import { InviteCode } from './entities/invite-code.entity';
import { ClassroomsModule } from '../classrooms/classrooms.module';
import { ClassroomMember } from '../classrooms/entities/classroom-member.entity';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([Announcement, InviteCode, ClassroomMember]),
    ClassroomsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
