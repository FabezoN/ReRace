import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);
  private readonly supabase: SupabaseClient;

  constructor(
    configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const rawUrl = configService.get<string>('SUPABASE_URL');
    const supabaseAnonKey = configService.get<string>('SUPABASE_ANON_KEY');

    if (!rawUrl || !supabaseAnonKey) {
      throw new Error('Config Supabase manquante (.env)');
    }

    const cleanedUrl = rawUrl.replace(/\/$/, '');
    const supabaseClient = createClient(cleanedUrl, supabaseAnonKey);

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: true,
      secretOrKeyProvider: async (request, rawJwtToken, done) => {
        try {
          const { data: { user }, error } = await supabaseClient.auth.getUser(rawJwtToken);
          
          if (error || !user) {
            this.logger.error(`Token invalide: ${error?.message || 'Utilisateur non trouvé'}`);
            return done(new UnauthorizedException('Token invalide ou expiré'), undefined);
          }

          const decoded = jwt.decode(rawJwtToken, { json: true });
          if (!decoded || typeof decoded !== 'object') {
            return done(new UnauthorizedException('Impossible de décoder le token'), undefined);
          }

          request._supabasePayload = decoded;
          
          this.logger.log(` Token validé par Supabase pour: ${user.email}`);
          
          done(null, 'skip-signature-verification');
        } catch (err: any) {
          this.logger.error(`Erreur validation: ${err.message}`);
          done(err, undefined);
        }
      },
      algorithms: ['RS256'],
    });

    this.supabase = supabaseClient;

    this.logger.log(`Stratégie JWT (Supabase validation) initialisée.`);
  }

  async validateTokenDirectly(token: string) {
    const { data: { user }, error } = await this.supabase.auth.getUser(token);
    
    if (error || !user) {
      throw new UnauthorizedException(`Token invalide: ${error?.message || 'Utilisateur non trouvé'}`);
    }

    const decoded = jwt.decode(token, { json: true });
    if (!decoded || typeof decoded !== 'object') {
      throw new UnauthorizedException('Impossible de décoder le token');
    }

    return this.validate(decoded);
  }

  async validate(payload: any) {
    const actualPayload = payload;
    
    if (!actualPayload.sub || !actualPayload.email) {
      throw new UnauthorizedException('Token invalide: champs manquants');
    }

    let user = await this.prisma.user.findUnique({
      where: { email: actualPayload.email },
    });

    if (!user) {
      this.logger.log(`📝 Création de l'utilisateur dans Prisma: ${actualPayload.email}`);
      user = await this.prisma.user.create({
        data: {
          id: actualPayload.sub,
          email: actualPayload.email,
          firstName: actualPayload.user_metadata?.first_name || actualPayload.email.split('@')[0],
          lastName: actualPayload.user_metadata?.last_name || '',
          role: actualPayload.app_metadata?.role === 'ADMIN' ? 'ADMIN' : 'USER',
        },
      });
    }

    this.logger.log(`Utilisateur trouvé/créé dans Prisma: ${user.email} (ID: ${user.id})`);
    
    return { 
      id: user.id,
      email: user.email, 
      role: user.role,
      supabaseId: actualPayload.sub,
    };
  }
}
