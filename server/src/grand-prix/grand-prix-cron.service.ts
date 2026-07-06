import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { GrandPrixService } from './grand-prix.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GrandPrixCronService implements OnModuleInit {
  private readonly logger = new Logger(GrandPrixCronService.name);

  constructor(
    private readonly grandPrixService: GrandPrixService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    this.logger.log('Demarrage du serveur - Synchronisation initiale des Grands Prix...');
    await this.sync('initiale');
  }

  @Cron('0 2 * * 0')
  async handleWeeklySync() {
    this.logger.log('Synchronisation hebdomadaire des Grands Prix (dimanche 02h00)...');
    await this.sync('hebdomadaire');
  }

  @Cron('0 3 * * *')
  async handleAutoValidation() {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const toValidate = await this.prisma.transaction.findMany({
      where: {
        status: 'COMPLETED',
        buyerValidation: 'PENDING',
        ticket: { grandPrix: { date: { lt: oneWeekAgo } } },
      },
      select: { id: true },
    });

    if (toValidate.length === 0) return;

    await this.prisma.transaction.updateMany({
      where: { id: { in: toValidate.map((t) => t.id) } },
      data: { buyerValidation: 'VALID', validatedAt: new Date() },
    });

    this.logger.log(`Auto-validation : ${toValidate.length} transaction(s) validee(s) automatiquement`);
  }

  private async sync(type: string) {
    try {
      const currentYear = new Date().getFullYear();
      const result = await this.grandPrixService.syncFromJolpica(currentYear);
      this.logger.log(`Synchronisation ${type} terminee : ${result.count} Grands Prix`);
    } catch (error) {
      this.logger.error(`Erreur lors de la synchronisation ${type}:`, error);
    }
  }
}
