import { ObjectId } from "mongodb";
import { getDb } from "@/server/mongo";

export type UserDoc = {
  _id?: ObjectId;
  email: string;
  createdAt: Date;
  fullName?: string;
  phone?: string;
  onboardingCompleted?: boolean;
  onboarding?: {
    businessTypes?: string[];
    currency?: string;
    customCurrency?: {
      name?: string;
      symbol?: string;
    };
    business?: {
      name?: string;
      phone?: string;
      address?: string;
      publicId?: string;
      slug?: string;
      description?: string;
      currency?: string;
    };
    services?: Array<{
      id: string;
      name: string;
      durationMinutes: number;
      price?: number;
      description?: string;
      isActive?: boolean;
    }>;
    availability?: {
      timezone?: string;
      weekStartsOn?: 0 | 1;
      days?: Array<{
        day: number; // 0-6 (Sun-Sat)
        enabled: boolean;
        ranges?: Array<{
          start?: string; // HH:mm
          end?: string; // HH:mm
        }>;
        // Legacy (migrated to ranges)
        start?: string; // HH:mm
        end?: string; // HH:mm
      }>;
    };
    updatedAt?: Date;
  };
  onboardingCompletedAt?: Date;
};

export type AppointmentDoc = {
  _id?: ObjectId;
  businessUserId: ObjectId;
  customerId?: ObjectId;
  serviceId: string;
  serviceName: string;
  durationMinutes: number;
  price: number;
  currency: string;
  date: string; // YYYY-MM-DD (business local)
  startTime: string; // HH:mm (business local)
  endTime: string; // HH:mm (business local)
  customer: {
    id?: string;
    fullName: string;
    phone: string;
    email?: string;
  };
  notes?: string;
  status: "BOOKED" | "COMPLETED" | "NO_SHOW" | "CANCELED" | "CANCELLED";
  paymentStatus?: "UNPAID" | "PAID";
  createdBy?: "BUSINESS" | "CUSTOMER";
  createdAt: Date;
  cancelledAt?: Date;
  cancelledBy?: "BUSINESS" | "CUSTOMER";
};

export type CustomerDoc = {
  _id?: ObjectId;
  fullName: string;
  phone: string;
  email?: string;
  createdAt: Date;
  updatedAt?: Date;
  pendingEmail?: string;
  pendingEmailRequestedAt?: Date;
};

export type BusinessCustomerDoc = {
  _id?: ObjectId;
  businessUserId: ObjectId;
  customerId: ObjectId;
  status?: "ACTIVE" | "BLOCKED";
  isHidden?: boolean;
  createdAt: Date;
  lastAppointmentAt?: Date;
};

export type CustomerOtpPurpose = "booking_verify" | "profile_email_change";

export type CustomerOtpDoc = {
  _id?: ObjectId;
  key: string; // normalized email
  purpose: CustomerOtpPurpose;
  codeHash: string;
  verifyToken?: string;
  businessPublicId?: string;
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
  sentAt?: Date;
};

export type OtpPurpose = "login" | "signup";

export type OtpDoc = {
  _id?: ObjectId;
  key: string; // normalized email
  purpose: OtpPurpose;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
  sentAt?: Date;
};

export type RateLimitDoc = {
  _id?: ObjectId;
  key: string;
  count: number;
  expiresAt: Date;
  createdAt: Date;
};

export async function collections() {
  const db = await getDb();
  return {
    users: db.collection<UserDoc>("users"),
    otps: db.collection<OtpDoc>("otps"),
    customerOtps: db.collection<CustomerOtpDoc>("customer_otps"),
    appointments: db.collection<AppointmentDoc>("appointments"),
    customers: db.collection<CustomerDoc>("customers"),
    businessCustomers: db.collection<BusinessCustomerDoc>("business_customers"),
    rateLimits: db.collection<RateLimitDoc>("rate_limits"),
  };
}

export async function ensureIndexes() {
  const c = await collections();

  await c.users.createIndex({ email: 1 }, { unique: true });
  await c.users.createIndex(
    { "onboarding.business.slug": 1 },
    { unique: true, sparse: true }
  );
  await c.users.createIndex(
    { "onboarding.business.publicId": 1 },
    { unique: true, sparse: true }
  );

  await c.otps.createIndex({ key: 1, purpose: 1 }, { unique: true });
  await c.otps.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  await c.customerOtps.createIndex({ key: 1, purpose: 1 }, { unique: true });
  await c.customerOtps.createIndex(
    { verifyToken: 1, purpose: 1 },
    { unique: true, sparse: true }
  );
  await c.customerOtps.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  await c.appointments.createIndex(
    { businessUserId: 1, date: 1, startTime: 1 },
    {
      unique: true,
      partialFilterExpression: { status: "BOOKED" },
    }
  );
  await c.appointments.createIndex({ businessUserId: 1, date: 1, status: 1 });
  await c.appointments.createIndex({
    businessUserId: 1,
    "customer.id": 1,
    status: 1,
    date: 1,
    startTime: 1,
  });

  await c.appointments.createIndex({
    businessUserId: 1,
    customerId: 1,
    status: 1,
    date: 1,
    startTime: 1,
  });

  await c.customers.createIndex({ email: 1 }, { unique: true, sparse: true });
  await c.customers.createIndex({ phone: 1 }, { unique: true, sparse: true });
  await c.customers.createIndex({ createdAt: -1 });

  await c.businessCustomers.createIndex(
    { businessUserId: 1, customerId: 1 },
    { unique: true }
  );
  await c.businessCustomers.createIndex(
    { businessUserId: 1, createdAt: -1 },
    { name: "business_customers_admin_list" }
  );

  await c.rateLimits.createIndex({ key: 1 }, { unique: true });
  await c.rateLimits.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}
