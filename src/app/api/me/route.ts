import { NextResponse } from "next/server";
import { requireAppUser } from "@/server/auth";

export async function GET() {
  try {
    const user = await requireAppUser();
    return NextResponse.json(user);
  } catch (error: any) {
    console.error("API /me error:", error);
    if (error?.code === "SUPABASE_ENV_MISSING") {
      return NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 500 }
      );
    }
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      {
        error: status === 401 ? "Unauthorized" : "Internal Server Error",
        detail:
          process.env.NODE_ENV === "production" ? undefined : error?.message,
      },
      { status }
    );
  }
}
