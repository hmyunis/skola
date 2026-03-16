import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { ClassroomsModule } from './modules/classrooms/classrooms.module';
import { AcademicsModule } from './modules/academics/academics.module';
import { ResourcesModule } from './modules/resources/resources.module';
import { LoungeModule } from './modules/lounge/lounge.module';
import { ArenaModule } from './modules/arena/arena.module';
import { AdminModule } from './modules/admin/admin.module';
import { SearchModule } from './modules/search/search.module';

@Module({
  imports:[
    // 1. Global Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // 2. Database Connection (MySQL)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASS'),
        database: configService.get<string>('DB_NAME'),
        autoLoadEntities: true,
        // WARNING: Set synchronize to false in production on cPanel!
        // Use migrations instead. We'll leave it true for initial dev.
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
        timezone: 'Z', // Important for scheduling
      }),
    }),

    // 3. Rate Limiting (Security against DDoS/Brute force)
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>[
        {
          ttl: config.get<number>('THROTTLE_TTL', 60000), // Default 1 min
          limit: config.get<number>('THROTTLE_LIMIT', 100), // Default 100 req/min
        },
      ],
    }),

    // 4. Static File Serving (for uploaded resources)
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveRoot: '/public',
    }),

    UsersModule,
    AuthModule,
    ClassroomsModule,
    AcademicsModule,
    ResourcesModule,
    LoungeModule,
    ArenaModule,
    AdminModule,
    SearchModule,
  ],
  controllers: [AppController],
  providers:[
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard, // Apply rate limiting globally
    },
  ],
})
export class AppModule {}
