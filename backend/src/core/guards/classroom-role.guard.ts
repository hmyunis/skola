import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../../modules/users/entities/user.entity';
import {
  ClassroomMember,
  ClassroomMemberStatus,
} from '../../modules/classrooms/entities/classroom-member.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class ClassroomRoleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(ClassroomMember)
    private memberRepo: Repository<ClassroomMember>,
  ) {}

  private normalizeClassroomId(value: unknown): string | null {
    if (Array.isArray(value)) {
      const first = value.find(
        (item) => typeof item === 'string' && item.trim(),
      );
      return typeof first === 'string' ? first.trim() : null;
    }
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    return null;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest();
    const user = request.user; // From JwtAuthGuard
    const classroomId = this.normalizeClassroomId(
      request.headers?.['x-classroom-id'],
    );

    if (!user || !classroomId) {
      throw new ForbiddenException('Classroom context is required.');
    }

    // Check the user's role specifically in THIS classroom
    const member = await this.memberRepo.findOne({
      where: { user: { id: user.id }, classroom: { id: classroomId } },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this classroom.');
    }

    if (member.status === ClassroomMemberStatus.BANNED) {
      throw new ForbiddenException('Your access to this classroom is banned.');
    }

    if (member.status === ClassroomMemberStatus.SUSPENDED) {
      const now = new Date();
      if (member.suspendedUntil && member.suspendedUntil <= now) {
        member.status = ClassroomMemberStatus.ACTIVE;
        member.suspendedUntil = null;
        await this.memberRepo.save(member);
      } else {
        throw new ForbiddenException(
          member.suspendedUntil
            ? `Your access to this classroom is suspended until ${member.suspendedUntil.toISOString()}.`
            : 'Your access to this classroom is suspended.',
        );
      }
    }

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Owner implicitly has all Admin rights
    if (
      member.role === UserRole.OWNER &&
      requiredRoles.includes(UserRole.ADMIN)
    ) {
      return true;
    }

    if (!requiredRoles.includes(member.role)) {
      throw new ForbiddenException(
        `Require one of these roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
