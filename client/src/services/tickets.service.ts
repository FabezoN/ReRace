import apiClient from '../lib/api';

export interface Ticket {
  id: string;
  price: number;
  seat: string;
  grandPrixName: string;
  isSold: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTicketDto {
  price: number;
  seat: string;
  grandPrixName: string;
}

export const ticketsService = {
  // Récupérer tous les billets disponibles
  async getAllTickets(): Promise<Ticket[]> {
    const response = await apiClient.get<Ticket[]>('/tickets');
    return response.data;
  },

  // Créer un nouveau billet
  async createTicket(data: CreateTicketDto): Promise<Ticket> {
    const response = await apiClient.post<Ticket>('/tickets', data);
    return response.data;
  },
};
