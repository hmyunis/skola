import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Classroom } from './entities/classroom.entity';
import { ClassroomMember } from './entities/classroom-member.entity';
import { User, UserRole } from '../users/entities/user.entity';

@Injectable()
export class ClassroomsService {
  constructor(
    @InjectRepository(Classroom)
    private classroomsRepository: Repository<Classroom>,
    @InjectRepository(ClassroomMember)
    private membersRepository: Repository<ClassroomMember>,
  ) {}

  async createClassroom(data: Partial<Classroom>): Promise<Classroom> {
    // Generate unique invite code
    const inviteCode = this.generateInviteCode();
    const classroom = this.classroomsRepository.create({ ...data, inviteCode });
    return this.classroomsRepository.save(classroom);
  }

  async getClassroomById(id: string): Promise<Classroom> {
    const classroom = await this.classroomsRepository.findOne({ 
      where: { id },
      relations: ['members', 'members.user']
    });
    if (!classroom) {
      throw new NotFoundException('Classroom not found');
    }
    return classroom;
  }

  async joinClassroom(inviteCode: string, user: User): Promise<ClassroomMember> {
    const classroom = await this.classroomsRepository.findOne({ 
      where: { inviteCode, isActive: true }
    });
    
    if (!classroom) {
      throw new BadRequestException('Invalid or inactive invite code');
    }

    // Check if user is already a member
    const existingMember = await this.membersRepository.findOne({
      where: { classroom: { id: classroom.id }, user: { id: user.id } }
    });

    if (existingMember) {
      throw new BadRequestException('Already a member of this classroom');
    }

    const member = this.membersRepository.create({
      classroom,
      user,
      role: UserRole.STUDENT
    });

    return this.membersRepository.save(member);
  }

  async getUserClassrooms(userId: string): Promise<Classroom[]> {
    const members = await this.membersRepository.find({
      where: { user: { id: userId } },
      relations: ['classroom']
    });
    return members.map(member => member.classroom);
  }

  async getClassroomMembers(classroomId: string): Promise<ClassroomMember[]> {
    return this.membersRepository.find({
      where: { classroom: { id: classroomId } },
      relations: ['user']
    });
  }

  private generateInviteCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}
