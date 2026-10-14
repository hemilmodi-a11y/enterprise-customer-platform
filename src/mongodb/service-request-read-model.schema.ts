import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import { ServiceRequestStatus } from '../requests/service-request-status.enum';

export type ServiceRequestReadModelDocument =
  HydratedDocument<ServiceRequestReadModel>;

@Schema({
  collection: 'service_requests',
  timestamps: true,
  versionKey: false,
})
export class ServiceRequestReadModel {
  @Prop({ type: Number, required: true, min: 1, unique: true })
  sourceRequestId: number;

  @Prop({ type: String, required: true, trim: true, minlength: 1, maxlength: 100 })
  serviceCategory: string;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(ServiceRequestStatus),
  })
  status: ServiceRequestStatus;

  @Prop({ type: Date, required: true })
  requestCreatedAt: Date;

  @Prop({ type: Date, required: true })
  requestUpdatedAt: Date;
}

export const ServiceRequestReadModelSchema = SchemaFactory.createForClass(
  ServiceRequestReadModel,
);

ServiceRequestReadModelSchema.index(
  { status: 1, serviceCategory: 1 },
  { name: 'IDX_service_requests_status_category' },
);
ServiceRequestReadModelSchema.index(
  { serviceCategory: 1, status: 1 },
  { name: 'IDX_service_requests_category_status' },
);
ServiceRequestReadModelSchema.index(
  { serviceCategory: 1, requestCreatedAt: -1 },
  { name: 'IDX_service_requests_category_created' },
);
