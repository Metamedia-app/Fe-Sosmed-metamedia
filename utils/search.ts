import { BASE_URL } from './api';

export interface SearchUser {
  _id: string;
  nim: string;
  nama: string;
  program_studi: string;
  avatar?: string;
}

export interface SearchResponse {
  success: boolean;
  data: {
    users: SearchUser[];
    total: number;
    has_more: boolean;
  };
}

export const searchUsers = async (
  query: string,
  token: string,
  limit: number = 20,
  skip: number = 0
): Promise<SearchResponse> => {
  try {
    const response = await fetch(
      `${BASE_URL}/search?q=${encodeURIComponent(query)}&limit=${limit}&skip=${skip}`,
      {
        method: 'GET',
        headers: {
          'accept': '*/*',
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Search request failed');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Search error:', error);
    return {
      success: false,
      data: {
        users: [],
        total: 0,
        has_more: false,
      },
    };
  }
};
