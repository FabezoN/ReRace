import { Controller, Get, Patch, Body, Delete, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { CurrentUser } from './auth/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('Profile')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check' })
  @ApiResponse({ status: 200, description: 'Hello World' })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Récupérer le profil de l’utilisateur connecté' })
  @ApiResponse({ status: 200, description: 'Profil (id, email, firstName, lastName, role)' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async getProfile(@CurrentUser() user: { id: string }) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });
    if (!dbUser) return { user: null };
    return { user: dbUser };
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Mettre à jour le profil (prénom, nom)' })
  @ApiResponse({ status: 200, description: 'Profil mis à jour' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiBody({ type: UpdateProfileDto })
  async updateProfile(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateProfileDto,
  ) {
    const data: { firstName?: string; lastName?: string } = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data,
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });
    return { user: updated };
  }

  @Get('profile/purchases')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Liste des achats (transactions complétées) de l’utilisateur' })
  @ApiResponse({ status: 200, description: 'Liste des achats avec ticket et Grand Prix' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async getPurchases(@CurrentUser() user: { id: string }) {
    const transactions = await this.prisma.transaction.findMany({
      where: { buyerId: user.id, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      include: {
        ticket: {
          select: {
            id: true,
            section: true,
            row: true,
            seat: true,
            price: true,
            imageUrl: true,
            grandPrixId: true,
            grandPrix: {
              select: { name: true, circuitName: true, date: true },
            },
          },
        },
      },
    });
    return { purchases: transactions };
  }

  @Get('profile/listings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Billets mis en vente et vendus par l\'utilisateur' })
  @ApiResponse({ status: 200, description: 'Billets ON_SALE et SOLD du vendeur' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async getListings(@CurrentUser() user: { id: string }) {
    const tickets = await this.prisma.ticket.findMany({
      where: {
        sellerId: user.id,
        status: { in: ['ON_SALE', 'SOLD'] },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        grandPrix: {
          select: { name: true, circuitName: true, date: true },
        },
      },
    });
    return { listings: tickets };
  }

  @Delete('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Supprimer le compte utilisateur' })
  @ApiResponse({ status: 200, description: 'Compte supprimé' })
  @ApiResponse({ status: 400, description: 'Impossible (billets en vente)' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async deleteAccount(@CurrentUser() user: { id: string }) {
    const ticketsCount = await this.prisma.ticket.count({
      where: { sellerId: user.id },
    });
    if (ticketsCount > 0) {
      throw new BadRequestException(
        'Impossible de supprimer le compte : vous avez des billets en vente. Retirez-les ou attendez qu\'ils soient vendus.',
      );
    }
    await this.prisma.transaction.updateMany({
      where: { buyerId: user.id },
      data: { buyerId: null },
    });
    await this.prisma.auditLog.deleteMany({
      where: { userId: user.id },
    });
    await this.prisma.user.delete({
      where: { id: user.id },
    });
    return { message: 'Compte supprimé' };
  }
}
