import './instrument';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  app.use(helmet());

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  }));

  const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
  app.enableCors({
    origin: allowedOrigin,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('ReRace API')
      .setDescription(
        'API de gestion et revente de billets de F1. ' +
        "**Authentification** : Connexion/inscription via Supabase Auth (cote client). " +
        "Les routes protegees exigent un Bearer JWT dans l'en-tete Authorization. " +
        'La synchro calendrier exige une cle API (x-api-key).',
      )
      .setVersion('1.0')
      .addTag('Auth', 'Authentification (Supabase JWT)')
      .addTag('Profile', 'Profil utilisateur et historique achats')
      .addTag('GrandPrix', 'Calendrier F1 et synchronisation')
      .addTag('Tickets', 'Creation et liste des billets')
      .addTag('Payments', 'Paiements Stripe (checkout, webhook, verification)')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token JWT Supabase (access_token apres connexion)',
        },
        'JWT-auth',
      )
      .addApiKey(
        { type: 'apiKey', name: 'x-api-key', in: 'header', description: 'Cle API pour sync calendrier' },
        'api-key',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
