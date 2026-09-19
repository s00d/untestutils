import type { EventHandler } from 'h3';

export function defineEventHandler<T extends EventHandler>(handler: T): T & { __is_handler__: true } {
  return Object.assign(handler, { __is_handler__: true as const });
}
