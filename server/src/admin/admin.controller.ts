import { Controller, Get, Delete, Param, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth('JWT-auth')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Statistiques globales (ADMIN)' })
  @ApiResponse({ status: 200, description: 'Statistiques' })
  @ApiResponse({ status: 403, description: 'Droits insuffisants' })
  async getStats() {
    const [
      totalUsers,
      totalAdmins,
      ticketsOnSale,
      ticketsSold,
      ticketsPending,
      completedTransactions,
      lastTransaction,
      topGp,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: 'USER' } }),
      this.prisma.user.count({ where: { role: 'ADMIN' } }),
      this.prisma.ticket.count({ where: { status: 'ON_SALE' } }),
      this.prisma.ticket.count({ where: { status: 'SOLD' } }),
      this.prisma.ticket.count({ where: { status: 'PENDING' } }),
      this.prisma.transaction.findMany({
        where: { status: 'COMPLETED' },
        select: { total: true, amount: true, createdAt: true },
      }),
      this.prisma.transaction.findFirst({
        where: { status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        select: {
          total: true,
          createdAt: true,
          buyerEmail: true,
          ticket: {
            select: {
              section: true,
              row: true,
              seat: true,
              grandPrix: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.grandPrix.findMany({
        select: {
          name: true,
          _count: { select: { tickets: true } },
        },
        orderBy: { tickets: { _count: 'desc' } },
        take: 1,
      }),
    ]);

    const avgSold = completedTransactions.length
      ? completedTransactions.reduce((sum, t) => sum + Number(t.amount), 0) / completedTransactions.length
      : null;

    const totalRevenue = completedTransactions.reduce((sum, t) => sum + Number(t.total), 0);

    const onSalePrices = await this.prisma.ticket.findMany({
      where: { status: 'ON_SALE' },
      select: { price: true },
    });
    const avgOnSale = onSalePrices.length
      ? onSalePrices.reduce((sum, t) => sum + Number(t.price), 0) / onSalePrices.length
      : null;

    const maxOnSale = onSalePrices.length
      ? Math.max(...onSalePrices.map((t) => Number(t.price)))
      : null;
    const minOnSale = onSalePrices.length
      ? Math.min(...onSalePrices.map((t) => Number(t.price)))
      : null;

    return {
      totalUsers,
      totalAdmins,
      ticketsOnSale,
      ticketsSold,
      ticketsPending,
      avgOnSalePrice: avgOnSale ? Number(avgOnSale.toFixed(2)) : null,
      minOnSalePrice: minOnSale ? Number(minOnSale.toFixed(2)) : null,
      maxOnSalePrice: maxOnSale ? Number(maxOnSale.toFixed(2)) : null,
      avgSoldPrice: avgSold ? Number(avgSold.toFixed(2)) : null,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalSales: completedTransactions.length,
      lastSale: lastTransaction
        ? {
            date: lastTransaction.createdAt,
            total: Number(lastTransaction.total),
            buyerEmail: lastTransaction.buyerEmail,
            gpName: lastTransaction.ticket.grandPrix.name,
            section: lastTransaction.ticket.section,
            row: lastTransaction.ticket.row,
            seat: lastTransaction.ticket.seat,
          }
        : null,
      topGp: topGp[0] ? { name: topGp[0].name, count: topGp[0]._count.tickets } : null,
    };
  }

  @Get('users')
  @ApiOperation({ summary: 'Liste tous les utilisateurs (ADMIN)' })
  @ApiResponse({ status: 200, description: 'Liste des users' })
  @ApiResponse({ status: 403, description: 'Droits insuffisants' })
  async getUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
      },
    });
    return { users };
  }

  @Get('tickets')
  @ApiOperation({ summary: 'Liste tous les billets (ADMIN)' })
  @ApiResponse({ status: 200, description: 'Liste des tickets' })
  @ApiResponse({ status: 403, description: 'Droits insuffisants' })
  async getTickets() {
    const tickets = await this.prisma.ticket.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        grandPrix: { select: { name: true, circuitName: true, date: true } },
        seller: { select: { email: true, firstName: true, lastName: true } },
      },
    });
    return { tickets };
  }

  @Delete('tickets/:id')
  @ApiOperation({ summary: 'Supprimer un billet (ADMIN)' })
  @ApiParam({ name: 'id', description: 'UUID du ticket' })
  @ApiResponse({ status: 200, description: 'Ticket supprimé' })
  @ApiResponse({ status: 403, description: 'Droits insuffisants' })
  @ApiResponse({ status: 404, description: 'Ticket non trouvé' })
  async deleteTicket(@Param('id') id: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      throw new NotFoundException('Ticket non trouvé');
    }
    await this.prisma.transaction.deleteMany({ where: { ticketId: id } });
    await this.prisma.ticket.delete({ where: { id } });
    return { message: 'Ticket supprimé', deleted: true };
  }
}
