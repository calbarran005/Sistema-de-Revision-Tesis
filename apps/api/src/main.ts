import * as dotenv from 'dotenv';
import * as path from 'path';
// Cargar .env con override:true para que siempre prevalezca sobre variables del sistema
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const configService = app.get(ConfigService);
  const port = parseInt(process.env.PORT || '') || configService.get<number>('API_PORT', 3001);
  const appUrl = configService.get<string>('APP_URL', 'http://localhost:3000');

  // Seguridad
  app.use(helmet({ crossOriginEmbedderPolicy: false }));
  app.use(compression());
  app.use(cookieParser());

  // CORS
  app.enableCors({
    origin: [appUrl, 'http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
  });

  // Prefijo global
  app.setGlobalPrefix('api/v1');

  // Validación global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Filtros e interceptores globales
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Santos Sistema S6 - API')
    .setDescription('Sistema de Gestión y Evaluación Inteligente de Avances de Tesis Universitarias')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT')
    .addTag('Auth', 'Autenticación y autorización')
    .addTag('Users', 'Gestión de usuarios')
    .addTag('Programs', 'Programas académicos')
    .addTag('Templates', 'Documentos patrón institucionales')
    .addTag('Submissions', 'Avances de tesis')
    .addTag('AI Analysis', 'Análisis inteligente de documentos')
    .addTag('Reviews', 'Revisión humana')
    .addTag('Reports', 'Generación de reportes')
    .addTag('Dashboard', 'Estadísticas y KPIs')
    .addTag('Notifications', 'Notificaciones')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(port);
  logger.log(`🚀 API corriendo en: http://localhost:${port}/api/v1`);
  logger.log(`📚 Swagger docs en: http://localhost:${port}/api/docs`);
}

bootstrap();
