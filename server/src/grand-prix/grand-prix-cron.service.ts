import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { GrandPrixService } from './grand-prix.service';

@Injectable()
export class GrandPrixCronService implements OnModuleInit {
  private readonly logger = new Logger(GrandPrixCronService.name);

  constructor(private readonly grandPrixService: GrandPrixService) {}

  async onModuleInit() {
    this.logger.log('Demarrage du serveur - Synchronisation initiale des Grands Prix...');
    await this.sync('initiale');
  }

  @Cron('0 2 * * 0')
  async handleWeeklySync() {
    this.logger.log('Synchronisation hebdomadaire des Grands Prix (dimanche 02h00)...');
    await this.sync('hebdomadaire');
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
