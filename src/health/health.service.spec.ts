import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';

import { HealthService } from './health.service';

describe('HealthService', () => {
  it('reports liveness without checking dependencies', () => {
    const dataSource = { isInitialized: false, query: jest.fn() };
    const mongoConnection = { readyState: 0 };
    const service = new HealthService(
      dataSource as never,
      mongoConnection as never,
    );

    expect(service.live()).toEqual({ status: 'ok' });
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('reports readiness when MySQL is up and marks optional MongoDB as down', async () => {
    const dataSource = {
      isInitialized: true,
      query: jest.fn().mockResolvedValue([{ 1: 1 }]),
    };
    const mongoConnection = { readyState: 0 };
    const service = new HealthService(
      dataSource as never,
      mongoConnection as never,
    );

    await expect(service.ready()).resolves.toEqual({
      status: 'ok',
      dependencies: { mysql: 'up', mongodb: 'down' },
    });
  });

  it('returns 503 readiness when MySQL is unavailable', async () => {
    const dataSource = {
      isInitialized: true,
      query: jest.fn().mockRejectedValue(new Error('database details')),
    };
    const mongoConnection = { readyState: 1 };
    const service = new HealthService(
      dataSource as never,
      mongoConnection as never,
    );

    await expect(service.ready()).rejects.toMatchObject({
      status: 503,
      response: {
        status: 'degraded',
        dependencies: { mysql: 'down', mongodb: 'up' },
      },
    } satisfies Partial<ServiceUnavailableException>);
  });
});
