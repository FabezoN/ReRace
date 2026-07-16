
import { Test, TestingModule } from '@nestjs/testing';
import { TicketsService } from './tickets.service';
import { PrismaService } from '../prisma/prisma.service';
import { TicketStatus } from '@prisma/client';

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

const CREATE_DTO = {
  grandPrixId: GP_ID,
  section:     'Tribune K',
  row:         '4',
  seat:        '12',
  price:       150.50,
  imageUrl:    'https://xyz.supabase.co/storage/v1/object/public/tickets/billet-monaco.jpg',
};

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

  it('le service doit être instancié correctement', () => {
    expect(service).toBeDefined();
  });

  describe('create()', () => {
    it('doit créer un billet avec succès si les données sont valides', async () => {
      mockPrisma.ticket.create.mockResolvedValue(MOCK_TICKET);

      const result = await service.create(CREATE_DTO, SELLER_ID);

      expect(result).toEqual(MOCK_TICKET);
      expect(mockPrisma.ticket.create).toHaveBeenCalledTimes(1);
    });

    it('doit transmettre le statut ON_SALE lors de la création', async () => {
      mockPrisma.ticket.create.mockResolvedValue(MOCK_TICKET);

      await service.create(CREATE_DTO, SELLER_ID);

      expect(mockPrisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: TicketStatus.ON_SALE,
          }),
        }),
      );
    });

    it('doit associer le vendeur (sellerId) au billet créé', async () => {
      mockPrisma.ticket.create.mockResolvedValue(MOCK_TICKET);

      await service.create(CREATE_DTO, SELLER_ID);

      expect(mockPrisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sellerId: SELLER_ID,
          }),
        }),
      );
    });

    it('doit définir la devise EUR par défaut', async () => {
      mockPrisma.ticket.create.mockResolvedValue(MOCK_TICKET);

      await service.create(CREATE_DTO, SELLER_ID);

      expect(mockPrisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currency: 'EUR',
          }),
        }),
      );
    });

    it('doit inclure les relations grandPrix et seller dans la réponse', async () => {
      mockPrisma.ticket.create.mockResolvedValue(MOCK_TICKET);

      await service.create(CREATE_DTO, SELLER_ID);

      expect(mockPrisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            grandPrix: true,
            seller:    expect.objectContaining({ select: expect.any(Object) }),
          }),
        }),
      );
    });

    it('doit propager l\'erreur si Prisma échoue (contrainte base de données)', async () => {
      mockPrisma.ticket.create.mockRejectedValue(
        new Error('Foreign key constraint failed on field: grandPrixId'),
      );

      await expect(service.create(CREATE_DTO, SELLER_ID)).rejects.toThrow(
        'Foreign key constraint failed on field: grandPrixId',
      );
    });
  });

  describe('findByGrandPrix()', () => {
    it('doit retourner la liste des billets ON_SALE d\'un Grand Prix', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue([MOCK_TICKET]);

      const result = await service.findByGrandPrix(GP_ID);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(TICKET_ID);
      expect(result[0].status).toBe(TicketStatus.ON_SALE);
    });

    it('doit filtrer uniquement les billets ON_SALE (pas SOLD, PENDING, etc.)', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue([]);

      await service.findByGrandPrix(GP_ID);

      expect(mockPrisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            grandPrixId: GP_ID,
            status:      TicketStatus.ON_SALE,
          }),
        }),
      );
    });

    it('doit retourner un tableau vide si aucun billet n\'est disponible', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue([]);

      const result = await service.findByGrandPrix(GP_ID);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('doit appeler Prisma une seule fois avec le bon grandPrixId', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue([MOCK_TICKET]);

      await service.findByGrandPrix(GP_ID);

      expect(mockPrisma.ticket.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ grandPrixId: GP_ID }),
        }),
      );
    });
  });
});
