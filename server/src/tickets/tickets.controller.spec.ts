
import { Test, TestingModule } from '@nestjs/testing';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TicketStatus } from '@prisma/client';

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

const mockTicketsService = {
  create:          jest.fn(),
  findByGrandPrix: jest.fn(),
};

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

  it('le contrôleur doit être instancié correctement', () => {
    expect(controller).toBeDefined();
  });

  describe('Sécurité — @UseGuards', () => {
    it('POST / — la route create() est protégée par JwtAuthGuard', () => {
      const guards = Reflect.getMetadata('__guards__', TicketsController.prototype.create);

      expect(guards).toBeDefined();
      expect(guards).toContain(JwtAuthGuard);
    });

    it('GET /grand-prix/:id — la route findByGrandPrix() est publique (aucun guard)', () => {
      const guards = Reflect.getMetadata('__guards__', TicketsController.prototype.findByGrandPrix);

      expect(guards).toBeUndefined();
    });
  });

  describe('POST / — create()', () => {
    it('doit déléguer la création au TicketsService avec le bon userId', async () => {
      const mockRequest = { user: { id: SELLER_ID } };
      mockTicketsService.create.mockResolvedValue(MOCK_TICKET);

      const result = await controller.create(CREATE_DTO as any, mockRequest as any);

      expect(mockTicketsService.create).toHaveBeenCalledWith(CREATE_DTO, SELLER_ID);
      expect(result).toEqual(MOCK_TICKET);
    });

    it('doit retourner le billet créé tel que renvoyé par le service', async () => {
      const mockRequest = { user: { id: SELLER_ID } };
      mockTicketsService.create.mockResolvedValue(MOCK_TICKET);

      const result = await controller.create(CREATE_DTO as any, mockRequest as any);

      expect(result).toMatchObject({ id: TICKET_ID, status: TicketStatus.ON_SALE });
    });
  });

  describe('GET /grand-prix/:id — findByGrandPrix()', () => {
    it('doit déléguer la recherche au TicketsService avec le bon grandPrixId', async () => {
      mockTicketsService.findByGrandPrix.mockResolvedValue([MOCK_TICKET]);

      const result = await controller.findByGrandPrix(GP_ID);

      expect(mockTicketsService.findByGrandPrix).toHaveBeenCalledWith(GP_ID);
      expect(result).toHaveLength(1);
    });

    it('doit retourner un tableau vide si aucun billet n\'est disponible', async () => {
      mockTicketsService.findByGrandPrix.mockResolvedValue([]);

      const result = await controller.findByGrandPrix(GP_ID);

      expect(result).toEqual([]);
    });
  });
});
