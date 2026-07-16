/**
 * TESTS UNITAIRES — AdminController
 *
 * Couvre les 5 endpoints admin :
 *   - GET  /admin/stats
 *   - GET  /admin/users
 *   - GET  /admin/tickets
 *   - GET  /admin/disputes
 *   - PATCH /admin/disputes/:id/resolve
 *   - DELETE /admin/tickets/:id
 *
 * Les guards JwtAuthGuard et RolesGuard sont bypassés (tests unitaires).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

// ─── Données fictives ─────────────────────────────────────────────────────────

const ADMIN_ID   = 'admin-uuid-0001';
const TICKET_ID  = 'ticket-uuid-0002';
const DISPUTE_ID = 'dispute-uuid-0003';

const MOCK_GP = { name: 'Monaco GP', circuitName: 'Circuit de Monaco', date: new Date('2026-05-24') };
const MOCK_SELLER = { email: 'seller@rerace.io', firstName: 'Charles', lastName: 'Leclerc' };
const MOCK_BUYER  = { email: 'buyer@rerace.io',  firstName: 'Max',     lastName: 'Verstappen' };

// ─── Mock Prisma ─────────────────────────────────────────────────────────────

const mockPrisma = {
  user: {
    count:    jest.fn(),
    findMany: jest.fn(),
  },
  ticket: {
    count:    jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    delete:   jest.fn(),
  },
  transaction: {
    findMany:    jest.fn(),
    findFirst:   jest.fn(),
    deleteMany:  jest.fn(),
  },
  grandPrix: {
    findMany: jest.fn(),
  },
  dispute: {
    findMany:   jest.fn(),
    findUnique: jest.fn(),
    update:     jest.fn(),
  },
};

// ─── Suite de tests ───────────────────────────────────────────────────────────

describe('AdminController', () => {
  let controller: AdminController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminController>(AdminController);
    jest.clearAllMocks();
  });

  it('✅ le contrôleur doit être instancié correctement', () => {
    expect(controller).toBeDefined();
  });

  // ─── getStats() ───────────────────────────────────────────────────────────

  describe('getStats()', () => {
    it('✅ doit retourner les statistiques complètes avec données', async () => {
      mockPrisma.user.count
        .mockResolvedValueOnce(42)   // totalUsers
        .mockResolvedValueOnce(2);   // totalAdmins
      mockPrisma.ticket.count
        .mockResolvedValueOnce(10)   // ticketsOnSale
        .mockResolvedValueOnce(20)   // ticketsSold
        .mockResolvedValueOnce(3);   // ticketsPending
      mockPrisma.transaction.findMany.mockResolvedValue([
        { total: 210, amount: 200, createdAt: new Date() },
        { total: 315, amount: 300, createdAt: new Date() },
      ]);
      mockPrisma.transaction.findFirst.mockResolvedValue({
        total:     210,
        createdAt: new Date(),
        buyerEmail: MOCK_BUYER.email,
        ticket: { section: 'A', row: '1', seat: '12', grandPrix: { name: 'Monaco GP' } },
      });
      mockPrisma.grandPrix.findMany.mockResolvedValue([
        { name: 'Monaco GP', _count: { tickets: 15 } },
      ]);
      mockPrisma.ticket.findMany.mockResolvedValue([
        { price: 200 },
        { price: 400 },
      ]);

      const result = await controller.getStats();

      expect(result.totalUsers).toBe(42);
      expect(result.totalAdmins).toBe(2);
      expect(result.ticketsOnSale).toBe(10);
      expect(result.totalSales).toBe(2);
      expect(result.totalRevenue).toBe(525);
      expect(result.avgSoldPrice).toBe(250);
      expect(result.avgOnSalePrice).toBe(300);
      expect(result.minOnSalePrice).toBe(200);
      expect(result.maxOnSalePrice).toBe(400);
      expect(result.topGp).toEqual({ name: 'Monaco GP', count: 15 });
      expect(result.lastSale).toMatchObject({ buyerEmail: MOCK_BUYER.email });
    });

    it('✅ doit retourner des nulls si aucune donnée en base', async () => {
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.ticket.count.mockResolvedValue(0);
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.transaction.findFirst.mockResolvedValue(null);
      mockPrisma.grandPrix.findMany.mockResolvedValue([]);
      mockPrisma.ticket.findMany.mockResolvedValue([]);

      const result = await controller.getStats();

      expect(result.avgOnSalePrice).toBeNull();
      expect(result.avgSoldPrice).toBeNull();
      expect(result.minOnSalePrice).toBeNull();
      expect(result.maxOnSalePrice).toBeNull();
      expect(result.lastSale).toBeNull();
      expect(result.topGp).toBeNull();
      expect(result.totalRevenue).toBe(0);
      expect(result.totalSales).toBe(0);
    });
  });

  // ─── getUsers() ───────────────────────────────────────────────────────────

  describe('getUsers()', () => {
    it('✅ doit retourner la liste des utilisateurs triée par date de création', async () => {
      const mockUsers = [
        { id: 'u1', email: 'a@test.io', firstName: 'Alice', lastName: 'A', role: 'USER',  createdAt: new Date() },
        { id: 'u2', email: 'b@test.io', firstName: 'Bob',   lastName: 'B', role: 'ADMIN', createdAt: new Date() },
      ];
      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await controller.getUsers();

      expect(result).toEqual({ users: mockUsers });
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });

    it('✅ doit retourner un tableau vide si aucun utilisateur', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await controller.getUsers();

      expect(result).toEqual({ users: [] });
    });
  });

  // ─── getTickets() ─────────────────────────────────────────────────────────

  describe('getTickets()', () => {
    it('✅ doit retourner tous les billets avec Grand Prix et vendeur', async () => {
      const mockTickets = [
        {
          id: TICKET_ID,
          section: 'K',
          row: '4',
          seat: '12',
          status: 'ON_SALE',
          grandPrix: MOCK_GP,
          seller:    MOCK_SELLER,
        },
      ];
      mockPrisma.ticket.findMany.mockResolvedValue(mockTickets);

      const result = await controller.getTickets();

      expect(result).toEqual({ tickets: mockTickets });
      expect(mockPrisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });
  });

  // ─── getDisputes() ────────────────────────────────────────────────────────

  describe('getDisputes()', () => {
    it('✅ doit retourner la liste des signalements avec détails imbriqués', async () => {
      const mockDisputes = [
        {
          id:        DISPUTE_ID,
          status:    'OPEN',
          createdAt: new Date(),
          transaction: {
            buyer:  MOCK_BUYER,
            ticket: { grandPrix: MOCK_GP, seller: MOCK_SELLER },
          },
        },
      ];
      mockPrisma.dispute.findMany.mockResolvedValue(mockDisputes);

      const result = await controller.getDisputes();

      expect(result).toEqual({ disputes: mockDisputes });
      expect(mockPrisma.dispute.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });

    it('✅ doit retourner un tableau vide si aucun signalement', async () => {
      mockPrisma.dispute.findMany.mockResolvedValue([]);

      const result = await controller.getDisputes();

      expect(result).toEqual({ disputes: [] });
    });
  });

  // ─── resolveDispute() ─────────────────────────────────────────────────────

  describe('resolveDispute()', () => {
    it('✅ doit résoudre un litige et enregistrer l\'admin résolvant', async () => {
      const mockDispute = { id: DISPUTE_ID, status: 'OPEN' };
      const mockResolved = { ...mockDispute, status: 'RESOLVED', resolvedAt: new Date(), resolvedById: ADMIN_ID };
      mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);
      mockPrisma.dispute.update.mockResolvedValue(mockResolved);

      const req = { user: { id: ADMIN_ID } };
      const result = await controller.resolveDispute(DISPUTE_ID, req);

      expect(result).toEqual({ dispute: mockResolved });
      expect(mockPrisma.dispute.update).toHaveBeenCalledWith({
        where: { id: DISPUTE_ID },
        data:  expect.objectContaining({ status: 'RESOLVED', resolvedById: ADMIN_ID }),
      });
    });

    it('❌ doit lever NotFoundException si le litige n\'existe pas', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue(null);

      await expect(
        controller.resolveDispute('uuid-inexistant', { user: { id: ADMIN_ID } }),
      ).rejects.toThrow(NotFoundException);

      await expect(
        controller.resolveDispute('uuid-inexistant', { user: { id: ADMIN_ID } }),
      ).rejects.toThrow('Litige non trouve');
    });
  });

  // ─── deleteTicket() ───────────────────────────────────────────────────────

  describe('deleteTicket()', () => {
    it('✅ doit supprimer le billet et ses transactions liées', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({ id: TICKET_ID });
      mockPrisma.transaction.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.ticket.delete.mockResolvedValue({ id: TICKET_ID });

      const result = await controller.deleteTicket(TICKET_ID);

      expect(result).toEqual({ message: 'Ticket supprimé', deleted: true });
      expect(mockPrisma.transaction.deleteMany).toHaveBeenCalledWith({ where: { ticketId: TICKET_ID } });
      expect(mockPrisma.ticket.delete).toHaveBeenCalledWith({ where: { id: TICKET_ID } });
    });

    it('✅ doit supprimer les transactions avant le billet (intégrité référentielle)', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({ id: TICKET_ID });
      mockPrisma.transaction.deleteMany.mockResolvedValue({});
      mockPrisma.ticket.delete.mockResolvedValue({});

      await controller.deleteTicket(TICKET_ID);

      const deleteManyOrder = mockPrisma.transaction.deleteMany.mock.invocationCallOrder[0];
      const deleteOrder     = mockPrisma.ticket.delete.mock.invocationCallOrder[0];
      expect(deleteManyOrder).toBeLessThan(deleteOrder);
    });

    it('❌ doit lever NotFoundException si le billet n\'existe pas', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(null);

      await expect(
        controller.deleteTicket('uuid-inexistant'),
      ).rejects.toThrow(NotFoundException);

      await expect(
        controller.deleteTicket('uuid-inexistant'),
      ).rejects.toThrow('Ticket non trouvé');
    });
  });
});
