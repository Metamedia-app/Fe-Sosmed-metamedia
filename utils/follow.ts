import { BASE_URL } from './api';

export interface FollowUser {
  _id: string;
  nim: string;
  nama: string;
  avatar_url?: string;
  follow_date?: string;
}

export const followUser = async (userId: string, token: string) => {
  try {
    const response = await fetch(`${BASE_URL}/${userId}/follow`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });
    return await response.json();
  } catch (error) {
    console.error('Follow error:', error);
    return { success: false, message: 'Terjadi kesalahan koneksi' };
  }
};

export const unfollowUser = async (userId: string, token: string) => {
  try {
    const response = await fetch(`${BASE_URL}/${userId}/unfollow`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });
    return await response.json();
  } catch (error) {
    console.error('Unfollow error:', error);
    return { success: false, message: 'Terjadi kesalahan koneksi' };
  }
};

export const getFollowers = async (userId: string, token: string) => {
  try {
    const response = await fetch(`${BASE_URL}/${userId}/followers`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });
    return await response.json();
  } catch (error) {
    console.error('Get followers error:', error);
    return { success: false, message: 'Terjadi kesalahan koneksi' };
  }
};

export const getFollowing = async (userId: string, token: string) => {
  try {
    const response = await fetch(`${BASE_URL}/${userId}/following`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });
    return await response.json();
  } catch (error) {
    console.error('Get following error:', error);
    return { success: false, message: 'Terjadi kesalahan koneksi' };
  }
};

export const getOtherUserProfile = async (userId: string, token: string) => {
  try {
    // Attempting to fetch user profile. 
    // If /users/:id doesn't exist, we might need to adjust based on backend.
    const response = await fetch(`${BASE_URL}/${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });
    return await response.json();
  } catch (error) {
    console.error('Get user profile error:', error);
    return { success: false, message: 'Terjadi kesalahan koneksi' };
  }
};
