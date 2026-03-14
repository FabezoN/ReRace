import apiClient from '../lib/api';

export type UserRole = 'USER' | 'ADMIN';

export interface ProfileUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface PurchaseItem {
  id: string;
  amount: string;
  total: string;
  createdAt: string;
  ticket: {
    id: string;
    section: string;
    row: string;
    seat: string;
    price: string;
    imageUrl: string | null;
    grandPrix: {
      name: string;
      circuitName: string;
      date: string;
    };
  };
}

export const ProfileService = {
  getProfile: async (): Promise<{ user: ProfileUser | null }> => {
    const response = await apiClient.get<{ user: ProfileUser | null }>('/profile');
    return response.data;
  },

  updateProfile: async (data: { firstName?: string; lastName?: string }): Promise<{ user: ProfileUser }> => {
    const response = await apiClient.patch<{ user: ProfileUser }>('/profile', data);
    return response.data;
  },

  getPurchases: async (): Promise<{ purchases: PurchaseItem[] }> => {
    const response = await apiClient.get<{ purchases: PurchaseItem[] }>('/profile/purchases');
    return response.data;
  },

  deleteAccount: async (): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>('/profile');
    return response.data;
  },
};
