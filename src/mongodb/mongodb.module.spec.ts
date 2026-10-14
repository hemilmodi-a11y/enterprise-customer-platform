import { describe, expect, it, jest } from '@jest/globals';

import { createMongoConnectionOptions } from './mongodb.module';

describe('MongoDB connection configuration', () => {
  it('uses the configured URI and does not block application startup', () => {
    const options = createMongoConnectionOptions({
      getOrThrow: jest.fn(() => 'mongodb://localhost:27017/test_database'),
    } as never);

    expect(options.uri).toBe('mongodb://localhost:27017/test_database');
    expect(options.lazyConnection).toBe(true);
    expect(options.serverSelectionTimeoutMS).toBe(5000);
  });

  it('attaches connection lifecycle handlers without throwing on failures', () => {
    const options = createMongoConnectionOptions({
      getOrThrow: jest.fn(() => 'mongodb://localhost:27017/test_database'),
    } as never);
    const listeners = new Map<string, () => void>();
    const connection = {
      on: jest.fn((event: string, listener: () => void) =>
        listeners.set(event, listener),
      ),
    };

    expect(options.connectionFactory(connection)).toBe(connection);
    expect(listeners.has('error')).toBe(true);
    expect(listeners.has('disconnected')).toBe(true);
    expect(listeners.has('connected')).toBe(true);
    expect(() => listeners.get('error')?.()).not.toThrow();
    expect(() => listeners.get('disconnected')?.()).not.toThrow();
  });
});
