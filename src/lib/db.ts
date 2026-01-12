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
    // Interceptor: If the server says "Unauthorized" or "Forbidden", force logout immediately.
    // BUT: Don't do this if we are just checking "am I logged in?" (/api/me)
    // because that endpoint is EXPECTED to return 401 for guests (and 403 for blocked clients).
    if (
      (res.status === 401 || res.status === 403) &&
      !path.includes("/api/me")
    ) {
      if (typeof window !== "undefined") {
        // Also avoid redirect loops if we are already on the home page
        if (window.location.pathname !== "/") {
          // Cookie is httpOnly; clear it server-side then return to login.
          window.location.href = "/api/auth/logout";
        }
      }
    }

    let message = `Request failed (${res.status})`;
    let code: any = undefined;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
      code = body?.code;
    } catch {
      // ignore
    }

    const err: any = new Error(message);
    err.status = res.status;
    if (code) err.code = code;
    throw err;
  }

  return (await res.json()) as T;
}

export const db = {
  // Auth uses httpOnly JWT cookies + /api/me.
  auth: {
    me: async () => apiFetch<any>("/api/me"),
    login: async () => {
      window.location.href = "/auth";
    },
    register: async () => {
      window.location.href = "/auth";
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
};
