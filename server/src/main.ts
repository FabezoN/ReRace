import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  app.useGlobalPipes(new ValidationPipe({ 
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  }));

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  });

  const config = new DocumentBuilder()
    .setTitle('ReRace API')
    .setDescription(
      'API de gestion et revente de billets de F1. ' +
      '**Authentification** : Connexion/inscription via Supabase Auth (côté client). Les routes protégées exigent un Bearer JWT (access_token Supabase) dans l’en-tête Authorization. La synchro calendrier exige une clé API (x-api-key).',
    )
    .setVersion('1.0')
    .addTag('Auth', 'Authentification (Supabase JWT) – token requis pour les routes protégées')
    .addTag('Profile', 'Profil utilisateur et historique d’achats')
    .addTag('GrandPrix', 'Calendrier F1 et synchronisation')
    .addTag('Tickets', 'Création et liste des billets')
    .addTag('Payments', 'Paiements Stripe (checkout, webhook, vérification)')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token JWT Supabase (access_token après connexion)',
      },
      'JWT-auth',
    )
    .addApiKey(
      { type: 'apiKey', name: 'x-api-key', in: 'header', description: 'Clé API pour sync calendrier' },
      'api-key',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document); 

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();