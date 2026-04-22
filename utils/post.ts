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
    const url = `${BASE_URL}/posts/${id}`;
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        "accept": "*/*",
        "Authorization": `Bearer ${token}`,
      },
    });

    const result = await response.json();
    console.log(`[DELETE API] Request: ${url}`);
    console.log(`[DELETE API] Response:`, result);
    
    // As long as the status is 200/OK, we consider it a success for the UI
    return {
      success: response.ok || response.status === 200,
      message: result.message || "Postingan berhasil dihapus.",
    };
  } catch (error) {
    console.error("Delete post error:", error);
    return {
      success: false,
      message: "Terjadi kesalahan koneksi saat menghapus postingan.",
    };
  }
};

export const getPostById = async (id: string, token: string) => {
  try {
    const response = await fetch(`${BASE_URL}/posts/${id}`, {
      method: "GET",
      headers: {
        "accept": "application/json",
        "Authorization": `Bearer ${token}`,
      },
    });

    const result = await response.json();
    return {
      success: response.ok && result.success === true,
      data: result.data,
      message: result.message,
    };
  } catch (error) {
    console.error("Get post detail error:", error);
    return {
      success: false,
      message: "Terjadi kesalahan koneksi saat mengambil detail postingan.",
    };
  }
};
export const getReportReasons = async (token: string) => {
  try {
    const response = await fetch(`${BASE_URL}/posts/report-reasons`, {
      method: "GET",
      headers: {
        "accept": "*/*",
        "Authorization": `Bearer ${token}`,
      },
    });

    const result = await response.json();
    return {
      success: response.ok && result.success === true,
      data: result.data,
      message: result.message,
    };
  } catch (error) {
    console.error("Get report reasons error:", error);
    return {
      success: false,
      message: "Terjadi kesalahan koneksi saat mengambil daftar alasan laporan.",
    };
  }
};

export interface ReportPostData {
  reason_type: string;
  reason_text?: string;
}

export const reportPost = async (id: string, data: ReportPostData, token: string) => {
  try {
    console.log(`[API] Reporting Post: ${id}`, data);
    const response = await fetch(`${BASE_URL}/posts/${id}/report`, {
      method: "POST",
      headers: {
        "accept": "*/*",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    console.log(`[API] Report Result:`, result);
    return {
      success: response.ok && result.success === true,
      message: result.message,
    };
  } catch (error) {
    console.error("Report post error:", error);
    return {
      success: false,
      message: "Terjadi kesalahan koneksi saat mengirim laporan.",
    };
  }
};
