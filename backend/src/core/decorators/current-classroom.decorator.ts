import { createParamDecorator, ExecutionContext, BadRequestException } from '@nestjs/common';

export const CurrentClassroom = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const classroomId = request.headers['x-classroom-id'];
    
    if (!classroomId) {
      throw new BadRequestException('X-Classroom-Id header is missing');
    }
    return classroomId;
  },
);
