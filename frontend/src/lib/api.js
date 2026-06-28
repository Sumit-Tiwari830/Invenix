export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function def_request(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    let errorMsg = `API request failed with status ${response.status}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMsg = errorJson.detail || errorMsg;
    } catch {
      if (errorText) errorMsg = errorText;
    }
    throw new ApiError(errorMsg, response.status);
  }
  
  return response;
}

export const api = {
  async get(path) {
    const res = await def_request(path);
    return res.json();
  },

  async post(path, data) {
    const res = await def_request(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async delete(path) {
    const res = await def_request(path, {
      method: "DELETE",
    });
    return res.json();
  },

  async upload(path, file) {
    const formData = new FormData();
    formData.append("file", file);

    const res = await def_request(path, {
      method: "POST",
      body: formData,
    });
    return res.json();
  },
};
