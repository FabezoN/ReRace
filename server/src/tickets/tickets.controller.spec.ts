/**
 * TESTS UNITAIRES — TicketsController
 *
 * Objectif : vérifier que
 *   1. La route POST est bien protégée par JwtAuthGuard (@UseGuards)
 *   2. La route GET est publique (pas de guard)
 *   3. Le contrôleur délègue correctement au TicketsService
 *
 * Note sur les guards NestJS :
 *   @UseGuards(GuardClass) stocke les métadonnées sur le prototype de la méthode
 *   via Reflect. On peut les lire avec Reflect.getMetadata('__guards__', ...).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TicketStatus } from '@prisma/client';

// ─── Données fictives ─────────────────────────────────────────────────────────

const SELLER_ID = 'a1b2c3d4-0000-4000-8000-111111111111';
const GP_ID     = 'b566a345-0001-4001-8001-222222222222';
const TICKET_ID = 'c7d8e9f0-0002-4002-8002-333333333333';

const CREATE_DTO = {
  grandPrixId: GP_ID,
  section:     'Tribune K',
  row:         '4',
  seat:        '12',
  price:       150.50,
  imageUrl:    'https://xyz.supabase.co/storage/v1/object/public/tickets/billet-monaco.jpg',
};

const MOCK_TICKET = {
  id:          TICKET_ID,
  grandPrixId: GP_ID,
  sellerId:    SELLER_ID,
  section:     'Tribune K',
  row:         '4',
  seat:        '12',
  price:       150.50,
  currency:    'EUR',
  status:      TicketStatus.ON_SALE,
};

// ─── Mock du TicketsService ───────────────────────────────────────────────────

const mockTicketsService = {
  create:          jest.fn(),
  findByGrandPrix: jest.fn(),
};

// ─── Suite de tests ───────────────────────────────────────────────────────────

describe('TicketsController', () => {
  let controller: TicketsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [
        { provide: TicketsService, useValue: mockTicketsService },
      ],
    }).compile();

    controller = module.get<TicketsController>(TicketsController);
    jest.clearAllMocks();
  });

  it('✅ le contrôleur doit être instancié correctement', () => {
    expect(controller).toBeDefined();
  });

  // ─── Vérification des guards (sécurité) ────────────────────────────────────

  describe('Sécurité — @UseGuards', () => {
    it('✅ POST / — la route create() est protégée par JwtAuthGuard', () => {
      // Arrange : NestJS stocke les guards via Reflect sur le prototype de la méthode
      // Act
      const guards = Reflect.getMetadata('__guards__', TicketsController.prototype.create);

      // Assert : la route de création exige un token JWT valide
      expect(guards).toBeDefined();
      expect(guards).toContain(JwtAuthGuard);
    });

    it('✅ GET /grand-prix/:id — la route findByGrandPrix() est publique (aucun guard)', () => {
      // Act
      const guards = Reflect.getMetadata('__guards__', TicketsController.prototype.findByGrandPrix);

      // Assert : tout visiteur peut consulter les billets d'un GP sans être connecté
      expect(guards).toBeUndefined();
    });
  });

  // ─── Délégation au service ─────────────────────────────────────────────────

  describe('POST / — create()', () => {
    it('✅ doit déléguer la création au TicketsService avec le bon userId', async () => {
      // Arrange : simulation de la requête avec l'utilisateur injecté par le guard
      const mockRequest = { user: { id: SELLER_ID } };
      mockTicketsService.create.mockResolvedValue(MOCK_TICKET);

      // Act
      const result = await controller.create(CREATE_DTO as any, mockRequest as any);

      // Assert : le service reçoit le DTO et l'ID de l'utilisateur connecté
      expect(mockTicketsService.create).toHaveBeenCalledWith(CREATE_DTO, SELLER_ID);
      expect(result).toEqual(MOCK_TICKET);
    });

    it('✅ doit retourner le billet créé tel que renvoyé par le service', async () => {
      // Arrange
      const mockRequest = { user: { id: SELLER_ID } };
      mockTicketsService.create.mockResolvedValue(MOCK_TICKET);

      // Act
      const result = await controller.create(CREATE_DTO as any, mockRequest as any);

      // Assert
      expect(result).toMatchObject({ id: TICKET_ID, status: TicketStatus.ON_SALE });
    });
  });

  describe('GET /grand-prix/:id — findByGrandPrix()', () => {
    it('✅ doit déléguer la recherche au TicketsService avec le bon grandPrixId', async () => {
      // Arrange
      mockTicketsService.findByGrandPrix.mockResolvedValue([MOCK_TICKET]);

      // Act
      const result = await controller.findByGrandPrix(GP_ID);

      // Assert
      expect(mockTicketsService.findByGrandPrix).toHaveBeenCalledWith(GP_ID);
      expect(result).toHaveLength(1);
    });

    it('✅ doit retourner un tableau vide si aucun billet n\'est disponible', async () => {
      // Arrange
      mockTicketsService.findByGrandPrix.mockResolvedValue([]);

      // Act
      const result = await controller.findByGrandPrix(GP_ID);

      // Assert
      expect(result).toEqual([]);
    });
  });
});
