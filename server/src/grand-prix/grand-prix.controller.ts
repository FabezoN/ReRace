import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiSecurity } from '@nestjs/swagger';
import { GrandPrixService } from './grand-prix.service';
import { ApiKeyGuard } from '../guards/api-key.guard';

@ApiTags('GrandPrix')
@Controller('grand-prix')
export class GrandPrixController {
  constructor(private readonly grandPrixService: GrandPrixService) {}

  @Get()
  @ApiOperation({ summary: 'Liste des Grands Prix (par défaut saison 2026)' })
  @ApiQuery({ name: 'season', required: false, example: '2026', description: 'Année de la saison' })
  @ApiResponse({ status: 200, description: 'Liste des Grands Prix avec billets en vente' })
  findAll(@Query('season') season?: string) {
    const seasonNumber = season ? parseInt(season, 10) : 2026;
    return this.grandPrixService.findAll(seasonNumber);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d’un Grand Prix par ID' })
  @ApiParam({ name: 'id', description: 'UUID du Grand Prix' })
  @ApiResponse({ status: 200, description: 'Grand Prix avec billets' })
  @ApiResponse({ status: 404, description: 'Grand Prix non trouvé' })
  findOne(@Param('id') id: string) {
    return this.grandPrixService.findOne(id);
  }

  @Post('sync')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Synchroniser le calendrier F1 depuis l’API Jolpica' })
  @ApiQuery({ name: 'season', required: false, example: '2026' })
  @ApiResponse({ status: 201, description: 'Sync réussie' })
  @ApiResponse({ status: 401, description: 'Clé API invalide ou manquante' })
  async syncFromJolpica(@Query('season') season?: string) {
    const seasonNumber = season ? parseInt(season, 10) : 2026;
    return this.grandPrixService.syncFromJolpica(seasonNumber);
  }
}