import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { ClassroomMember } from '../classrooms/entities/classroom-member.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(ClassroomMember)
    private classroomMembersRepository: Repository<ClassroomMember>,
  ) {}

  async findByTelegramId(telegramId: number): Promise<User | null> {
    return this.usersRepository.findOne({ where: { telegramId } });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async create(userData: Partial<User>): Promise<User> {
    // Generate a unique anonymous ID
    const randomHex = Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, '0');
    userData.anonymousId = `Anon#${randomHex}`;
    
    // First user defaults to OWNER
    const count = await this.usersRepository.count();
    if (count === 0) {
      userData.role = UserRole.OWNER;
    }

    const newUser = this.usersRepository.create(userData);
    return this.usersRepository.save(newUser);
  }

  async update(id: string, data: Partial<User>): Promise<void> {
    await this.usersRepository.update(id, data);
  }

  async updateThemeSettings(userId: string, themeSettings: any): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }
    user.themeSettings = { ...user.themeSettings, ...themeSettings };
    return this.usersRepository.save(user);
  }

  async deleteAccount(id: string): Promise<void> {
    await this.usersRepository.delete(id);
  }

  async deleteOwnerAccountWithSuccessor(
    ownerUserId: string,
    classroomId: string,
    successorMemberId: string,
  ): Promise<void> {
    const trimmedSuccessorMemberId = (successorMemberId || '').trim();
    if (!trimmedSuccessorMemberId) {
      throw new BadRequestException('Please choose an admin successor before deleting your account.');
    }

    await this.classroomMembersRepository.manager.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const memberRepo = manager.getRepository(ClassroomMember);

      const ownerMembership = await memberRepo.findOne({
        where: { classroom: { id: classroomId }, user: { id: ownerUserId } },
        relations: ['user'],
      });
      if (!ownerMembership) {
        throw new NotFoundException('Owner membership not found for this classroom.');
      }
      if (ownerMembership.role !== UserRole.OWNER) {
        throw new ForbiddenException('Only the current owner can transfer ownership and delete this account.');
      }

      const successorMembership = await memberRepo.findOne({
        where: { id: trimmedSuccessorMemberId, classroom: { id: classroomId } },
        relations: ['user'],
      });
      if (!successorMembership) {
        throw new NotFoundException('Selected successor was not found in this classroom.');
      }
      if (successorMembership.user.id === ownerUserId) {
        throw new BadRequestException('Please choose a different admin as successor.');
      }
      if (successorMembership.role !== UserRole.ADMIN) {
        throw new BadRequestException('Selected successor must currently be an admin.');
      }

      successorMembership.role = UserRole.OWNER;
      await memberRepo.save(successorMembership);

      if (successorMembership.user.role !== UserRole.OWNER) {
        successorMembership.user.role = UserRole.OWNER;
        await userRepo.save(successorMembership.user);
      }

      await userRepo.delete(ownerUserId);
    });
  }
}
