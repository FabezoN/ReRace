import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { TicketStatus, TransactionStatus } from '@prisma/client';
import Stripe from 'stripe';

@Injectable()
export class PaymentsService {
  private stripe: Stripe;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY non configurée');
    }
    this.stripe = new Stripe(stripeKey);
  }

  async createCheckoutSession(ticketId: string, buyerEmail: string) {
    if (!buyerEmail || !this.isValidEmail(buyerEmail)) {
      throw new BadRequestException('Email invalide');
    }

    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { grandPrix: true, seller: true },
    });

    if (!ticket) {
      throw new NotFoundException('Billet non trouvé');
    }

    if (ticket.status !== TicketStatus.ON_SALE) {
      throw new BadRequestException('Ce billet n\'est plus disponible');
    }

    if (ticket.seller.email.toLowerCase() === buyerEmail.toLowerCase()) {
      throw new BadRequestException('Vous ne pouvez pas acheter votre propre billet');
    }

    const price = Number(ticket.price);
    const fees = Math.round(price * 0.05 * 100) / 100;
    const total = price + fees;

    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.PENDING },
    });

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: buyerEmail,
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Billet ${ticket.grandPrix.name}`,
              description: `${ticket.section} - Rang ${ticket.row} - Place ${ticket.seat}`,
            },
            unit_amount: Math.round(price * 100),
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Frais de service ReRace',
              description: 'Commission plateforme (5%)',
            },
            unit_amount: Math.round(fees * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${frontendUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/payment/cancel?ticket_id=${ticketId}`,
      metadata: {
        ticketId: ticket.id,
        buyerEmail,
        amount: price.toString(),
        fees: fees.toString(),
        total: total.toString(),
      },
    });

    return { sessionId: session.id, url: session.url };
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async handleWebhook(payload: Buffer, signature: string) {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    
    if (!webhookSecret) {
      throw new BadRequestException('Webhook secret non configuré');
    }

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err: any) {
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      await this.completeTransaction(session);
    }

    return { received: true };
  }

  private async completeTransaction(session: Stripe.Checkout.Session) {
    const metadata = session.metadata;
    if (!metadata?.ticketId || !metadata?.buyerEmail) return;

    const { ticketId, buyerEmail, amount, fees, total } = metadata;

    const existingUser = await this.prisma.user.findUnique({
      where: { email: buyerEmail },
    });

    await this.prisma.transaction.create({
      data: {
        ticketId,
        buyerEmail,
        buyerId: existingUser?.id || null,
        amount: parseFloat(amount || '0'),
        fees: parseFloat(fees || '0'),
        total: parseFloat(total || '0'),
        status: TransactionStatus.COMPLETED,
        stripePaymentId: session.payment_intent as string,
      },
    });

    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.SOLD },
    });
  }

  async verifySession(sessionId: string) {
    const session = await this.stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return { success: false };
    }

    const ticketId = session.metadata?.ticketId;
    if (!ticketId) {
      return { success: false };
    }

    let ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { grandPrix: true, transaction: true },
    });

    if (!ticket) {
      return { success: false };
    }

    if (!ticket.transaction && session.metadata?.buyerEmail) {
      await this.completeTransaction(session);
      ticket = await this.prisma.ticket.findUnique({
        where: { id: ticketId },
        include: { grandPrix: true, transaction: true },
      });
    }

    if (!ticket) {
      return { success: false };
    }

    return {
      success: true,
      ticket: {
        id: ticket.id,
        grandPrixName: ticket.grandPrix.name,
        section: ticket.section,
        row: ticket.row,
        seat: ticket.seat,
        imageUrl: ticket.imageUrl,
      },
    };
  }

  async validateTicket(transactionId: string, userId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { ticket: { include: { grandPrix: true } } },
    });

    if (!transaction) throw new NotFoundException('Transaction non trouvee');
    if (transaction.buyerId !== userId) throw new ForbiddenException('Non autorise');
    if (transaction.buyerValidation !== 'PENDING') {
      throw new BadRequestException('Validation deja effectuee');
    }
    if (new Date(transaction.ticket.grandPrix.date) > new Date()) {
      throw new BadRequestException('Le Grand Prix n\'a pas encore eu lieu');
    }

    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: { buyerValidation: 'VALID', validatedAt: new Date() },
    });

    return { success: true, status: 'VALID' };
  }

  async disputeTicket(transactionId: string, userId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { ticket: { include: { grandPrix: true } } },
    });

    if (!transaction) throw new NotFoundException('Transaction non trouvee');
    if (transaction.buyerId !== userId) throw new ForbiddenException('Non autorise');
    if (transaction.buyerValidation !== 'PENDING') {
      throw new BadRequestException('Validation deja effectuee');
    }
    if (new Date(transaction.ticket.grandPrix.date) > new Date()) {
      throw new BadRequestException('Le Grand Prix n\'a pas encore eu lieu');
    }

    let stripeRefundId: string | null = null;
    if (transaction.stripePaymentId) {
      const refund = await this.stripe.refunds.create({
        payment_intent: transaction.stripePaymentId,
      });
      stripeRefundId = refund.id;
    }

    await this.prisma.$transaction([
      this.prisma.transaction.update({
        where: { id: transactionId },
        data: {
          buyerValidation: 'DISPUTED',
          validatedAt: new Date(),
          status: 'REFUNDED',
        },
      }),
      this.prisma.dispute.create({
        data: { transactionId, stripeRefundId },
      }),
    ]);

    return { success: true, status: 'DISPUTED' };
  }

  async cancelPendingPurchase(ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (ticket?.status === TicketStatus.PENDING) {
      await this.prisma.ticket.update({
        where: { id: ticketId },
        data: { status: TicketStatus.ON_SALE },
      });
    }

    return { cancelled: true };
  }
}
