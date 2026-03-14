import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GrandPrixService } from './grand-prix.service';

@Injectable()
export class GrandPrixCronService implements OnModuleInit {
  private readonly logger = new Logger(GrandPrixCronService.name);

  constructor(private readonly grandPrixService: GrandPrixService) {}


  async onModuleInit() {
    this.logger.log('🚀 Démarrage du serveur - Synchronisation initiale des Grands Prix...');
    try {
      const currentYear = new Date().getFullYear();
      await this.grandPrixService.syncFromJolpica(currentYear);
      this.logger.log('Synchronisation initiale terminée avec succès');
    } catch (error) {
      this.logger.error('Erreur lors de la synchronisation initiale:', error);
    }
  }

  @Cron('0 2 * * 0')
  async handleWeeklySync() {
  this.logger.log(' Démarrage de la synchronisation hebdomadaire des Grands Prix...');
    try {
       const currentYear = new Date().getFullYear();
       await this.grandPrixService.syncFromJolpica(currentYear);
       this.logger.log('Synchronisation hebdomadaire terminée avec succès');
     } catch (error) {
       this.logger.error(' Erreur lors de la synchronisation hebdomadaire:', error);
     }
   }
}
