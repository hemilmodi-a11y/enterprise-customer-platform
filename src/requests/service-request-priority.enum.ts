export enum ServiceRequestPriority {
  LOW = 'Low',
  NORMAL = 'Normal',
  HIGH = 'High',
  URGENT = 'Urgent',
}

export const HIGH_SERVICE_REQUEST_PRIORITIES: readonly ServiceRequestPriority[] = [
  ServiceRequestPriority.HIGH,
  ServiceRequestPriority.URGENT,
];
