import { Injectable } from '@nestjs/common';

/**
 * Lightweight in-process event bus feeding the /admin/live WebSocket gateway.
 * Swap for Redis pub/sub when scaling to multiple instances (BullMQ phase).
 */
@Injectable()
export class LiveEventsService {
  private listeners = new Set<(event: string, payload: unknown) => void>();

  emit(event: string, payload: unknown) {
    for (const fn of this.listeners) fn(event, payload);
  }

  subscribe(fn: (event: string, payload: unknown) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
}
