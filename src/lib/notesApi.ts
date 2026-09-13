export type NotePayload = {
  title: string;
  content: string;
  tags?: string[];
  patientId?: string;
  categoryId?: string;
  pin?: string;
  isPinned?: boolean;
  assignedTo?: string[];
  status?: string;
};

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  // ❌ Cache buster (bustUrl) aur 'no-store' ko remove kar diya gaya hai
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      // Frontend se cache bypass headers hata diye gaye hain
      ...init?.headers,
    },
  });

  const data = await res.json().catch(() => ({
    success: false,
    error: res.status === 404
      ? "Server API missing - latest code is not deployed on live yet"
      : `Request failed (${res.status})`,
  }));

  if (res.status === 404) {
    return {
      success: false,
      error: "Server API missing - latest code is not deployed on live yet",
      notes: [],
    } as T;
  }

  if (typeof data === "object" && data !== null && "success" in data) {
    return data as T;
  }

  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error || `Request failed (${res.status})`
    );
  }

  return data as T;
}

export async function fetchNotesApi() {
  return apiFetch<{
    success: boolean;
    notes: Array<{
      id: string;
      title: string;
      content: string;
      updatedAt: string;
      tags: string[];
      patientId?: string;
      categoryId?: string;
      isLocked?: boolean;
      pin?: string;
      isPinned?: boolean;
      assignedTo?: string[];
      createdBy?: string;
      isTrashed?: boolean;
      comments?: any[];
    }>;
    error?: string;
  }>("/api/notes");
}

export async function saveNoteApi(id: string, data: NotePayload) {
  return apiFetch<{
    success: boolean;
    note?: {
      id: string;
      title: string;
      content: string;
      updatedAt: string;
      tags: string[];
      patientId?: string;
      categoryId?: string;
      isLocked?: boolean;
      isPinned?: boolean;
      assignedTo?: string[];
      createdBy?: string;
      isTrashed?: boolean;
      comments?: any[];
    };
    error?: string;
  }>(`/api/notes/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteNoteApi(id: string) {
  return apiFetch<{ success: boolean; error?: string }>(
    `/api/notes/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}

export async function restoreNoteApi(id: string) {
  return apiFetch<{ success: boolean; error?: string }>(
    `/api/notes/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ isTrashed: false }),
    }
  );
}

export async function addCommentApi(id: string, text: string, type: string = 'text', mediaData?: string) {
  return apiFetch<{
    success: boolean;
    comment?: {
      id: string;
      username: string;
      text: string;
      type?: string;
      mediaData?: string;
      createdAt: string;
    };
    error?: string;
  }>(`/api/notes/${encodeURIComponent(id)}/comment`, {
    method: "POST",
    body: JSON.stringify({ text, type, mediaData }),
  });
}

export async function togglePinApi(id: string, isPinned: boolean) {
  return apiFetch<{ success: boolean; isPinned?: boolean; error?: string }>(
    `/api/notes/${encodeURIComponent(id)}/pin`,
    {
      method: "PATCH",
      body: JSON.stringify({ isPinned }),
    }
  );
}

export async function unlockNoteApi(id: string, pin: string) {
  return apiFetch<{
    success: boolean;
    note?: {
      id: string;
      title: string;
      content: string;
      updatedAt: string;
      tags: string[];
      patientId?: string;
      categoryId?: string;
      isLocked?: boolean;
      pin?: string;
      isPinned?: boolean;
      assignedTo?: string[];
    };
    error?: string;
  }>(`/api/notes/${encodeURIComponent(id)}/unlock`, {
    method: "POST",
    body: JSON.stringify({ pin }),
  });
}

export async function fetchCategoriesApi() {
  return apiFetch<{
    success: boolean;
    categories: Array<{ id: string; name: string }>;
    error?: string;
  }>("/api/categories");
}

export async function createCategoryApi(name: string) {
  return apiFetch<{
    success: boolean;
    category?: { id: string; name: string };
    error?: string;
  }>("/api/categories", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}
