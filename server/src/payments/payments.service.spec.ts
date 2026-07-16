
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { TicketStatus } from '@prisma/client';
import Stripe from 'stripe';

//
// jest.mock est hissé (hoisted) avant les imports.
// On déclare les fonctions mock dans ce bloc pour qu'elles soient accessibles
// dans les tests via la référence à l'instance.

jest.mock('stripe', () => jest.fn());

const SELLER_ID    = 'a1b2c3d4-0000-4000-8000-111111111111';
const BUYER_ID     = 'd4e5f6a7-0003-4003-8003-444444444444';
const GP_ID        = 'b566a345-0001-4001-8001-222222222222';
const TICKET_ID    = 'c7d8e9f0-0002-4002-8002-333333333333';
const SELLER_EMAIL = 'charles.leclerc@rerace.io';
const BUYER_EMAIL  = 'max.verstappen@rerace.io';

const MOCK_GRAND_PRIX = {
  id:          GP_ID,
  name:        'Monaco Grand Prix',
  circuitName: 'Circuit de Monaco',
  country:     'Monaco',
  date:        new Date('2026-05-24'),
  season:      2026,
  externalId:  'monaco-2026',
  imageUrl:    null,
};

const MOCK_TICKET_ON_SALE = {
  id:          TICKET_ID,
  grandPrixId: GP_ID,
  sellerId:    SELLER_ID,
  section:     'Tribune K',
  row:         '4',
  seat:        '12',
  price:       200.00, // Prix rond pour simplifier le calcul des frais
  currency:    'EUR',
  status:      TicketStatus.ON_SALE,
  imageUrl:    null,
  qrCodeUrl:   null,
  originalPrice: null,
  createdAt:   new Date(),
  updatedAt:   new Date(),
  grandPrix:   MOCK_GRAND_PRIX,
  seller:      { id: SELLER_ID, email: SELLER_EMAIL, firstName: 'Charles', lastName: 'Leclerc' },
};

const MOCK_TICKET_SOLD = { ...MOCK_TICKET_ON_SALE, status: TicketStatus.SOLD };

const MOCK_TICKET_PENDING = { ...MOCK_TICKET_ON_SALE, status: TicketStatus.PENDING };

const TRANSACTION_ID = 'e1f2a3b4-0004-4004-8004-555555555555';

const MOCK_TRANSACTION_PENDING = {
  id:              TRANSACTION_ID,
  ticketId:        TICKET_ID,
  buyerId:         BUYER_ID,
  buyerEmail:      BUYER_EMAIL,
  amount:          200,
  fees:            10,
  total:           210,
  status:          'COMPLETED',
  stripePaymentId: 'pi_test_monaco_2026',
  buyerValidation: 'PENDING',
  validatedAt:     null,
  createdAt:       new Date(),
  ticket: {
    ...MOCK_TICKET_ON_SALE,
    grandPrix: { ...MOCK_GRAND_PRIX, date: new Date('2025-05-24') }, // GP déjà passé
  },
};

const mockPrisma = {
  ticket: {
    findUnique: jest.fn(),
    update:     jest.fn(),
    create:     jest.fn(),
  },
  transaction: {
    create:     jest.fn(),
    findUnique: jest.fn(),
    update:     jest.fn(),
  },
  dispute: {
    create: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    const config: Record<string, string> = {
      STRIPE_SECRET_KEY: 'sk_test_fake_key_for_unit_tests',
      FRONTEND_URL:      'http://localhost:5173',
    };
    return config[key] ?? null;
  }),
};

describe('PaymentsService', () => {
  let service: PaymentsService;

  // Instance de l'objet Stripe mocké (injectée dans le service via le constructeur)
  let mockStripeInstance: {
    checkout: { sessions: { create: jest.Mock; retrieve: jest.Mock } };
    webhooks: { constructEvent: jest.Mock };
    refunds: { create: jest.Mock };
  };

  beforeEach(async () => {
    mockStripeInstance = {
      checkout: {
        sessions: {
          create:   jest.fn().mockResolvedValue({
            id:  'cs_test_monaco_2026',
            url: 'https://checkout.stripe.com/pay/cs_test_monaco_2026',
          }),
          retrieve: jest.fn(),
        },
      },
      webhooks: {
        constructEvent: jest.fn(),
      },
      refunds: {
        create: jest.fn().mockResolvedValue({ id: 're_test_monaco_2026' }),
      },
    };

    // Le constructeur `new Stripe(key)` retournera notre mock
    (Stripe as unknown as jest.Mock).mockImplementation(() => mockStripeInstance);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService,  useValue: mockPrisma },
        { provide: ConfigService,  useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    jest.clearAllMocks();

    // Réinitialiser le mock ConfigService après clearAllMocks()
    mockConfigService.get.mockImplementation((key: string) => {
      const config: Record<string, string> = {
        STRIPE_SECRET_KEY: 'sk_test_fake_key_for_unit_tests',
        FRONTEND_URL:      'http://localhost:5173',
      };
      return config[key] ?? null;
    });
  });

  it('le service doit être instancié correctement', () => {
    expect(service).toBeDefined();
  });

  describe('createCheckoutSession()', () => {

    it('doit calculer correctement les frais de service (commission 5%)', async () => {
      

      mockPrisma.ticket.findUnique.mockResolvedValue(MOCK_TICKET_ON_SALE);
      mockPrisma.ticket.update.mockResolvedValue({ ...MOCK_TICKET_ON_SALE, status: TicketStatus.PENDING });
      mockStripeInstance.checkout.sessions.create.mockResolvedValue({
        id:  'cs_test_monaco_2026',
        url: 'https://checkout.stripe.com/pay/cs_test_monaco_2026',
      });

      await service.createCheckoutSession(TICKET_ID, BUYER_EMAIL);

      expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            amount: '200',   // prix hors frais
            fees:   '10',    // 5% de 200
            total:  '210',   // montant total débité
          }),
        }),
      );
    });

    it('doit marquer le billet PENDING avant de créer la session Stripe', async () => {
      

      mockPrisma.ticket.findUnique.mockResolvedValue(MOCK_TICKET_ON_SALE);
      mockPrisma.ticket.update.mockResolvedValue({ ...MOCK_TICKET_ON_SALE, status: TicketStatus.PENDING });
      mockStripeInstance.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test_monaco_2026', url: 'https://checkout.stripe.com/pay/cs_test_monaco_2026',
      });

      await service.createCheckoutSession(TICKET_ID, BUYER_EMAIL);

      const updateOrder  = mockPrisma.ticket.update.mock.invocationCallOrder[0];
      const stripeOrder  = mockStripeInstance.checkout.sessions.create.mock.invocationCallOrder[0];
      expect(updateOrder).toBeLessThan(stripeOrder);

      expect(mockPrisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: TicketStatus.PENDING },
        }),
      );
    });

    it('doit retourner sessionId et url après création de la session Stripe', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(MOCK_TICKET_ON_SALE);
      mockPrisma.ticket.update.mockResolvedValue({});
      mockStripeInstance.checkout.sessions.create.mockResolvedValue({
        id:  'cs_test_monaco_2026',
        url: 'https://checkout.stripe.com/pay/cs_test_monaco_2026',
      });

      const result = await service.createCheckoutSession(TICKET_ID, BUYER_EMAIL);

      expect(result).toEqual({
        sessionId: 'cs_test_monaco_2026',
        url:       'https://checkout.stripe.com/pay/cs_test_monaco_2026',
      });
    });

    it('doit lever BadRequestException si le billet est déjà VENDU (SOLD)', async () => {
      

      mockPrisma.ticket.findUnique.mockResolvedValue(MOCK_TICKET_SOLD);

      await expect(
        service.createCheckoutSession(TICKET_ID, BUYER_EMAIL),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createCheckoutSession(TICKET_ID, BUYER_EMAIL),
      ).rejects.toThrow("Ce billet n'est plus disponible");
    });

    it('doit lever BadRequestException si le billet est en cours d\'achat (PENDING)', async () => {
      

      mockPrisma.ticket.findUnique.mockResolvedValue(MOCK_TICKET_PENDING);

      await expect(
        service.createCheckoutSession(TICKET_ID, BUYER_EMAIL),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createCheckoutSession(TICKET_ID, BUYER_EMAIL),
      ).rejects.toThrow("Ce billet n'est plus disponible");
    });

    it('doit lever NotFoundException si le billet n\'existe pas', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(null);

      await expect(
        service.createCheckoutSession('uuid-inexistant', BUYER_EMAIL),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.createCheckoutSession('uuid-inexistant', BUYER_EMAIL),
      ).rejects.toThrow('Billet non trouvé');
    });

    it('doit lever BadRequestException si l\'acheteur est le vendeur du billet', async () => {
      

      mockPrisma.ticket.findUnique.mockResolvedValue(MOCK_TICKET_ON_SALE);

      await expect(
        service.createCheckoutSession(TICKET_ID, SELLER_EMAIL),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createCheckoutSession(TICKET_ID, SELLER_EMAIL),
      ).rejects.toThrow('Vous ne pouvez pas acheter votre propre billet');
    });

    it('doit rejeter l\'achat même si la casse de l\'email vendeur diffère', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(MOCK_TICKET_ON_SALE);

      await expect(
        service.createCheckoutSession(TICKET_ID, SELLER_EMAIL.toUpperCase()),
      ).rejects.toThrow('Vous ne pouvez pas acheter votre propre billet');
    });

    it('doit lever BadRequestException si l\'email de l\'acheteur est invalide', async () => {
      

      await expect(
        service.createCheckoutSession(TICKET_ID, 'email-invalide'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createCheckoutSession(TICKET_ID, 'email-invalide'),
      ).rejects.toThrow('Email invalide');
    });

    it('doit lever BadRequestException si l\'email est vide', async () => {
      await expect(
        service.createCheckoutSession(TICKET_ID, ''),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelPendingPurchase()', () => {
    it('doit remettre un billet PENDING en vente (ON_SALE) lors d\'une annulation', async () => {
      

      mockPrisma.ticket.findUnique.mockResolvedValue(MOCK_TICKET_PENDING);
      mockPrisma.ticket.update.mockResolvedValue({ ...MOCK_TICKET_PENDING, status: TicketStatus.ON_SALE });

      const result = await service.cancelPendingPurchase(TICKET_ID);

      expect(mockPrisma.ticket.update).toHaveBeenCalledWith({
        where: { id: TICKET_ID },
        data:  { status: TicketStatus.ON_SALE },
      });
      expect(result).toEqual({ cancelled: true });
    });

    it('ne doit PAS modifier un billet qui n\'est pas PENDING', async () => {
      

      mockPrisma.ticket.findUnique.mockResolvedValue(MOCK_TICKET_ON_SALE);

      const result = await service.cancelPendingPurchase(TICKET_ID);

      expect(mockPrisma.ticket.update).not.toHaveBeenCalled();
      expect(result).toEqual({ cancelled: true });
    });

    it('doit retourner { cancelled: true } même si le billet est introuvable', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(null);

      const result = await service.cancelPendingPurchase('uuid-inexistant');

      expect(result).toEqual({ cancelled: true });
      expect(mockPrisma.ticket.update).not.toHaveBeenCalled();
    });
  });

  describe('validateTicket()', () => {
    it('doit valider le billet si le GP est passé et la validation en attente', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue(MOCK_TRANSACTION_PENDING);
      mockPrisma.transaction.update.mockResolvedValue({
        ...MOCK_TRANSACTION_PENDING, buyerValidation: 'VALID',
      });

      const result = await service.validateTicket(TRANSACTION_ID, BUYER_ID);

      expect(result).toEqual({ success: true, status: 'VALID' });
      expect(mockPrisma.transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ buyerValidation: 'VALID' }),
        }),
      );
    });

    it('doit lever NotFoundException si la transaction est introuvable', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue(null);

      await expect(
        service.validateTicket('uuid-inexistant', BUYER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('doit lever ForbiddenException si l\'utilisateur n\'est pas l\'acheteur', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue(MOCK_TRANSACTION_PENDING);

      await expect(
        service.validateTicket(TRANSACTION_ID, SELLER_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('doit lever BadRequestException si la validation est déjà effectuée', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue({
        ...MOCK_TRANSACTION_PENDING, buyerValidation: 'VALID',
      });

      await expect(
        service.validateTicket(TRANSACTION_ID, BUYER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('doit lever BadRequestException si le GP n\'a pas encore eu lieu', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue({
        ...MOCK_TRANSACTION_PENDING,
        ticket: {
          ...MOCK_TRANSACTION_PENDING.ticket,
          grandPrix: { ...MOCK_GRAND_PRIX, date: new Date('2099-12-31') },
        },
      });

      await expect(
        service.validateTicket(TRANSACTION_ID, BUYER_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('handleWebhook()', () => {
    const MOCK_PAYLOAD   = Buffer.from('{"type":"checkout.session.completed"}');
    const MOCK_SIGNATURE = 'stripe-sig-test';

    beforeEach(() => {
      mockConfigService.get.mockImplementation((key: string) => {
        const config: Record<string, string> = {
          STRIPE_SECRET_KEY:    'sk_test_fake_key_for_unit_tests',
          FRONTEND_URL:         'http://localhost:5173',
          STRIPE_WEBHOOK_SECRET:'whsec_test_secret',
        };
        return config[key] ?? null;
      });
    });

    it('doit lever BadRequestException si le webhook secret nest pas configuré', async () => {
      mockConfigService.get.mockImplementation((key: string) =>
        key === 'STRIPE_SECRET_KEY' ? 'sk_test_fake_key_for_unit_tests' : null,
      );

      await expect(
        service.handleWebhook(MOCK_PAYLOAD, MOCK_SIGNATURE),
      ).rejects.toThrow(BadRequestException);
    });

    it('doit lever BadRequestException si la signature Stripe est invalide', async () => {
      mockStripeInstance.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      await expect(
        service.handleWebhook(MOCK_PAYLOAD, MOCK_SIGNATURE),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.handleWebhook(MOCK_PAYLOAD, MOCK_SIGNATURE),
      ).rejects.toThrow('Webhook Error: Invalid signature');
    });

    it('doit traiter un événement checkout.session.completed et créer la transaction', async () => {
      mockStripeInstance.webhooks.constructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: {
          object: {
            id:             'cs_test_monaco_2026',
            payment_intent: 'pi_test_monaco_2026',
            payment_status: 'paid',
            metadata: {
              ticketId:   TICKET_ID,
              buyerEmail: BUYER_EMAIL,
              amount:     '200',
              fees:       '10',
              total:      '210',
            },
          },
        },
      });

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.transaction.create.mockResolvedValue({});
      mockPrisma.ticket.update.mockResolvedValue({});

      const result = await service.handleWebhook(MOCK_PAYLOAD, MOCK_SIGNATURE);

      expect(result).toEqual({ received: true });
      expect(mockPrisma.transaction.create).toHaveBeenCalled();
      expect(mockPrisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: TicketStatus.SOLD } }),
      );
    });

    it('doit lier la transaction à un compte existant si email correspond', async () => {
      const existingUser = { id: BUYER_ID, email: BUYER_EMAIL };
      mockStripeInstance.webhooks.constructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: {
          object: {
            payment_intent: 'pi_test',
            metadata: { ticketId: TICKET_ID, buyerEmail: BUYER_EMAIL, amount: '200', fees: '10', total: '210' },
          },
        },
      });
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);
      mockPrisma.transaction.create.mockResolvedValue({});
      mockPrisma.ticket.update.mockResolvedValue({});

      await service.handleWebhook(MOCK_PAYLOAD, MOCK_SIGNATURE);

      expect(mockPrisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ buyerId: BUYER_ID }) }),
      );
    });

    it('doit ignorer les événements non gérés', async () => {
      mockStripeInstance.webhooks.constructEvent.mockReturnValue({
        type: 'payment_intent.created',
        data: { object: {} },
      });

      const result = await service.handleWebhook(MOCK_PAYLOAD, MOCK_SIGNATURE);

      expect(result).toEqual({ received: true });
      expect(mockPrisma.transaction.create).not.toHaveBeenCalled();
    });
  });

  describe('verifySession()', () => {
    const SESSION_ID = 'cs_test_monaco_2026';

    const MOCK_SESSION_PAID = {
      id:             SESSION_ID,
      payment_status: 'paid',
      metadata: {
        ticketId:   TICKET_ID,
        buyerEmail: BUYER_EMAIL,
        amount:     '200',
        fees:       '10',
        total:      '210',
      },
    };

    const MOCK_TICKET_WITH_TRANSACTION = {
      ...MOCK_TICKET_ON_SALE,
      status:      TicketStatus.SOLD,
      grandPrix:   MOCK_GRAND_PRIX,
      transaction: { id: TRANSACTION_ID },
    };

    it('doit retourner { success: false } si le paiement nest pas complété', async () => {
      mockStripeInstance.checkout.sessions.retrieve.mockResolvedValue({
        ...MOCK_SESSION_PAID,
        payment_status: 'unpaid',
      });

      const result = await service.verifySession(SESSION_ID);

      expect(result).toEqual({ success: false });
    });

    it('doit retourner { success: false } si ticketId est absent des metadata', async () => {
      mockStripeInstance.checkout.sessions.retrieve.mockResolvedValue({
        ...MOCK_SESSION_PAID,
        metadata: {},
      });

      const result = await service.verifySession(SESSION_ID);

      expect(result).toEqual({ success: false });
    });

    it('doit retourner { success: false } si le billet est introuvable en BDD', async () => {
      mockStripeInstance.checkout.sessions.retrieve.mockResolvedValue(MOCK_SESSION_PAID);
      mockPrisma.ticket.findUnique.mockResolvedValue(null);

      const result = await service.verifySession(SESSION_ID);

      expect(result).toEqual({ success: false });
    });

    it('doit retourner les détails du billet si la transaction est déjà en BDD', async () => {
      mockStripeInstance.checkout.sessions.retrieve.mockResolvedValue(MOCK_SESSION_PAID);
      mockPrisma.ticket.findUnique.mockResolvedValue(MOCK_TICKET_WITH_TRANSACTION);

      const result = await service.verifySession(SESSION_ID);

      expect(result).toEqual({
        success: true,
        ticket: expect.objectContaining({
          id:           TICKET_ID,
          grandPrixName: MOCK_GRAND_PRIX.name,
          section:      MOCK_TICKET_ON_SALE.section,
        }),
      });
    });

    it('doit compléter la transaction si elle nexiste pas encore en BDD', async () => {
      mockStripeInstance.checkout.sessions.retrieve.mockResolvedValue(MOCK_SESSION_PAID);
      mockPrisma.ticket.findUnique
        .mockResolvedValueOnce({ ...MOCK_TICKET_WITH_TRANSACTION, transaction: null })
        .mockResolvedValueOnce(MOCK_TICKET_WITH_TRANSACTION);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.transaction.create.mockResolvedValue({});
      mockPrisma.ticket.update.mockResolvedValue({});

      const result = await service.verifySession(SESSION_ID);

      expect(mockPrisma.transaction.create).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ success: true }));
    });
  });

  describe('disputeTicket()', () => {
    beforeEach(() => {
      mockPrisma.$transaction.mockImplementation((ops: any[]) => Promise.all(ops));
    });

    it('doit créer un litige et initier le remboursement Stripe', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue(MOCK_TRANSACTION_PENDING);
      mockPrisma.transaction.update.mockResolvedValue({
        ...MOCK_TRANSACTION_PENDING, buyerValidation: 'DISPUTED', status: 'REFUNDED',
      });
      mockPrisma.dispute.create.mockResolvedValue({ id: 'dispute-001' });

      const result = await service.disputeTicket(TRANSACTION_ID, BUYER_ID);

      expect(result).toEqual({ success: true, status: 'DISPUTED' });
      expect(mockStripeInstance.refunds.create).toHaveBeenCalledWith(
        expect.objectContaining({ payment_intent: 'pi_test_monaco_2026' }),
      );
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('doit marquer la transaction en REFUNDED lors d\'un litige', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue(MOCK_TRANSACTION_PENDING);
      mockPrisma.transaction.update.mockResolvedValue({});
      mockPrisma.dispute.create.mockResolvedValue({});

      await service.disputeTicket(TRANSACTION_ID, BUYER_ID);

      expect(mockPrisma.$transaction).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.anything(),
          expect.anything(),
        ]),
      );
    });

    it('doit lever NotFoundException si la transaction est introuvable', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue(null);

      await expect(
        service.disputeTicket('uuid-inexistant', BUYER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('doit lever ForbiddenException si l\'utilisateur n\'est pas l\'acheteur', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue(MOCK_TRANSACTION_PENDING);

      await expect(
        service.disputeTicket(TRANSACTION_ID, SELLER_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('doit lever BadRequestException si un litige est déjà ouvert', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue({
        ...MOCK_TRANSACTION_PENDING, buyerValidation: 'DISPUTED',
      });

      await expect(
        service.disputeTicket(TRANSACTION_ID, BUYER_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
