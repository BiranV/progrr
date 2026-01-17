import { useQuery } from "@tanstack/react-query";

type OnboardingResponse = {
    onboardingCompleted?: boolean;
    onboarding?: any;
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

export const ONBOARDING_QUERY_KEY = ["onboarding"] as const;

export function useOnboardingSettings() {
    return useQuery({
        queryKey: ONBOARDING_QUERY_KEY,
        queryFn: () => apiFetch<OnboardingResponse>("/api/onboarding"),
        staleTime: 2 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnMount: true,
        refetchOnReconnect: true,
    });
}
