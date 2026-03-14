import { Controller, Post, Get, Body, Query, Headers, Req, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBody } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
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
  @ApiResponse({ status: 200, description: 'Annulation enregistrée' })
  async cancelPurchase(@Body('ticketId') ticketId: string) {
    return this.paymentsService.cancelPendingPurchase(ticketId);
  }
}
