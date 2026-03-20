import { Injectable } from '@nestjs/common';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { PrismaService } from '../prisma/prisma.service';
import { TicketStatus } from '@prisma/client';

@Injectable()
export class TicketsService {
  constructor(private prisma: PrismaService) {}

  async create(createTicketDto: CreateTicketDto, userId: string) {
    return this.prisma.ticket.create({
      data: {
        grandPrixId: createTicketDto.grandPrixId,
        section: createTicketDto.section,
        row: createTicketDto.row,
        seat: createTicketDto.seat,
        price: createTicketDto.price,
        imageUrl: createTicketDto.imageUrl,
        sellerId: userId,
        status: TicketStatus.ON_SALE,
        currency: 'EUR',
      },
      include: {
        grandPrix: true,
        seller: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async findByGrandPrix(grandPrixId: string) {
    return this.prisma.ticket.findMany({
      where: {
        grandPrixId,
        status: TicketStatus.ON_SALE,
      },
      include: {
        seller: { select: { firstName: true, id: true } },
        grandPrix: {
          select: {
            id: true,
            name: true,
            circuitName: true,
            date: true,
          },
        },
      },
    });
  }
}
