import { NextResponse } from "next/server";
import { requireAppUser } from "@/server/auth";

export async function GET() {
  try {
    const user = await requireAppUser();
    return NextResponse.json(user);
  } catch (error: any) {
    console.error("API /me error:", error);
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      {
        error: status === 401 ? "Unauthorized" : "Internal Server Error",
        detail: error?.message || String(error),
        code: error?.code,
        stack:
          process.env.NODE_ENV === "development" ? error?.stack : undefined,
      },
      { status }
    );
  }
}
