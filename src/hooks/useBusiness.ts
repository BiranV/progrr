import { useQuery } from "@tanstack/react-query";

export type Business = {
  publicId: string;
  name: string;
  phone: string;
  address: string | null;
  slug?: string;
  description: string;
  instagram?: string;
  whatsapp?: string;
  currency?: string;
  limitCustomerToOneUpcomingAppointment?: boolean;
  revenueInsightsEnabled?: boolean;
  reviewRequestsEnabled?: boolean;
  reviewDelayMinutes?: number;
  reviewRequiresPayment?: boolean;
};

export type UpdateBusinessPayload = {
  name: string;
  phone: string;
  address?: string | null;
  description?: string;
  instagram?: string;
  whatsapp?: string;
  currency?: string;
  limitCustomerToOneUpcomingAppointment?: boolean;
  revenueInsightsEnabled?: boolean;
  reviewRequestsEnabled?: boolean;
  reviewDelayMinutes?: number;
  reviewRequiresPayment?: boolean;
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
    placeholderData: (prev) => prev,
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });
}

export async function updateBusiness(payload: UpdateBusinessPayload) {
  const normalizedAddress = String(payload.address ?? "").trim();
  const body = {
    name: payload.name,
    phone: payload.phone,
    address: normalizedAddress ? normalizedAddress : null,
    description: payload.description ?? "",
    instagram: payload.instagram ?? "",
    whatsapp: payload.whatsapp ?? "",
    ...(payload.currency ? { currency: payload.currency } : {}),
    ...(typeof payload.limitCustomerToOneUpcomingAppointment === "boolean"
      ? {
          limitCustomerToOneUpcomingAppointment:
            payload.limitCustomerToOneUpcomingAppointment,
        }
      : {}),
    ...(typeof payload.revenueInsightsEnabled === "boolean"
      ? { revenueInsightsEnabled: payload.revenueInsightsEnabled }
      : {}),
    ...(typeof payload.reviewRequestsEnabled === "boolean"
      ? { reviewRequestsEnabled: payload.reviewRequestsEnabled }
      : {}),
    ...(typeof payload.reviewDelayMinutes === "number"
      ? { reviewDelayMinutes: payload.reviewDelayMinutes }
      : {}),
    ...(typeof payload.reviewRequiresPayment === "boolean"
      ? { reviewRequiresPayment: payload.reviewRequiresPayment }
      : {}),
  };

  await apiFetch<{ success: true }>("/api/business", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
