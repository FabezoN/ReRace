/**
 * TESTS UNITAIRES — GrandPrixCronService
 *
 * Couvre les tâches planifiées critiques :
 *   - Synchronisation initiale au démarrage (onModuleInit)
 *   - Synchronisation hebdomadaire (cron dimanche 02h00)
 *   - Auto-validation des billets 7 jours après le GP (cron quotidien 03h00)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { GrandPrixCronService } from './grand-prix-cron.service';
import { GrandPrixService } from './grand-prix.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGrandPrixService = {
  syncFromJolpica: jest.fn(),
};

const mockPrisma = {
  transaction: {
    findMany:   jest.fn(),
    updateMany: jest.fn(),
  },
};

// ─── Suite de tests ───────────────────────────────────────────────────────────

describe('GrandPrixCronService', () => {
  let service: GrandPrixCronService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GrandPrixCronService,
        { provide: GrandPrixService, useValue: mockGrandPrixService },
        { provide: PrismaService,    useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<GrandPrixCronService>(GrandPrixCronService);
    jest.clearAllMocks();
  });

  it('✅ le service doit être instancié correctement', () => {
    expect(service).toBeDefined();
  });

  // ─── onModuleInit() ───────────────────────────────────────────────────────

  describe('onModuleInit()', () => {
    it('✅ doit lancer la synchronisation initiale au démarrage du serveur', async () => {
      mockGrandPrixService.syncFromJolpica.mockResolvedValue({ count: 24, grandPrix: [] });

      await service.onModuleInit();

      expect(mockGrandPrixService.syncFromJolpica).toHaveBeenCalledTimes(1);
    });

    it('✅ doit absorber silencieusement les erreurs de sync (fail-safe)', async () => {
      mockGrandPrixService.syncFromJolpica.mockRejectedValue(new Error('API Jolpica indisponible'));

      await expect(service.onModuleInit()).resolves.not.toThrow();
    });
  });

  // ─── handleWeeklySync() ───────────────────────────────────────────────────

  describe('handleWeeklySync()', () => {
    it('✅ doit lancer la synchronisation hebdomadaire', async () => {
      mockGrandPrixService.syncFromJolpica.mockResolvedValue({ count: 24, grandPrix: [] });

      await service.handleWeeklySync();

      expect(mockGrandPrixService.syncFromJolpica).toHaveBeenCalledTimes(1);
    });

    it('✅ doit absorber silencieusement les erreurs de sync hebdomadaire', async () => {
      mockGrandPrixService.syncFromJolpica.mockRejectedValue(new Error('Timeout'));

      await expect(service.handleWeeklySync()).resolves.not.toThrow();
    });
  });

  // ─── handleAutoValidation() ───────────────────────────────────────────────

  describe('handleAutoValidation()', () => {
    it('✅ doit auto-valider les transactions PENDING dont le GP est passé depuis +7 jours', async () => {
      const pendingTransactions = [{ id: 'tx-001' }, { id: 'tx-002' }, { id: 'tx-003' }];
      mockPrisma.transaction.findMany.mockResolvedValue(pendingTransactions);
      mockPrisma.transaction.updateMany.mockResolvedValue({ count: 3 });

      await service.handleAutoValidation();

      expect(mockPrisma.transaction.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['tx-001', 'tx-002', 'tx-003'] } },
          data:  expect.objectContaining({ buyerValidation: 'VALID' }),
        }),
      );
    });

    it('✅ doit ne rien faire si aucune transaction n\'est à auto-valider', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);

      await service.handleAutoValidation();

      expect(mockPrisma.transaction.updateMany).not.toHaveBeenCalled();
    });

    it('✅ doit chercher uniquement les transactions COMPLETED avec buyerValidation PENDING', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);

      await service.handleAutoValidation();

      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status:          'COMPLETED',
            buyerValidation: 'PENDING',
          }),
        }),
      );
    });
  });
});
