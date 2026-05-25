import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProgramsModule } from './modules/programs/programs.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { SubmissionsModule } from './modules/submissions/submissions.module';
import { AiAnalysisModule } from './modules/ai-analysis/ai-analysis.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { ReportsModule } from './modules/reports/reports.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { StorageModule } from './modules/storage/storage.module';
import { EmailModule } from './modules/email/email.module';
import { AuditModule } from './modules/audit/audit.module';

@Module({
  imports: [
    // Config global
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('RATE_LIMIT_TTL', 60),
          limit: config.get<number>('RATE_LIMIT_MAX', 100),
        },
      ],
    }),

    // BullMQ con Redis
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL', 'redis://localhost:6379');
        const parsed = new URL(redisUrl);
        // Extraer contraseña del URL (formato: redis://:password@host:port)
        const password = parsed.password || config.get<string>('REDIS_PASSWORD') || undefined;
        return {
        redis: {
          host: parsed.hostname || 'localhost',
          port: parseInt(parsed.port || '6379'),
          password: password || undefined,
        },
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        },
        };
      },
    }),

    // Scheduler
    ScheduleModule.forRoot(),

    // Módulos de la aplicación
    PrismaModule,
    AuthModule,
    UsersModule,
    ProgramsModule,
    TemplatesModule,
    SubmissionsModule,
    AiAnalysisModule,
    ReviewsModule,
    ReportsModule,
    DashboardModule,
    NotificationsModule,
    StorageModule,
    EmailModule,
    AuditModule,
  ],
})
export class AppModule {}
