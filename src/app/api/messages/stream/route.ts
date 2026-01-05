import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAppUser } from "@/server/auth";
import { collections } from "@/server/collections";
import {
  getMessageHub,
  MESSAGE_SSE_RETRY_MS,
  writeSse,
} from "@/server/realtime/messageHub";

export const runtime = "nodejs";

function sseHeaders() {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  } as Record<string, string>;
}

export async function GET(req: Request) {
  try {
    const user = await requireAppUser();

    const hub = getMessageHub();

    // Determine channel key
    let channelKey: string;

    if (user.role === "admin") {
      channelKey = `admin:${user.id}`;
    } else if (user.role === "client") {
      const adminId = new ObjectId(user.adminId);
      const c = await collections();

      const myClient = await c.entities.findOne({
        entity: "Client",
        adminId,
        $or: [{ "data.userId": user.id }, { "data.clientAuthId": user.id }],
      });

      if (!myClient) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const clientEntityId = myClient._id.toHexString();
      channelKey = `client:${adminId.toHexString()}:${clientEntityId}`;
    } else {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;
        let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;

        const unsubscribe = hub.subscribe(channelKey, (event) => {
          const data = JSON.stringify(event);
          void writeSse(controller, `event: message\n`);
          void writeSse(controller, `data: ${data}\n\n`);
        });

        const cleanup = () => {
          if (closed) return;
          closed = true;
          if (heartbeatTimer) {
            clearTimeout(heartbeatTimer);
            heartbeatTimer = null;
          }
          unsubscribe();
          try {
            controller.close();
          } catch {
            // ignore
          }
        };

        const scheduleHeartbeat = () => {
          if (closed) return;
          heartbeatTimer = setTimeout(() => {
            if (closed) return;
            // SSE comment to keep the connection alive through proxies.
            void writeSse(controller, `: ping\n\n`);
            scheduleHeartbeat();
          }, 25000);
        };

        const signal = (req as any).signal as AbortSignal | undefined;
        if (signal) {
          signal.addEventListener("abort", cleanup, { once: true });
        }

        // initial hello + retry
        void writeSse(controller, `retry: ${MESSAGE_SSE_RETRY_MS}\n`);
        void writeSse(controller, `event: ready\n`);
        void writeSse(controller, `data: {"ok":true}\n\n`);

        scheduleHeartbeat();
      },
      cancel() {
        // Cleanup primarily occurs via AbortSignal in Next's runtime.
      },
    });

    return new Response(stream, { headers: sseHeaders() });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: status === 401 ? "Unauthorized" : "Internal Server Error" },
      { status }
    );
  }
}
