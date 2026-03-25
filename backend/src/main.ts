import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { GlobalExceptionFilter } from './core/filters/global-exception.filter';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // 1. Security Headers
  app.use(helmet());

  // 2. CORS (Allow Frontend)
  const frontendUrl = configService.get<string>('FRONTEND_URL');

  // Allow base64 image payloads for lounge image attachments.
  app.use(json({ limit: '12mb' }));
  app.use(urlencoded({ limit: '12mb', extended: true }));

  app.enableCors({
    origin: frontendUrl || '*', // Restrict this in production!
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // 3. Global Prefix (e.g., /api/...)
  app.setGlobalPrefix('api');

  // 4. Global Validation Pipe (Auto-strip unused fields, auto-transform types)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip out properties not defined in DTO
      forbidNonWhitelisted: true, // throw error if extra properties are sent
      transform: true, // auto-transform payloads to DTO instances
    }),
  );

  // 5. Global Error Handling
  app.useGlobalFilters(new GlobalExceptionFilter());

  // 6. Start the server
  // cPanel sets process.env.PORT automatically for Node apps
  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);
  
  logger.log(`🚀 SKOLA Backend is running on: http://localhost:${port}/api`);
}
bootstrap();
