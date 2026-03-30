const API_BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || "Request failed");
  }
  return res.json();
}

// Datasets
export const fetchDatasets = () =>
  request<{ datasets: any[] }>("/datasets");

export const fetchSchema = (tableName: string) =>
  request<any>(`/datasets/${tableName}/schema`);

export const fetchPreview = (tableName: string, limit = 10) =>
  request<any>(`/datasets/${tableName}/preview?limit=${limit}`);

export const deleteDataset = (tableName: string) =>
  request<any>(`/datasets/${tableName}`, { method: "DELETE" });

export const uploadFile = async (file: File) => {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/upload`, { method: "POST", body: form });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || "Upload failed");
  }
  return res.json();
};

// Models
export const fetchModels = () =>
  request<{ models: any[]; active: any }>("/models");

export const setActiveModel = (provider: string, model: string) =>
  request<any>("/models/active", {
    method: "PUT",
    body: JSON.stringify({ provider, model }),
  });

// Sessions
export const fetchSessions = () =>
  request<{ sessions: any[] }>("/sessions");

export const fetchSession = (id: string) =>
  request<any>(`/sessions/${id}`);
