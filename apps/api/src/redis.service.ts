import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { config } from './config.js';

/** One Redis connection. Every key starts with REDIS_PREFIX, so OpenLet can share a Redis server. */
@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client = new Redis(config().REDIS_URL, { maxRetriesPerRequest: null, keyPrefix: `${config().REDIS_PREFIX}:` });

  /** A plain connection (no key prefix) for BullMQ, which applies its own prefix. */
  connection() {
    return new Redis(config().REDIS_URL, { maxRetriesPerRequest: null });
  }

  async cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
    const hit = await this.client.get(`cache:${key}`);
    if (hit) return JSON.parse(hit) as T;
    const value = await load();
    await this.client.set(`cache:${key}`, JSON.stringify(value), 'EX', ttlSeconds);
    return value;
  }

  /** Drops cached values for a workspace after a write (dashboard, reports). */
  async invalidate(workspaceId: string) {
    await this.client.del(`cache:dashboard:${workspaceId}`);
  }

  async onModuleDestroy() {
    this.client.disconnect();
  }
}
