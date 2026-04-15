import { BASE_URL } from "./api";

export interface UpdatePostData {
  caption?: string;
}

export const updatePost = async (id: string, data: UpdatePostData, token: string) => {
  try {
    const response = await fetch(`${BASE_URL}/posts/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    return {
      success: response.ok && result.success === true,
      data: result.data,
      message: result.message,
    };
  } catch (error) {
    console.error("Update post error:", error);
    return {
      success: false,
      message: "Terjadi kesalahan koneksi saat memperbarui postingan.",
    };
  }
};

export const deletePost = async (id: string, token: string) => {
  try {
    const response = await fetch(`${BASE_URL}/posts/${id}`, {
      method: "DELETE",
      headers: {
        "Accept": "*/*",
        "Authorization": `Bearer ${token}`,
      },
    });

    const result = await response.json();
    console.log(`[DELETE API] ID: ${id}, Status: ${response.status}, Success: ${result.success}`);
    
    return {
      success: (response.ok || response.status === 200) && result.success === true,
      data: result.data,
      message: result.message,
    };
  } catch (error) {
    console.error("Delete post error:", error);
    return {
      success: false,
      message: "Terjadi kesalahan koneksi saat menghapus postingan.",
    };
  }
};
