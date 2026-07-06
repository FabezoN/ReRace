import { Controller, Post, Get, Body, Query, Headers, Req, BadRequestException, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBody, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Request } from 'express';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-checkout-session')
  @ApiOperation({ summary: 'Créer une session Stripe Checkout (redirection paiement)' })
  @ApiBody({ type: CreateCheckoutDto })
  @ApiResponse({ status: 201, description: 'Session créée (sessionId, url)' })
  @ApiResponse({ status: 400, description: 'Billet indisponible ou email invalide' })
  async createCheckoutSession(@Body() dto: CreateCheckoutDto) {
    return this.paymentsService.createCheckoutSession(dto.ticketId, dto.email);
  }

  @Post('webhook')
  @SkipThrottle()
  @ApiOperation({ summary: 'Webhook Stripe (événements checkout.session.completed)' })
  @ApiResponse({ status: 200, description: 'Événement traité' })
  @ApiResponse({ status: 400, description: 'Signature invalide ou raw body manquant' })
  async handleWebhook(
    @Req() req: RawBodyRequest,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!req.rawBody) {
      throw new BadRequestException('Raw body manquant');
    }
    return this.paymentsService.handleWebhook(req.rawBody, signature);
  }

  @Get('verify-session')
  @ApiOperation({ summary: 'Vérifier un paiement après retour Stripe' })
  @ApiQuery({ name: 'session_id', description: 'ID de session Stripe Checkout' })
  @ApiResponse({ status: 200, description: 'success + détails du billet si payé' })
  async verifySession(@Query('session_id') sessionId: string) {
    return this.paymentsService.verifySession(sessionId);
  }

  @Post('cancel')
  @ApiOperation({ summary: 'Annuler un achat en attente (remet le billet en vente)' })
  @ApiBody({ schema: { type: 'object', properties: { ticketId: { type: 'string', format: 'uuid' } }, required: ['ticketId'] } })
  @ApiResponse({ status: 200, description: 'Annulation enregistree' })
  async cancelPurchase(@Body('ticketId') ticketId: string) {
    return this.paymentsService.cancelPendingPurchase(ticketId);
  }

  @Post('validate/:transactionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'transactionId', description: 'UUID de la transaction' })
  @ApiOperation({ summary: 'Confirmer que le billet etait valide' })
  @ApiResponse({ status: 201, description: 'Billet valide' })
  @ApiResponse({ status: 400, description: 'Validation deja effectuee ou GP pas encore passe' })
  @ApiResponse({ status: 403, description: 'Non autorise' })
  async validateTicket(
    @Param('transactionId') transactionId: string,
    @Req() req: any,
  ) {
    return this.paymentsService.validateTicket(transactionId, req.user.id);
  }

  @Post('dispute/:transactionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'transactionId', description: 'UUID de la transaction' })
  @ApiOperation({ summary: 'Signaler un billet non valide (remboursement + signalement admin)' })
  @ApiResponse({ status: 201, description: 'Litige cree et remboursement initie' })
  @ApiResponse({ status: 400, description: 'Validation deja effectuee ou GP pas encore passe' })
  @ApiResponse({ status: 403, description: 'Non autorise' })
  async disputeTicket(
    @Param('transactionId') transactionId: string,
    @Req() req: any,
  ) {
    return this.paymentsService.disputeTicket(transactionId, req.user.id);
  }
}
