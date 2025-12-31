async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!res.ok) {
    // Interceptor: If the server says "Unauthorized", force logout immediately.
    // BUT: Don't do this if we are just checking "am I logged in?" (/api/me)
    // because that endpoint is EXPECTED to return 401 for guests.
    if (res.status === 401 && !path.includes("/api/me")) {
      if (typeof window !== "undefined") {
        // Also avoid redirect loops if we are already on the home page
        if (window.location.pathname !== "/") {
          window.location.href =
            "/?authError=Session expired. Please log in again.";
        }
      }
    }

    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return (await res.json()) as T;
}

class ApiEntity {
  private entityName: string;

  constructor(entityName: string) {
    this.entityName = entityName;
  }

  async list(sort?: string) {
    const params = new URLSearchParams();
    if (sort) {
      // existing code passes "-created_date" etc.
      params.set("sort", sort);
    }
    const qs = params.toString();
    return apiFetch<any[]>(
      `/api/entities/${this.entityName}${qs ? `?${qs}` : ""}`
    );
  }

  async get(id: string) {
    return apiFetch<any>(`/api/entities/${this.entityName}/${id}`);
  }

  async create(data: any) {
    return apiFetch<any>(`/api/entities/${this.entityName}`, {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    });
  }

  async update(id: string, data: any) {
    return apiFetch<any>(`/api/entities/${this.entityName}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data ?? {}),
    });
  }

  async delete(id: string) {
    await apiFetch<{ ok: true }>(`/api/entities/${this.entityName}/${id}`, {
      method: "DELETE",
    });
  }

  async filter(criteria: any) {
    return apiFetch<any[]>(`/api/entities/${this.entityName}/filter`, {
      method: "POST",
      body: JSON.stringify(criteria ?? {}),
    });
  }
}

const entitiesHandler = {
  get: function (target: any, prop: string) {
    if (!target[prop]) {
      target[prop] = new ApiEntity(prop);
    }
    return target[prop];
  },
};

export const db = {
  // Auth is handled via Supabase + /api/me; keep stub so existing imports compile.
  auth: {
    me: async () => apiFetch<any>("/api/me"),
    login: async () => {
      window.location.href = "/";
    },
    register: async () => {
      window.location.href = "/";
    },
    logout: async () => {
      window.location.href = "/api/auth/logout";
    },
    isAuthenticated: async () => {
      try {
        await apiFetch<any>("/api/me");
        return true;
      } catch {
        return false;
      }
    },
  },
  entities: new Proxy({}, entitiesHandler) as any,
  appLogs: {
    logUserInApp: async (_pageName: string) => true,
  },
};
