import { useQuery } from "@tanstack/react-query";

export type Business = {
    name: string;
    phone: string;
    address: string;
    slug: string;
    description: string;
};

export type UpdateBusinessPayload = {
    name: string;
    phone: string;
    address?: string;
    description?: string;
};

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
        let message = `Request failed (${res.status})`;
        try {
            const body = await res.json();
            if (body?.error) message = body.error;
        } catch {
            // ignore
        }

        const err: any = new Error(message);
        err.status = res.status;
        throw err;
    }

    return (await res.json()) as T;
}

export function useBusiness() {
    return useQuery({
        queryKey: ["business"],
        queryFn: () => apiFetch<Business>("/api/business"),
    });
}

export async function updateBusiness(payload: UpdateBusinessPayload) {
    const body = {
        name: payload.name,
        phone: payload.phone,
        address: payload.address ?? "",
        description: payload.description ?? "",
    };

    await apiFetch<{ success: true }>("/api/business", {
        method: "PATCH",
        body: JSON.stringify(body),
    });
}
