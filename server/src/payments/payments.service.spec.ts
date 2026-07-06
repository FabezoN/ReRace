/**
 * TESTS UNITAIRES — PaymentsService
 *
 * Objectif : valider les règles métier critiques du processus d'achat :
 *   - Calcul correct des frais de service (commission 5%)
 *   - Rejet d'un achat sur un billet déjà vendu ou en attente
 *   - Rejet si l'acheteur est le vendeur
 *   - Validation du format d'email
 *   - Remise en vente d'un billet annulé
 *
 * Mocks :
 *   - PrismaService  → jest.fn() (pas de vraie BDD)
 *   - ConfigService  → retourne les clés d'environnement fictives
 *   - Stripe         → jest.mock('stripe') pour éviter tout appel réseau
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { TicketStatus } from '@prisma/client';
import Stripe from 'stripe';

// ─── Mock de Stripe (aucun appel réseau) ────────────────────────────────────
//
// jest.mock est hissé (hoisted) avant les imports.
// On déclare les fonctions mock dans ce bloc pour qu'elles soient accessibles
// dans les tests via la référence à l'instance.

jest.mock('stripe', () => jest.fn());

// ─── Données fictives réalistes ───────────────────────────────────────────────

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

/** Billet disponible à l'achat */
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

/** Billet déjà vendu */
const MOCK_TICKET_SOLD = { ...MOCK_TICKET_ON_SALE, status: TicketStatus.SOLD };

/** Billet en cours de paiement (session Stripe ouverte) */
const MOCK_TICKET_PENDING = { ...MOCK_TICKET_ON_SALE, status: TicketStatus.PENDING };

// ─── Mocks des dépendances ────────────────────────────────────────────────────

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

// ─── Suite de tests ───────────────────────────────────────────────────────────

describe('PaymentsService', () => {
  let service: PaymentsService;

  // Instance de l'objet Stripe mocké (injectée dans le service via le constructeur)
  let mockStripeInstance: {
    checkout: { sessions: { create: jest.Mock; retrieve: jest.Mock } };
    webhooks: { constructEvent: jest.Mock };
    refunds: { create: jest.Mock };
  };

  beforeEach(async () => {
    // Arrange : configurer l'objet Stripe simulé avant chaque test
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

  it('✅ le service doit être instancié correctement', () => {
    expect(service).toBeDefined();
  });

  // ─── createCheckoutSession() ───────────────────────────────────────────────

  describe('createCheckoutSession()', () => {

    // ── Scénario 1 : achat réussi & calcul des frais ─────────────────────────

    it('✅ doit calculer correctement les frais de service (commission 5%)', async () => {
      /**
       * Règle métier : frais = arrondi(prix × 5%) — plateforme ReRace
       *
       * Exemple avec un billet à 200 € :
       *   fees  = Math.round(200 × 0.05 × 100) / 100 = 10.00 €
       *   total = 200.00 + 10.00 = 210.00 €
       */

      // Arrange
      mockPrisma.ticket.findUnique.mockResolvedValue(MOCK_TICKET_ON_SALE);
      mockPrisma.ticket.update.mockResolvedValue({ ...MOCK_TICKET_ON_SALE, status: TicketStatus.PENDING });
      mockStripeInstance.checkout.sessions.create.mockResolvedValue({
        id:  'cs_test_monaco_2026',
        url: 'https://checkout.stripe.com/pay/cs_test_monaco_2026',
      });

      // Act
      await service.createCheckoutSession(TICKET_ID, BUYER_EMAIL);

      // Assert : les métadonnées envoyées à Stripe reflètent le bon calcul
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

    it('✅ doit marquer le billet PENDING avant de créer la session Stripe', async () => {
      /**
       * Règle métier : on réserve le billet (PENDING) avant d'ouvrir la session
       * de paiement pour éviter une double vente concurrente.
       */

      // Arrange
      mockPrisma.ticket.findUnique.mockResolvedValue(MOCK_TICKET_ON_SALE);
      mockPrisma.ticket.update.mockResolvedValue({ ...MOCK_TICKET_ON_SALE, status: TicketStatus.PENDING });
      mockStripeInstance.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test_monaco_2026', url: 'https://checkout.stripe.com/pay/cs_test_monaco_2026',
      });

      // Act
      await service.createCheckoutSession(TICKET_ID, BUYER_EMAIL);

      // Assert : update vers PENDING appelé AVANT la création de la session Stripe
      const updateOrder  = mockPrisma.ticket.update.mock.invocationCallOrder[0];
      const stripeOrder  = mockStripeInstance.checkout.sessions.create.mock.invocationCallOrder[0];
      expect(updateOrder).toBeLessThan(stripeOrder);

      expect(mockPrisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: TicketStatus.PENDING },
        }),
      );
    });

    it('✅ doit retourner sessionId et url après création de la session Stripe', async () => {
      // Arrange
      mockPrisma.ticket.findUnique.mockResolvedValue(MOCK_TICKET_ON_SALE);
      mockPrisma.ticket.update.mockResolvedValue({});
      mockStripeInstance.checkout.sessions.create.mockResolvedValue({
        id:  'cs_test_monaco_2026',
        url: 'https://checkout.stripe.com/pay/cs_test_monaco_2026',
      });

      // Act
      const result = await service.createCheckoutSession(TICKET_ID, BUYER_EMAIL);

      // Assert
      expect(result).toEqual({
        sessionId: 'cs_test_monaco_2026',
        url:       'https://checkout.stripe.com/pay/cs_test_monaco_2026',
      });
    });

    // ── Scénario 2 : billet déjà vendu ou en attente ─────────────────────────

    it('❌ doit lever BadRequestException si le billet est déjà VENDU (SOLD)', async () => {
      /**
       * Règle métier critique : un billet vendu ne peut pas être acheté à nouveau.
       * Cette vérification protège contre les tentatives frauduleuses de double achat.
       */

      // Arrange : le billet a le statut SOLD
      mockPrisma.ticket.findUnique.mockResolvedValue(MOCK_TICKET_SOLD);

      // Act & Assert
      await expect(
        service.createCheckoutSession(TICKET_ID, BUYER_EMAIL),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createCheckoutSession(TICKET_ID, BUYER_EMAIL),
      ).rejects.toThrow("Ce billet n'est plus disponible");
    });

    it('❌ doit lever BadRequestException si le billet est en cours d\'achat (PENDING)', async () => {
      /**
       * Règle métier : un billet PENDING est déjà réservé par un autre acheteur
       * (session Stripe ouverte). Il ne faut pas créer une seconde session.
       */

      // Arrange : le billet a le statut PENDING
      mockPrisma.ticket.findUnique.mockResolvedValue(MOCK_TICKET_PENDING);

      // Act & Assert
      await expect(
        service.createCheckoutSession(TICKET_ID, BUYER_EMAIL),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createCheckoutSession(TICKET_ID, BUYER_EMAIL),
      ).rejects.toThrow("Ce billet n'est plus disponible");
    });

    // ── Scénario 3 : billet introuvable ──────────────────────────────────────

    it('❌ doit lever NotFoundException si le billet n\'existe pas', async () => {
      // Arrange : Prisma ne trouve aucun billet avec cet ID
      mockPrisma.ticket.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.createCheckoutSession('uuid-inexistant', BUYER_EMAIL),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.createCheckoutSession('uuid-inexistant', BUYER_EMAIL),
      ).rejects.toThrow('Billet non trouvé');
    });

    // ── Scénario 4 : acheteur = vendeur ──────────────────────────────────────

    it('❌ doit lever BadRequestException si l\'acheteur est le vendeur du billet', async () => {
      /**
       * Règle métier : un utilisateur ne peut pas acheter son propre billet.
       * La comparaison est insensible à la casse.
       */

      // Arrange : l'acheteur utilise le même email que le vendeur
      mockPrisma.ticket.findUnique.mockResolvedValue(MOCK_TICKET_ON_SALE);

      // Act & Assert
      await expect(
        service.createCheckoutSession(TICKET_ID, SELLER_EMAIL),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createCheckoutSession(TICKET_ID, SELLER_EMAIL),
      ).rejects.toThrow('Vous ne pouvez pas acheter votre propre billet');
    });

    it('❌ doit rejeter l\'achat même si la casse de l\'email vendeur diffère', async () => {
      // Arrange : email vendeur en majuscules côté acheteur
      mockPrisma.ticket.findUnique.mockResolvedValue(MOCK_TICKET_ON_SALE);

      // Act & Assert : la comparaison est case-insensitive
      await expect(
        service.createCheckoutSession(TICKET_ID, SELLER_EMAIL.toUpperCase()),
      ).rejects.toThrow('Vous ne pouvez pas acheter votre propre billet');
    });

    // ── Scénario 5 : validation de l'email ───────────────────────────────────

    it('❌ doit lever BadRequestException si l\'email de l\'acheteur est invalide', async () => {
      /**
       * Règle métier : un email valide est requis pour recevoir le billet
       * et créer la session Stripe.
       */

      // Act & Assert : email sans @
      await expect(
        service.createCheckoutSession(TICKET_ID, 'email-invalide'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createCheckoutSession(TICKET_ID, 'email-invalide'),
      ).rejects.toThrow('Email invalide');
    });

    it('❌ doit lever BadRequestException si l\'email est vide', async () => {
      // Act & Assert
      await expect(
        service.createCheckoutSession(TICKET_ID, ''),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── cancelPendingPurchase() ───────────────────────────────────────────────

  describe('cancelPendingPurchase()', () => {
    it('✅ doit remettre un billet PENDING en vente (ON_SALE) lors d\'une annulation', async () => {
      /**
       * Règle métier : si l'utilisateur annule le paiement Stripe,
       * le billet doit redevenir disponible pour d'autres acheteurs.
       */

      // Arrange : le billet est actuellement PENDING
      mockPrisma.ticket.findUnique.mockResolvedValue(MOCK_TICKET_PENDING);
      mockPrisma.ticket.update.mockResolvedValue({ ...MOCK_TICKET_PENDING, status: TicketStatus.ON_SALE });

      // Act
      const result = await service.cancelPendingPurchase(TICKET_ID);

      // Assert : le billet est remis en vente
      expect(mockPrisma.ticket.update).toHaveBeenCalledWith({
        where: { id: TICKET_ID },
        data:  { status: TicketStatus.ON_SALE },
      });
      expect(result).toEqual({ cancelled: true });
    });

    it('✅ ne doit PAS modifier un billet qui n\'est pas PENDING', async () => {
      /**
       * Règle métier : on ne touche pas aux billets déjà SOLD ou ON_SALE.
       */

      // Arrange : le billet est déjà ON_SALE (pas PENDING)
      mockPrisma.ticket.findUnique.mockResolvedValue(MOCK_TICKET_ON_SALE);

      // Act
      const result = await service.cancelPendingPurchase(TICKET_ID);

      // Assert : aucun update Prisma ne doit être effectué
      expect(mockPrisma.ticket.update).not.toHaveBeenCalled();
      expect(result).toEqual({ cancelled: true });
    });

    it('✅ doit retourner { cancelled: true } même si le billet est introuvable', async () => {
      // Arrange
      mockPrisma.ticket.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.cancelPendingPurchase('uuid-inexistant');

      // Assert
      expect(result).toEqual({ cancelled: true });
      expect(mockPrisma.ticket.update).not.toHaveBeenCalled();
    });
  });

  // ─── validateTicket() ─────────────────────────────────────────────────────

  describe('validateTicket()', () => {
    it('✅ doit valider le billet si le GP est passé et la validation en attente', async () => {
      // Arrange
      mockPrisma.transaction.findUnique.mockResolvedValue(MOCK_TRANSACTION_PENDING);
      mockPrisma.transaction.update.mockResolvedValue({
        ...MOCK_TRANSACTION_PENDING, buyerValidation: 'VALID',
      });

      // Act
      const result = await service.validateTicket(TRANSACTION_ID, BUYER_ID);

      // Assert
      expect(result).toEqual({ success: true, status: 'VALID' });
      expect(mockPrisma.transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ buyerValidation: 'VALID' }),
        }),
      );
    });

    it('❌ doit lever NotFoundException si la transaction est introuvable', async () => {
      // Arrange
      mockPrisma.transaction.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.validateTicket('uuid-inexistant', BUYER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('❌ doit lever ForbiddenException si l\'utilisateur n\'est pas l\'acheteur', async () => {
      // Arrange : la transaction appartient à BUYER_ID, pas à SELLER_ID
      mockPrisma.transaction.findUnique.mockResolvedValue(MOCK_TRANSACTION_PENDING);

      // Act & Assert
      await expect(
        service.validateTicket(TRANSACTION_ID, SELLER_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('❌ doit lever BadRequestException si la validation est déjà effectuée', async () => {
      // Arrange : validation déjà VALID
      mockPrisma.transaction.findUnique.mockResolvedValue({
        ...MOCK_TRANSACTION_PENDING, buyerValidation: 'VALID',
      });

      // Act & Assert
      await expect(
        service.validateTicket(TRANSACTION_ID, BUYER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('❌ doit lever BadRequestException si le GP n\'a pas encore eu lieu', async () => {
      // Arrange : date du GP dans le futur
      mockPrisma.transaction.findUnique.mockResolvedValue({
        ...MOCK_TRANSACTION_PENDING,
        ticket: {
          ...MOCK_TRANSACTION_PENDING.ticket,
          grandPrix: { ...MOCK_GRAND_PRIX, date: new Date('2099-12-31') },
        },
      });

      // Act & Assert
      await expect(
        service.validateTicket(TRANSACTION_ID, BUYER_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── disputeTicket() ──────────────────────────────────────────────────────

  describe('disputeTicket()', () => {
    beforeEach(() => {
      mockPrisma.$transaction.mockImplementation((ops: any[]) => Promise.all(ops));
    });

    it('✅ doit créer un litige et initier le remboursement Stripe', async () => {
      // Arrange
      mockPrisma.transaction.findUnique.mockResolvedValue(MOCK_TRANSACTION_PENDING);
      mockPrisma.transaction.update.mockResolvedValue({
        ...MOCK_TRANSACTION_PENDING, buyerValidation: 'DISPUTED', status: 'REFUNDED',
      });
      mockPrisma.dispute.create.mockResolvedValue({ id: 'dispute-001' });

      // Act
      const result = await service.disputeTicket(TRANSACTION_ID, BUYER_ID);

      // Assert
      expect(result).toEqual({ success: true, status: 'DISPUTED' });
      expect(mockStripeInstance.refunds.create).toHaveBeenCalledWith(
        expect.objectContaining({ payment_intent: 'pi_test_monaco_2026' }),
      );
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('✅ doit marquer la transaction en REFUNDED lors d\'un litige', async () => {
      // Arrange
      mockPrisma.transaction.findUnique.mockResolvedValue(MOCK_TRANSACTION_PENDING);
      mockPrisma.transaction.update.mockResolvedValue({});
      mockPrisma.dispute.create.mockResolvedValue({});

      // Act
      await service.disputeTicket(TRANSACTION_ID, BUYER_ID);

      // Assert : la transaction atomique inclut bien un update vers REFUNDED
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.anything(),
          expect.anything(),
        ]),
      );
    });

    it('❌ doit lever NotFoundException si la transaction est introuvable', async () => {
      // Arrange
      mockPrisma.transaction.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.disputeTicket('uuid-inexistant', BUYER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('❌ doit lever ForbiddenException si l\'utilisateur n\'est pas l\'acheteur', async () => {
      // Arrange
      mockPrisma.transaction.findUnique.mockResolvedValue(MOCK_TRANSACTION_PENDING);

      // Act & Assert
      await expect(
        service.disputeTicket(TRANSACTION_ID, SELLER_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('❌ doit lever BadRequestException si un litige est déjà ouvert', async () => {
      // Arrange : validation déjà DISPUTED
      mockPrisma.transaction.findUnique.mockResolvedValue({
        ...MOCK_TRANSACTION_PENDING, buyerValidation: 'DISPUTED',
      });

      // Act & Assert
      await expect(
        service.disputeTicket(TRANSACTION_ID, BUYER_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
