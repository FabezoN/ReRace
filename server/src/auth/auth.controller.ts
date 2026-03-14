import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  @Get()
  @ApiOperation({
    summary: 'Informations sur l’authentification',
    description:
      'Connexion et inscription sont gérées côté client via **Supabase Auth** (signInWithPassword, signUp). ' +
      'Après connexion, le client envoie le JWT (access_token) dans l’en-tête **Authorization: Bearer &lt;token&gt;** pour accéder aux routes protégées (profil, achats, création de billet). ' +
      'Ce endpoint ne requiert pas de token.',
  })
  @ApiResponse({ status: 200, description: 'Description du flux d’authentification' })
  getAuthInfo() {
    return {
      message: 'Authentification via Supabase',
      login: 'Côté client : supabase.auth.signInWithPassword({ email, password })',
      register: 'Côté client : supabase.auth.signUp({ email, password })',
      protectedRoutes: 'En-tête requis : Authorization: Bearer <access_token>',
      tokenSource: 'access_token renvoyé par Supabase après connexion',
    };
  }
}
