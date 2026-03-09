import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Quiz } from './entities/quiz.entity';
import { QuizAttempt } from './entities/quiz-attempt.entity';
import { QuizQuestion } from './entities/quiz-question.entity';

@Injectable()
export class ArenaService {
  constructor(
    @InjectRepository(Quiz) private quizRepo: Repository<Quiz>,
    @InjectRepository(QuizAttempt) private attemptRepo: Repository<QuizAttempt>,
    @InjectRepository(QuizQuestion) private questionRepo: Repository<QuizQuestion>,
  ) {}

  async getQuizzes(classroomId: string) {
    return this.quizRepo.find({
      where: { classroomId, isPublished: true },
      relations: ['questions'],
    });
  }

  async getQuiz(quizId: string) {
    return this.quizRepo.findOne({
      where: { id: quizId, isPublished: true },
      relations: ['questions'],
    });
  }

  async createQuiz(classroomId: string, authorId: string, data: any) {
    const quiz = this.quizRepo.create({
      classroomId,
      authorId,
      title: data.title,
      timeLimitMinutes: data.timeLimitMinutes || 0,
      isPublished: data.isPublished || false,
    });

    const savedQuiz = await this.quizRepo.save(quiz);

    // Create questions if provided
    if (data.questions && Array.isArray(data.questions)) {
      for (const questionData of data.questions) {
        const question = this.questionRepo.create({
          quizId: savedQuiz.id,
          questionText: questionData.questionText,
          options: questionData.options,
          correctOptionIndex: questionData.correctOptionIndex,
        });
        await this.questionRepo.save(question);
      }
    }

    return this.getQuiz(savedQuiz.id);
  }

  async updateQuiz(quizId: string, data: any) {
    await this.quizRepo.update(quizId, {
      title: data.title,
      timeLimitMinutes: data.timeLimitMinutes,
      isPublished: data.isPublished,
    });

    return this.getQuiz(quizId);
  }

  async submitAttempt(quizId: string, userId: string, answers: number[]) {
    const quiz = await this.quizRepo.findOne({
      where: { id: quizId },
      relations: ['questions'],
    });

    if (!quiz) throw new BadRequestException('Quiz not found');
    if (answers.length !== quiz.questions.length) {
      throw new BadRequestException('You must answer all questions');
    }

    let correctCount = 0;
    quiz.questions.forEach((q, index) => {
      if (answers[index] === q.correctOptionIndex) {
        correctCount++;
      }
    });

    // Gamification: 10 XP points per correct answer
    const score = correctCount * 10;

    const attempt = this.attemptRepo.create({
      quizId,
      userId,
      score,
      totalQuestions: quiz.questions.length,
    });

    return this.attemptRepo.save(attempt);
  }

  async getLeaderboard(classroomId: string) {
    // Sum all scores for each user in the classroom
    return this.attemptRepo.createQueryBuilder('attempt')
      .innerJoin('attempt.quiz', 'quiz')
      .innerJoinAndSelect('attempt.user', 'user')
      .where('quiz.classroomId = :classroomId', { classroomId })
      .select([
        'user.id as userId',
        'user.name as name',
        'user.photoUrl as photoUrl',
        'SUM(attempt.score) as totalXP'
      ])
      .groupBy('user.id')
      .orderBy('totalXP', 'DESC')
      .limit(10) // Top 10 Scholars
      .getRawMany();
  }
}
