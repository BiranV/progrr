import { setTimeout as sleep } from "timers/promises";

export type MessageRealtimeEvent =
  | {
      type: "message:changed";
      adminId: string;
      clientId: string;
      messageId?: string;
    }
  | {
      type: "message:deleted";
      adminId: string;
      clientId: string;
      messageId: string;
    };

type Listener = (event: MessageRealtimeEvent) => void;

class MessageHub {
  private listenersByKey = new Map<string, Set<Listener>>();

  subscribe(key: string, listener: Listener) {
    const set = this.listenersByKey.get(key) ?? new Set<Listener>();
    set.add(listener);
    this.listenersByKey.set(key, set);

    return () => {
      const current = this.listenersByKey.get(key);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) this.listenersByKey.delete(key);
    };
  }

  publish(key: string, event: MessageRealtimeEvent) {
    const listeners = this.listenersByKey.get(key);
    if (!listeners || listeners.size === 0) return;
    for (const listener of listeners) {
      try {
        listener(event);
      } catch {
        // best effort
      }
    }
  }

  /**
   * Helper for admin+client fanout.
   */
  publishMessageChanged(args: {
    adminId: string;
    clientId: string;
    messageId?: string;
  }) {
    const { adminId, clientId, messageId } = args;
    const event: MessageRealtimeEvent = {
      type: "message:changed",
      adminId,
      clientId,
      messageId,
    };

    this.publish(`admin:${adminId}`, event);
    this.publish(`client:${adminId}:${clientId}`, event);
  }
}

declare global {
  var __progrrMessageHub: MessageHub | undefined;
}

export function getMessageHub() {
  if (!globalThis.__progrrMessageHub) {
    globalThis.__progrrMessageHub = new MessageHub();
  }
  return globalThis.__progrrMessageHub;
}

export const MESSAGE_SSE_RETRY_MS = 3000;

export async function writeSse(
  controller: ReadableStreamDefaultController<Uint8Array>,
  payload: string
) {
  controller.enqueue(new TextEncoder().encode(payload));
  // allow flushing in some runtimes
  await sleep(0);
}
