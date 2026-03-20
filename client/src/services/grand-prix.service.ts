import apiClient from '../lib/api';

export interface GrandPrix {
  id: string;
  externalId: string;
  name: string;
  circuitName: string;
  country: string;
  date: string;
  season: number;
  imageUrl: string | null;
  tickets?: Ticket[];
}

export interface Ticket {
  id: string;
  price: number;
  section: string;
  row: string;
  seat: string;
  seller?: { firstName: string; id: string };
}

export interface CreateTicketData {
  grandPrixId: string;
  section: string;
  row: string;
  seat: string;
  price: number;
  imageUrl?: string;
}

export interface CheckoutSession {
  sessionId: string;
  url: string;
}

export interface PaymentVerification {
  success: boolean;
  ticket?: {
    id: string;
    grandPrixName: string;
    section: string;
    row: string;
    seat: string;
    imageUrl: string | null;
  };
}

export const GrandPrixService = {
  getAll: async (season: number = 2026): Promise<GrandPrix[]> => {
    const response = await apiClient.get<GrandPrix[]>('/grand-prix', {
      params: { season },
    });
    return response.data;
  },

  getById: async (id: string): Promise<GrandPrix> => {
    const response = await apiClient.get<GrandPrix>(`/grand-prix/${id}`);
    return response.data;
  },
};

export const TicketService = {
  create: async (data: CreateTicketData) => {
    const response = await apiClient.post('/tickets', data);
    return response.data;
  },
  
  getByGrandPrix: async (gpId: string) => {
    const response = await apiClient.get(`/tickets/grand-prix/${gpId}`);
    return response.data;
  },
};

export const PaymentService = {
  createCheckoutSession: async (ticketId: string, email: string): Promise<CheckoutSession> => {
    const response = await apiClient.post('/payments/create-checkout-session', { ticketId, email });
    return response.data;
  },

  verifySession: async (sessionId: string): Promise<PaymentVerification> => {
    const response = await apiClient.get(`/payments/verify-session?session_id=${sessionId}`);
    return response.data;
  },

  cancelPurchase: async (ticketId: string) => {
    const response = await apiClient.post('/payments/cancel', { ticketId });
    return response.data;
  },
};
