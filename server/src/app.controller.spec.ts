/**
 * TESTS UNITAIRES — AppController (stub corrigé)
 *
 * Cause de l'échec d'origine :
 *   AppController dépend de AppService ET PrismaService (pour les routes /profile).
 *   Le stub ne fournissait que AppService → NestJS ne pouvait pas résoudre PrismaService.
 *
 * Correctif : mocker les deux dépendances.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

// ─── Données fictives ─────────────────────────────────────────────────────────

const USER_ID  = 'user-uuid-0001';
const GP_DATE  = new Date('2026-05-24');

const MOCK_DB_USER = {
  id: USER_ID, email: 'max@rerace.io', firstName: 'Max', lastName: 'Verstappen', role: 'USER',
};

const MOCK_TICKET = {
  id: 'ticket-uuid-001', section: 'K', row: '4', seat: '12', price: 200,
  imageUrl: null, grandPrixId: 'gp-uuid-001',
  grandPrix: { name: 'Monaco GP', circuitName: 'Circuit de Monaco', date: GP_DATE },
};

const MOCK_TRANSACTION = {
  id: 'tx-uuid-001', status: 'COMPLETED', createdAt: new Date(),
  buyerValidation: 'PENDING', validatedAt: null,
  ticket: MOCK_TICKET,
};

// ─── Mock Prisma ─────────────────────────────────────────────────────────────

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update:     jest.fn(),
    delete:     jest.fn(),
  },
  ticket: {
    count:   jest.fn(),
    findMany: jest.fn(),
  },
  transaction: {
    findMany:   jest.fn(),
    updateMany: jest.fn(),
  },
  auditLog: {
    deleteMany: jest.fn(),
  },
};

// ─── Suite de tests ───────────────────────────────────────────────────────────

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    appController = module.get<AppController>(AppController);
    jest.clearAllMocks();
  });

  it('✅ le contrôleur doit être instancié correctement', () => {
    expect(appController).toBeDefined();
  });

  // ─── GET / ────────────────────────────────────────────────────────────────

  describe('GET / — health check', () => {
    it('✅ doit retourner "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  // ─── GET /profile ─────────────────────────────────────────────────────────

  describe('getProfile()', () => {
    it('✅ doit retourner le profil de l\'utilisateur connecté', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(MOCK_DB_USER);

      const result = await appController.getProfile({ id: USER_ID });

      expect(result).toEqual({ user: MOCK_DB_USER });
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: USER_ID } }),
      );
    });

    it('✅ doit retourner { user: null } si l\'utilisateur n\'existe pas en BDD', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await appController.getProfile({ id: USER_ID });

      expect(result).toEqual({ user: null });
    });
  });

  // ─── PATCH /profile ───────────────────────────────────────────────────────

  describe('updateProfile()', () => {
    it('✅ doit mettre à jour prénom et nom', async () => {
      const updated = { ...MOCK_DB_USER, firstName: 'Lewis', lastName: 'Hamilton' };
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await appController.updateProfile(
        { id: USER_ID },
        { firstName: 'Lewis', lastName: 'Hamilton' },
      );

      expect(result).toEqual({ user: updated });
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: USER_ID },
          data:  { firstName: 'Lewis', lastName: 'Hamilton' },
        }),
      );
    });

    it('✅ doit ne mettre à jour que les champs fournis (firstName seul)', async () => {
      const updated = { ...MOCK_DB_USER, firstName: 'Lewis' };
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await appController.updateProfile(
        { id: USER_ID },
        { firstName: 'Lewis' },
      );

      expect(result).toEqual({ user: updated });
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { firstName: 'Lewis' } }),
      );
    });
  });

  // ─── GET /profile/purchases ───────────────────────────────────────────────

  describe('getPurchases()', () => {
    it('✅ doit retourner l\'historique des achats de l\'utilisateur', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([MOCK_TRANSACTION]);

      const result = await appController.getPurchases({ id: USER_ID });

      expect(result).toEqual({ purchases: [MOCK_TRANSACTION] });
      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { buyerId: USER_ID, status: 'COMPLETED' } }),
      );
    });

    it('✅ doit retourner un tableau vide si aucun achat', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);

      const result = await appController.getPurchases({ id: USER_ID });

      expect(result).toEqual({ purchases: [] });
    });
  });

  // ─── GET /profile/listings ────────────────────────────────────────────────

  describe('getListings()', () => {
    it('✅ doit retourner les billets mis en vente et vendus par l\'utilisateur', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue([MOCK_TICKET]);

      const result = await appController.getListings({ id: USER_ID });

      expect(result).toEqual({ listings: [MOCK_TICKET] });
      expect(mockPrisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sellerId: USER_ID, status: { in: ['ON_SALE', 'SOLD'] } },
        }),
      );
    });

    it('✅ doit retourner un tableau vide si aucun billet mis en vente', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue([]);

      const result = await appController.getListings({ id: USER_ID });

      expect(result).toEqual({ listings: [] });
    });
  });

  // ─── DELETE /profile ──────────────────────────────────────────────────────

  describe('deleteAccount()', () => {
    it('✅ doit supprimer le compte si l\'utilisateur n\'a pas de billets en vente', async () => {
      mockPrisma.ticket.count.mockResolvedValue(0);
      mockPrisma.transaction.updateMany.mockResolvedValue({});
      mockPrisma.auditLog.deleteMany.mockResolvedValue({});
      mockPrisma.user.delete.mockResolvedValue({});

      const result = await appController.deleteAccount({ id: USER_ID });

      expect(result).toEqual({ message: 'Compte supprimé' });
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: USER_ID } });
    });

    it('❌ doit lever BadRequestException si l\'utilisateur a des billets en vente', async () => {
      mockPrisma.ticket.count.mockResolvedValue(3);

      await expect(
        appController.deleteAccount({ id: USER_ID }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        appController.deleteAccount({ id: USER_ID }),
      ).rejects.toThrow('Impossible de supprimer le compte');
    });

    it('✅ doit anonymiser les transactions avant de supprimer le compte', async () => {
      mockPrisma.ticket.count.mockResolvedValue(0);
      mockPrisma.transaction.updateMany.mockResolvedValue({});
      mockPrisma.auditLog.deleteMany.mockResolvedValue({});
      mockPrisma.user.delete.mockResolvedValue({});

      await appController.deleteAccount({ id: USER_ID });

      expect(mockPrisma.transaction.updateMany).toHaveBeenCalledWith({
        where: { buyerId: USER_ID },
        data:  { buyerId: null },
      });
    });
  });
});
