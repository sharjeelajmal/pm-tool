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
  const separator = url.includes("?") ? "&" : "?";
  const finalUrl = init?.method && init.method !== "GET" ? url : `${url}${separator}_t=${Date.now()}`;
  const res = await fetch(finalUrl, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
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
      readBy?: string[];
      deliveredTo?: string[];
      isEdited?: boolean;
      isDeleted?: boolean;
      updatedAt?: string;
    };
    error?: string;
  }>(`/api/notes/${encodeURIComponent(id)}/comment`, {
    method: "POST",
    body: JSON.stringify({ text, type, mediaData }),
  });
}

export async function editCommentApi(id: string, commentId: string, text: string) {
  return apiFetch<{
    success: boolean;
    commentId?: string;
    text?: string;
    isEdited?: boolean;
    updatedAt?: string;
    error?: string;
  }>(`/api/notes/${encodeURIComponent(id)}/comment`, {
    method: "PUT",
    body: JSON.stringify({ commentId, text }),
  });
}

export async function deleteCommentApi(id: string, commentId: string) {
  return apiFetch<{
    success: boolean;
    commentId?: string;
    text?: string;
    isDeleted?: boolean;
    updatedAt?: string;
    error?: string;
  }>(`/api/notes/${encodeURIComponent(id)}/comment?commentId=${encodeURIComponent(commentId)}`, {
    method: "DELETE",
  });
}

export async function markCommentsAsReadApi(id: string) {
  return apiFetch<{
    success: boolean;
    username?: string;
    error?: string;
  }>(`/api/notes/${encodeURIComponent(id)}/comment`, {
    method: "PATCH",
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

export async function updateCategoryApi(id: string, name: string) {
  return apiFetch<{
    success: boolean;
    category?: { id: string; name: string };
    error?: string;
  }>(`/api/categories/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ name }),
  });
}

export async function deleteCategoryApi(id: string) {
  return apiFetch<{
    success: boolean;
    deletedNotesCount?: number;
    error?: string;
  }>(`/api/categories/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

