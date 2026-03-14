import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';

interface JolpicaRace {
  season: string;
  round: string;
  url: string;
  raceName: string;
  Circuit: {
    circuitId: string;
    url: string;
    circuitName: string;
    Location: {
      lat: string;
      long: string;
      locality: string;
      country: string;
    };
  };
  date: string;
  time?: string;
}

interface JolpicaResponse {
  MRData: {
    RaceTable: {
      Races: JolpicaRace[];
    };
  };
}

@Injectable()
export class GrandPrixService {
  private readonly logger = new Logger(GrandPrixService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(season: number = 2026) {
    return this.prisma.grandPrix.findMany({
      where: { season },
      orderBy: { date: 'asc' },
      include: {
        tickets: {
          where: { status: 'ON_SALE' },
          select: { id: true, price: true },
        },
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.grandPrix.findUnique({
      where: { id },
      include: {
        tickets: {
          where: { status: 'ON_SALE' },
          include: { seller: { select: { firstName: true } } },
        },
      },
    });
  }

  async syncFromJolpica(season: number = 2026) {
    try {
      this.logger.log(`🔄 Synchronisation des Grands Prix de la saison ${season}...`);

      const response = await axios.get<JolpicaResponse>(
        `https://api.jolpi.ca/ergast/f1/${season}/races`,
        {
          timeout: 10000,
        },
      );

      const races = response.data.MRData.RaceTable.Races;
      this.logger.log(`📥 ${races.length} courses récupérées depuis l'API`);

      const results: any[] = [];

      for (const race of races) {
        let raceDate = new Date(race.date);
        if (race.time) {
          const [hours, minutes, seconds] = race.time.split(':');
          raceDate.setHours(
            parseInt(hours),
            parseInt(minutes),
            seconds ? parseInt(seconds) : 0,
          );
        }

        const grandPrix = await this.prisma.grandPrix.upsert({
          where: {
            externalId: `jolpica-${season}-${race.round}`,
          },
          update: {
            name: race.raceName,
            circuitName: race.Circuit.circuitName,
            country: race.Circuit.Location.country,
            date: raceDate,
            season: season,
          },
          create: {
            externalId: `jolpica-${season}-${race.round}`,
            name: race.raceName,
            circuitName: race.Circuit.circuitName,
            country: race.Circuit.Location.country,
            date: raceDate,
            season: season,
            imageUrl: null,
          },
        });

        results.push(grandPrix);
        this.logger.log(`✅ ${grandPrix.name} synchronisé`);
      }

      this.logger.log(`✨ Synchronisation terminée : ${results.length} Grands Prix`);
      return {
        success: true,
        count: results.length,
        grandPrix: results,
      };
    } catch (error) {
      this.logger.error(' Erreur lors de la synchronisation:', error);
      throw new Error(
        `Erreur lors de la synchronisation des Grands Prix: ${error.message}`,
      );
    }
  }
}