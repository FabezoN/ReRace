/**
 * TESTS UNITAIRES — TicketsService
 *
 * Objectif : valider les règles métier du service de billets sans
 * connexion réelle à la base de données (mock de PrismaService).
 *
 * Pattern utilisé : AAA (Arrange / Act / Assert)
 *   - Arrange  : préparer les données fictives et configurer les mocks
 *   - Act      : appeler la méthode testée
 *   - Assert   : vérifier le résultat ou les effets de bord
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TicketsService } from './tickets.service';
import { PrismaService } from '../prisma/prisma.service';
import { TicketStatus } from '@prisma/client';

// ─── Données fictives réalistes (thème F1) ────────────────────────────────────

const SELLER_ID = 'a1b2c3d4-0000-4000-8000-111111111111';
const GP_ID     = 'b566a345-0001-4001-8001-222222222222';
const TICKET_ID = 'c7d8e9f0-0002-4002-8002-333333333333';

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

const MOCK_SELLER = {
  id:        SELLER_ID,
  email:     'charles.leclerc@rerace.io',
  firstName: 'Charles',
  lastName:  'Leclerc',
};

/** Billet complet tel que retourné par Prisma (avec relations) */
const MOCK_TICKET = {
  id:            TICKET_ID,
  grandPrixId:   GP_ID,
  sellerId:      SELLER_ID,
  section:       'Tribune K',
  row:           '4',
  seat:          '12',
  price:         150.50,
  currency:      'EUR',
  status:        TicketStatus.ON_SALE,
  imageUrl:      'https://xyz.supabase.co/storage/v1/object/public/tickets/billet-monaco.jpg',
  qrCodeUrl:     null,
  originalPrice: null,
  createdAt:     new Date('2026-01-15'),
  updatedAt:     new Date('2026-01-15'),
  grandPrix:     MOCK_GRAND_PRIX,
  seller:        MOCK_SELLER,
};

/** DTO de création de billet (entrée du contrôleur) */
const CREATE_DTO = {
  grandPrixId: GP_ID,
  section:     'Tribune K',
  row:         '4',
  seat:        '12',
  price:       150.50,
  imageUrl:    'https://xyz.supabase.co/storage/v1/object/public/tickets/billet-monaco.jpg',
};

// ─── Mock de PrismaService ────────────────────────────────────────────────────
//
// On remplace PrismaService par un objet avec des jest.fn() pour éviter
// toute connexion réelle à PostgreSQL pendant les tests.

const mockPrisma = {
  ticket: {
    create:     jest.fn(),
    findMany:   jest.fn(),
    findUnique: jest.fn(),
  },
};

// ─── Suite de tests ───────────────────────────────────────────────────────────

describe('TicketsService', () => {
  let service: TicketsService;

  beforeEach(async () => {
    // Construction du module de test NestJS avec le mock Prisma injecté
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TicketsService>(TicketsService);

    // Réinitialiser les compteurs d'appels entre chaque test
    jest.clearAllMocks();
  });

  it('✅ le service doit être instancié correctement', () => {
    expect(service).toBeDefined();
  });

  // ─── create() ──────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('✅ doit créer un billet avec succès si les données sont valides', async () => {
      // Arrange : Prisma renvoie le billet créé
      mockPrisma.ticket.create.mockResolvedValue(MOCK_TICKET);

      // Act
      const result = await service.create(CREATE_DTO, SELLER_ID);

      // Assert : le résultat correspond au billet attendu
      expect(result).toEqual(MOCK_TICKET);
      expect(mockPrisma.ticket.create).toHaveBeenCalledTimes(1);
    });

    it('✅ doit transmettre le statut ON_SALE lors de la création', async () => {
      // Arrange
      mockPrisma.ticket.create.mockResolvedValue(MOCK_TICKET);

      // Act
      await service.create(CREATE_DTO, SELLER_ID);

      // Assert : règle métier — un billet nouvellement créé est toujours ON_SALE
      expect(mockPrisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: TicketStatus.ON_SALE,
          }),
        }),
      );
    });

    it('✅ doit associer le vendeur (sellerId) au billet créé', async () => {
      // Arrange
      mockPrisma.ticket.create.mockResolvedValue(MOCK_TICKET);

      // Act
      await service.create(CREATE_DTO, SELLER_ID);

      // Assert : le sellerId de l'utilisateur connecté est bien transmis à Prisma
      expect(mockPrisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sellerId: SELLER_ID,
          }),
        }),
      );
    });

    it('✅ doit définir la devise EUR par défaut', async () => {
      // Arrange
      mockPrisma.ticket.create.mockResolvedValue(MOCK_TICKET);

      // Act
      await service.create(CREATE_DTO, SELLER_ID);

      // Assert : la devise est EUR (exigence métier — plateforme européenne)
      expect(mockPrisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currency: 'EUR',
          }),
        }),
      );
    });

    it('✅ doit inclure les relations grandPrix et seller dans la réponse', async () => {
      // Arrange
      mockPrisma.ticket.create.mockResolvedValue(MOCK_TICKET);

      // Act
      await service.create(CREATE_DTO, SELLER_ID);

      // Assert : la requête Prisma demande bien les relations via `include`
      expect(mockPrisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            grandPrix: true,
            seller:    expect.objectContaining({ select: expect.any(Object) }),
          }),
        }),
      );
    });

    it('❌ doit propager l\'erreur si Prisma échoue (contrainte base de données)', async () => {
      // Arrange : simulation d'une erreur de clé étrangère (grandPrixId inexistant)
      mockPrisma.ticket.create.mockRejectedValue(
        new Error('Foreign key constraint failed on field: grandPrixId'),
      );

      // Act & Assert : le service laisse remonter l'erreur sans la masquer
      await expect(service.create(CREATE_DTO, SELLER_ID)).rejects.toThrow(
        'Foreign key constraint failed on field: grandPrixId',
      );
    });
  });

  // ─── findByGrandPrix() ─────────────────────────────────────────────────────

  describe('findByGrandPrix()', () => {
    it('✅ doit retourner la liste des billets ON_SALE d\'un Grand Prix', async () => {
      // Arrange
      mockPrisma.ticket.findMany.mockResolvedValue([MOCK_TICKET]);

      // Act
      const result = await service.findByGrandPrix(GP_ID);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(TICKET_ID);
      expect(result[0].status).toBe(TicketStatus.ON_SALE);
    });

    it('✅ doit filtrer uniquement les billets ON_SALE (pas SOLD, PENDING, etc.)', async () => {
      // Arrange
      mockPrisma.ticket.findMany.mockResolvedValue([]);

      // Act
      await service.findByGrandPrix(GP_ID);

      // Assert : règle métier — on ne montre que les billets disponibles à l'achat
      expect(mockPrisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            grandPrixId: GP_ID,
            status:      TicketStatus.ON_SALE,
          }),
        }),
      );
    });

    it('✅ doit retourner un tableau vide si aucun billet n\'est disponible', async () => {
      // Arrange : aucun billet en vente pour ce GP
      mockPrisma.ticket.findMany.mockResolvedValue([]);

      // Act
      const result = await service.findByGrandPrix(GP_ID);

      // Assert
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('✅ doit appeler Prisma une seule fois avec le bon grandPrixId', async () => {
      // Arrange
      mockPrisma.ticket.findMany.mockResolvedValue([MOCK_TICKET]);

      // Act
      await service.findByGrandPrix(GP_ID);

      // Assert
      expect(mockPrisma.ticket.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ grandPrixId: GP_ID }),
        }),
      );
    });
  });
});
