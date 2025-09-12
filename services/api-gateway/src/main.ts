import { NestFactory } from '@nestjs/core'
import { ValidationPipe, Logger } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { ConfigService } from '@nestjs/config'
import helmet from 'helmet'
import * as compression from 'compression'
import { AppModule } from './app.module'
import { RateLimitGuard } from './guards/rate-limit.guard'
import { SecurityMiddleware } from './middleware/security.middleware'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  })

  const configService = app.get(ConfigService)
  const port = configService.get('PORT', 4000)
  const logger = new Logger('Bootstrap')

  // Security middleware
  app.use(helmet())
  app.use(compression())
  app.use(new SecurityMiddleware().use)

  // Global pipes and guards
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    })
  )

  app.useGlobalGuards(new RateLimitGuard())

  // CORS configuration
  app.enableCors({
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://yourdomain.com', 'https://app.yourdomain.com']
      : ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  })

  // API Documentation
  const config = new DocumentBuilder()
    .setTitle('AI Trading Platform API')
    .setDescription('Advanced brokerage trading platform with AI capabilities')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Authentication')
    .addTag('Trading')
    .addTag('Portfolio')
    .addTag('AI Services')
    .addTag('Market Data')
    .build()

  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api/docs', app, document)

  await app.listen(port, '0.0.0.0')
  logger.log(`🚀 API Gateway running on port ${port}`)
  logger.log(`📚 API Documentation available at http://localhost:${port}/api/docs`)
}

bootstrap()