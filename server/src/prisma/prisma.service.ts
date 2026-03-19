import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Connexion base de donnees etablie');
    } catch (error) {
      this.logger.error('Echec de la connexion base de donnees au demarrage', error);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
