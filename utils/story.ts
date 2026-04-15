import { BASE_URL } from './api';

export interface StoryMedia {
  url: string;
  type: 'image' | 'video';
}

export interface StoryAuthor {
  _id: string;
  nim?: string;
  nama: string;
  avatar_url?: string;
  program_studi?: string;
}

export interface Story {
  _id: string;
  author_id: any; // Can be string or object in some responses
  content: string;
  media: StoryMedia;
  views_count: number;
  createdAt: string;
  updatedAt: string;
  author?: StoryAuthor; // Flattened author for UI components
}

export interface StoryGroup {
  user: StoryAuthor;
  items: Story[];
}

export interface StoryResponse {
  success: boolean;
  message?: string;
  data?: {
    stories: StoryGroup[];
  };
}

export interface Viewer {
  _id: string;
  nim?: string;
  nama: string;
  avatar_url?: string;
  program_studi?: string;
  viewed_at: string;
}

export interface ViewersResponse {
  success: boolean;
  data?: {
    total_views: number;
    viewers: Viewer[];
  };
}

export const storyService = {
  getStories: async (token: string): Promise<StoryResponse> => {
    const response = await fetch(`${BASE_URL}/stories`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });
    return response.json();
  },

  createStory: async (token: string, formData: FormData): Promise<{ success: boolean; message: string; data?: any }> => {
    const response = await fetch(`${BASE_URL}/stories`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
      body: formData,
    });
    return response.json();
  },

  recordView: async (token: string, storyId: string): Promise<{ success: boolean }> => {
    const response = await fetch(`${BASE_URL}/${storyId}/view`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });
    return response.json();
  },

  getViewers: async (token: string, storyId: string): Promise<ViewersResponse> => {
    const response = await fetch(`${BASE_URL}/${storyId}/viewers`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });
    return response.json();
  },
};
