import {
  createParamDecorator,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';

export const CurrentClassroom = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const rawClassroomId = request.headers?.['x-classroom-id'];
    const classroomId = Array.isArray(rawClassroomId)
      ? rawClassroomId.find((item) => typeof item === 'string' && item.trim())
      : rawClassroomId;

    if (
      !classroomId ||
      typeof classroomId !== 'string' ||
      !classroomId.trim()
    ) {
      throw new BadRequestException('X-Classroom-Id header is missing');
    }
    return classroomId.trim();
  },
);
