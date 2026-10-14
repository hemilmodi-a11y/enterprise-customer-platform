import { describe, expect, it } from '@jest/globals';
import { model } from 'mongoose';

import { ServiceRequestStatus } from '../requests/service-request-status.enum';
import {
  ServiceRequestReadModel,
  ServiceRequestReadModelSchema,
} from './service-request-read-model.schema';

describe('ServiceRequestReadModel MongoDB schema', () => {
  const ValidationModel = model(
    'ServiceRequestReadModelValidation',
    ServiceRequestReadModelSchema,
  );

  it('validates the minimal reporting fields and excludes invalid statuses', () => {
    const valid = new ValidationModel({
      sourceRequestId: 8,
      serviceCategory: 'Support',
      status: ServiceRequestStatus.SUBMITTED,
      requestCreatedAt: new Date(),
      requestUpdatedAt: new Date(),
    });
    expect(valid.validateSync()).toBeUndefined();

    const invalid = new ValidationModel({
      sourceRequestId: 0,
      serviceCategory: '',
      status: 'Unknown',
    });
    const validationError = invalid.validateSync();
    expect(validationError?.errors.serviceCategory).toBeDefined();
    expect(validationError?.errors.status).toBeDefined();
    expect(validationError?.errors.requestCreatedAt).toBeDefined();
  });

  it('indexes unique source IDs and status/category aggregation paths', () => {
    const indexes = ServiceRequestReadModelSchema.indexes().map(
      ([fields, options]) => ({ fields, options }),
    );
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fields: { sourceRequestId: 1 },
          options: expect.objectContaining({ unique: true }),
        }),
        expect.objectContaining({
          fields: { status: 1, serviceCategory: 1 },
        }),
      ]),
    );
  });
});
