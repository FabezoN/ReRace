import apiClient from '../lib/api';

export interface AdminDispute {
  id: string;
  status: 'OPEN' | 'RESOLVED';
  stripeRefundId: string | null;
  resolvedAt: string | null;
  createdAt: string;
  transaction: {
    id: string;
    total: string;
    buyerEmail: string;
    buyer: { email: string; firstName: string; lastName: string } | null;
    ticket: {
      section: string;
      row: string;
      seat: string;
      grandPrix: { name: string; date: string };
      seller: { email: string; firstName: string; lastName: string };
    };
  };
}

export interface AdminStats {
  totalUsers: number;
  totalAdmins: number;
  ticketsOnSale: number;
  ticketsSold: number;
  ticketsPending: number;
  avgOnSalePrice: number | null;
  minOnSalePrice: number | null;
  maxOnSalePrice: number | null;
  avgSoldPrice: number | null;
  totalRevenue: number;
  totalSales: number;
  lastSale: {
    date: string;
    total: number;
    buyerEmail: string;
    gpName: string;
    section: string;
    row: string;
    seat: string;
  } | null;
  topGp: { name: string; count: number } | null;
}

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  createdAt: string;
}

export interface AdminTicket {
  id: string;
  section: string;
  row: string;
  seat: string;
  price: string;
  status: string;
  imageUrl: string | null;
  createdAt: string;
  grandPrix: { name: string; circuitName: string; date: string };
  seller: { email: string; firstName: string; lastName: string };
}

export const AdminService = {
  getStats: async (): Promise<AdminStats> => {
    const response = await apiClient.get<AdminStats>('/admin/stats');
    return response.data;
  },

  getUsers: async (): Promise<{ users: AdminUser[] }> => {
    const response = await apiClient.get<{ users: AdminUser[] }>('/admin/users');
    return response.data;
  },

  getTickets: async (): Promise<{ tickets: AdminTicket[] }> => {
    const response = await apiClient.get<{ tickets: AdminTicket[] }>('/admin/tickets');
    return response.data;
  },

  deleteTicket: async (id: string): Promise<{ message: string; deleted: boolean }> => {
    const response = await apiClient.delete<{ message: string; deleted: boolean }>(`/admin/tickets/${id}`);
    return response.data;
  },

  getDisputes: async (): Promise<{ disputes: AdminDispute[] }> => {
    const response = await apiClient.get<{ disputes: AdminDispute[] }>('/admin/disputes');
    return response.data;
  },

  resolveDispute: async (id: string): Promise<{ dispute: AdminDispute }> => {
    const response = await apiClient.patch<{ dispute: AdminDispute }>(`/admin/disputes/${id}/resolve`);
    return response.data;
  },
};
