import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../../modules/users/entities/user.entity';
import { ClassroomMember } from '../../modules/classrooms/entities/classroom-member.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class ClassroomRoleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(ClassroomMember)
    private memberRepo: Repository<ClassroomMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true; // No specific role required, pass
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user; // From JwtAuthGuard
    const classroomId = request.headers['x-classroom-id'];

    if (!user || !classroomId) return false;

    // Check the user's role specifically in THIS classroom
    const member = await this.memberRepo.findOne({
      where: { user: { id: user.id }, classroom: { id: classroomId } },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this classroom.');
    }

    // Owner implicitly has all Admin rights
    if (member.role === UserRole.OWNER && requiredRoles.includes(UserRole.ADMIN)) {
      return true;
    }

    if (!requiredRoles.includes(member.role)) {
      throw new ForbiddenException(`Require one of these roles: ${requiredRoles.join(', ')}`);
    }

    return true;
  }
}
