export type AppUser = {
  id: string;
  email: string;
  full_name: string | null;
  phone?: string;
};

export type AppointmentStatus = "scheduled" | "cancelled" | "completed";

export type Appointment = {
  id: string;
  title: string;
  startsAt: string; // ISO string
  durationMinutes: number;
  status: AppointmentStatus;
  locationKind?: "link" | "location" | "phone";
  location?: string;
  customerName?: string;
  customerEmail?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};
