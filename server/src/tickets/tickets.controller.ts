import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Tickets')
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Créer un billet en vente (utilisateur connecté)' })
  @ApiBody({ type: CreateTicketDto })
  @ApiResponse({ status: 201, description: 'Billet créé' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  create(
    @Body() createTicketDto: CreateTicketDto,
    @Request() req,
  ) {
    return this.ticketsService.create(createTicketDto, req.user.id);
  }

  @Get('grand-prix/:id')
  @ApiOperation({ summary: 'Liste des billets d’un Grand Prix' })
  @ApiParam({ name: 'id', description: 'UUID du Grand Prix' })
  @ApiResponse({ status: 200, description: 'Liste des billets' })
  findByGrandPrix(@Param('id') id: string) {
    return this.ticketsService.findByGrandPrix(id);
  }
}
