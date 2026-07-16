
import { Test, TestingModule } from '@nestjs/testing';
import { GrandPrixService } from './grand-prix.service';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const MOCK_RACE_NO_TIME = {
  season: '2026',
  round: '6',
  url: 'https://en.wikipedia.org/wiki/2026_Monaco_Grand_Prix',
  raceName: 'Monaco Grand Prix',
  Circuit: {
    circuitId: 'monaco',
    url: 'https://en.wikipedia.org/wiki/Circuit_de_Monaco',
    circuitName: 'Circuit de Monaco',
    Location: { lat: '43.7347', long: '7.42056', locality: 'Monte-Carlo', country: 'Monaco' },
  },
  date: '2026-05-24',
};

const MOCK_RACE_WITH_TIME = {
  ...MOCK_RACE_NO_TIME,
  round: '7',
  raceName: 'Canadian Grand Prix',
  date: '2026-06-14',
  time: '18:00:00Z',
};

const MOCK_GP_UPSERTED = {
  id: 'gp-uuid-001',
  externalId: 'jolpica-2026-6',
  name: 'Monaco Grand Prix',
  circuitName: 'Circuit de Monaco',
  country: 'Monaco',
  date: new Date('2026-05-24'),
  season: 2026,
  imageUrl: null,
};

const mockPrisma = {
  grandPrix: {
    findMany:   jest.fn(),
    findUnique: jest.fn(),
    upsert:     jest.fn(),
    delete:     jest.fn(),
  },
};

describe('GrandPrixService', () => {
  let service: GrandPrixService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GrandPrixService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<GrandPrixService>(GrandPrixService);
    jest.clearAllMocks();
  });

  it('le service doit être instancié correctement', () => {
    expect(service).toBeDefined();
  });

  describe('findAll()', () => {
    it('doit retourner la liste des GPs de la saison 2026 par défaut', async () => {
      mockPrisma.grandPrix.findMany.mockResolvedValue([MOCK_GP_UPSERTED]);

      const result = await service.findAll();

      expect(result).toEqual([MOCK_GP_UPSERTED]);
      expect(mockPrisma.grandPrix.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { season: 2026 } }),
      );
    });

    it('doit filtrer par saison si fournie', async () => {
      mockPrisma.grandPrix.findMany.mockResolvedValue([]);

      await service.findAll(2025);

      expect(mockPrisma.grandPrix.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { season: 2025 } }),
      );
    });
  });

  describe('findOne()', () => {
    it('doit retourner un GP avec ses billets disponibles', async () => {
      mockPrisma.grandPrix.findUnique.mockResolvedValue(MOCK_GP_UPSERTED);

      const result = await service.findOne('gp-uuid-001');

      expect(result).toEqual(MOCK_GP_UPSERTED);
      expect(mockPrisma.grandPrix.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'gp-uuid-001' } }),
      );
    });

    it('doit retourner null si le GP est introuvable', async () => {
      mockPrisma.grandPrix.findUnique.mockResolvedValue(null);

      const result = await service.findOne('uuid-inexistant');

      expect(result).toBeNull();
    });
  });

  describe('syncFromJolpica()', () => {
    it('doit synchroniser les courses depuis l\'API Jolpica', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { MRData: { RaceTable: { Races: [MOCK_RACE_NO_TIME] } } },
      });
      mockPrisma.grandPrix.upsert.mockResolvedValue(MOCK_GP_UPSERTED);
      mockPrisma.grandPrix.findMany.mockResolvedValue([]);

      const result = await service.syncFromJolpica(2026);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
      expect(result.grandPrix).toHaveLength(1);
      expect(mockPrisma.grandPrix.upsert).toHaveBeenCalledTimes(1);
    });

    it('doit upsert avec le bon externalId (jolpica-{season}-{round})', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { MRData: { RaceTable: { Races: [MOCK_RACE_NO_TIME] } } },
      });
      mockPrisma.grandPrix.upsert.mockResolvedValue(MOCK_GP_UPSERTED);
      mockPrisma.grandPrix.findMany.mockResolvedValue([]);

      await service.syncFromJolpica(2026);

      expect(mockPrisma.grandPrix.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { externalId: 'jolpica-2026-6' },
        }),
      );
    });

    it('doit parser l\'heure de la course si le champ time est présent', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { MRData: { RaceTable: { Races: [MOCK_RACE_WITH_TIME] } } },
      });
      mockPrisma.grandPrix.upsert.mockResolvedValue({ ...MOCK_GP_UPSERTED, name: 'Canadian Grand Prix' });
      mockPrisma.grandPrix.findMany.mockResolvedValue([]);

      await service.syncFromJolpica(2026);

      const upsertCall = mockPrisma.grandPrix.upsert.mock.calls[0][0];
      const savedDate: Date = upsertCall.create.date;
      expect(savedDate.getHours()).toBe(18);
      expect(savedDate.getMinutes()).toBe(0);
    });

    it('doit supprimer les GPs orphelins sans billets', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { MRData: { RaceTable: { Races: [MOCK_RACE_NO_TIME] } } },
      });
      mockPrisma.grandPrix.upsert.mockResolvedValue(MOCK_GP_UPSERTED);
      mockPrisma.grandPrix.findMany.mockResolvedValue([
        { id: 'orphan-gp', name: 'Orphan GP', tickets: [] },
      ]);
      mockPrisma.grandPrix.delete.mockResolvedValue({});

      await service.syncFromJolpica(2026);

      expect(mockPrisma.grandPrix.delete).toHaveBeenCalledWith({ where: { id: 'orphan-gp' } });
    });

    it('doit conserver les GPs orphelins qui ont des billets associés', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { MRData: { RaceTable: { Races: [MOCK_RACE_NO_TIME] } } },
      });
      mockPrisma.grandPrix.upsert.mockResolvedValue(MOCK_GP_UPSERTED);
      mockPrisma.grandPrix.findMany.mockResolvedValue([
        { id: 'gp-with-tickets', name: 'GP With Tickets', tickets: [{ id: 'ticket-001' }] },
      ]);

      await service.syncFromJolpica(2026);

      expect(mockPrisma.grandPrix.delete).not.toHaveBeenCalled();
    });

    it('doit lever une erreur si l\'API Jolpica est inaccessible', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network Error'));

      await expect(service.syncFromJolpica(2026)).rejects.toThrow(
        'Erreur lors de la synchronisation des Grands Prix: Network Error',
      );
    });
  });
});
