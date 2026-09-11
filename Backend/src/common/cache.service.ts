import { Injectable } from '@nestjs/common';

/**
 * Namespaced, in-memory TTL cache with LRU-based size bounding and
 * single-flight (cache-stampede) protection.
 *
 * Purely additive infrastructure for read-heavy, PUBLIC endpoints. It never
 * touches the pricing engine or any order/checkout path (money is computed
 * server-side on every request). To make content changes visible immediately,
 * callers `bump(namespace)` after a write — this increments the namespace
 * version so all prior entries become unreachable without clearing every key
 * (lazy invalidation).
 *
 * Tuning (optional env overrides, safe defaults):
 *   CACHE_MAX_ENTRIES         default 500
 *   CACHE_DEFAULT_TTL_SECONDS default 60
 */
@Injectable()
export class CacheService {
  private readonly store = new Map<string, { value: unknown; expiresAt: number; lastAccess: number }>();
  private readonly versions = new Map<string, number>();
  private readonly inflight = new Map<string, Promise<unknown>>();
  private readonly maxEntries: number;
  private readonly defaultTtlSeconds: number;

  constructor() {
    this.maxEntries = parseInt(process.env.CACHE_MAX_ENTRIES ?? '500', 10) || 500;
    this.defaultTtlSeconds = parseInt(process.env.CACHE_DEFAULT_TTL_SECONDS ?? '60', 10) || 60;
  }

  private currentVersion(namespace: string): number {
    return this.versions.get(namespace) ?? 0;
  }

  private physicalKey(namespace: string, key: string): string {
    return `${namespace}\u0000${this.currentVersion(namespace)}\u0000${key}`;
  }

  /** Invalidate every entry in a namespace (bump its version). */
  bump(namespace: string): void {
    this.versions.set(namespace, this.currentVersion(namespace) + 1);
  }

  /** Drop everything (used by tests / admin maintenance). */
  clear(): void {
    this.store.clear();
    this.versions.clear();
    this.inflight.clear();
  }

  /** Return a cached value without loading, if present and fresh. */
  get<T>(namespace: string, key: string): T | undefined {
    const physical = this.physicalKey(namespace, key);
    const entry = this.store.get(physical);
    if (!entry || entry.expiresAt <= Date.now()) {
      if (entry) this.store.delete(physical);
      return undefined;
    }
    entry.lastAccess = Date.now();
    return entry.value as T;
  }

  /**
   * Return the cached value for (namespace,key) or compute it via `loader`,
   * cache it, and return it. Concurrent calls for the same key share a single
   * in-flight promise (cache stampede protection). Loader errors propagate and
   * are never cached.
   */
  async getOrSet<T>(namespace: string, key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const physical = this.physicalKey(namespace, key);
    const now = Date.now();
    const hit = this.store.get(physical);
    if (hit && hit.expiresAt > now) {
      hit.lastAccess = now;
      return hit.value as T;
    }
    if (hit) this.store.delete(physical);

    // A concurrent request already started loading this exact key — join it.
    const pending = this.inflight.get(physical);
    if (pending) return pending as Promise<T>;

    const task = this.load(physical, ttlSeconds, loader);
    this.inflight.set(physical, task);
    try {
      return await task;
    } finally {
      if (this.inflight.get(physical) === task) this.inflight.delete(physical);
    }
  }

  private async load<T>(physical: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const value = await loader();
    this.store.set(physical, {
      value,
      expiresAt: Date.now() + (ttlSeconds ?? this.defaultTtlSeconds) * 1000,
      lastAccess: Date.now(),
    });
    this.evictIfNeeded();
    return value;
  }

  private evictIfNeeded(): void {
    if (this.store.size <= this.maxEntries) return;
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) this.store.delete(key);
    }
    while (this.store.size > this.maxEntries) {
      let oldestKey: string | null = null;
      let oldest = Number.MAX_SAFE_INTEGER;
      for (const [key, entry] of this.store) {
        if (entry.lastAccess < oldest) {
          oldest = entry.lastAccess;
          oldestKey = key;
        }
      }
      if (!oldestKey) break;
      this.store.delete(oldestKey);
    }
  }
}