import { Module } from '@nestjs/common';
import { GrandPrixService } from './grand-prix.service';
import { GrandPrixController } from './grand-prix.controller';
import { GrandPrixCronService } from './grand-prix-cron.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [GrandPrixController],
  providers: [GrandPrixService, GrandPrixCronService, PrismaService],
})
export class GrandPrixModule {}
