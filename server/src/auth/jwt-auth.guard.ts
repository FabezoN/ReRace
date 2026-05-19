import { Injectable, ExecutionContext, Logger, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ModuleRef } from '@nestjs/core';
import { JwtStrategy } from './jwt.strategy';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);
  private jwtStrategy: JwtStrategy;

  constructor(private moduleRef: ModuleRef) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      this.logger.warn(' Aucun header Authorization trouvé');
      throw new UnauthorizedException('Token manquant');
    }
    const token = authHeader.substring(7);
    
    try {
      if (!this.jwtStrategy) {
        this.jwtStrategy = this.moduleRef.get(JwtStrategy, { strict: false });
      }
      const user = await this.jwtStrategy.validateTokenDirectly(token);
      request.user = user;
      return true;
    } catch (error: any) {
      this.logger.error(` Erreur validation: ${error.message}`);
      throw new UnauthorizedException('Token invalide ou expiré');
    }
  }

  handleRequest(err: any, user: any, info: any) {
    if (err) {
      this.logger.error('Erreur JWT:', err.message);
      throw err;
    }
    if (!user) {
      this.logger.error('Utilisateur non trouvé. Info:', info?.message || info);
      throw new UnauthorizedException('Token invalide ou expiré');
    }
    this.logger.log(`Authentification JWT réussie pour: ${user.id}`);
    return user;
  }
}
