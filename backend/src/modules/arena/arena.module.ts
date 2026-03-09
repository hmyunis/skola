import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArenaController } from './arena.controller';
import { ArenaService } from './arena.service';
import { Quiz } from './entities/quiz.entity';
import { QuizQuestion } from './entities/quiz-question.entity';
import { QuizAttempt } from './entities/quiz-attempt.entity';
import { ClassroomsModule } from '../classrooms/classrooms.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quiz, QuizQuestion, QuizAttempt]),
    ClassroomsModule,
  ],
  controllers: [ArenaController],
  providers: [ArenaService],
  exports: [ArenaService],
})
export class ArenaModule {}
