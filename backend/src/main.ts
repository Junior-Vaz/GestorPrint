import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import * as dotenv from 'dotenv';
import { LogsService } from './logs/logs.service';
import { LogsGateway } from './logs/logs.gateway';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Wire custom logger
  const logsService = app.get(LogsService);
  const logsGateway = app.get(LogsGateway);
  logsService.setGateway(logsGateway);
  app.useLogger(logsService);

  app.setGlobalPrefix('api');
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('GestorPrint API')
    .setDescription('The GestorPrint (Gráfica ERP) API for Managing Orders and Customers')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
