import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
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

  async deleteAccount(id: string): Promise<void> {
    await this.usersRepository.delete(id);
  }
}
