import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../modules/users/entities/user.entity';

export const ROLES_KEY = 'classroom_roles';
export const RequireClassroomRole = (...roles: UserRole[]) =>
  SetMetadata(ROLES_KEY, roles);
