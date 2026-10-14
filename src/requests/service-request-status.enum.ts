import { BadRequestException } from '@nestjs/common';

export enum ServiceRequestStatus {
  SUBMITTED = 'Submitted',
  ASSIGNED = 'Assigned',
  IN_PROGRESS = 'In Progress',
  PENDING_CUSTOMER = 'Pending Customer',
  RESOLVED = 'Resolved',
  CLOSED = 'Closed',
}

export const OPEN_SERVICE_REQUEST_STATUSES: readonly ServiceRequestStatus[] = [
  ServiceRequestStatus.SUBMITTED,
  ServiceRequestStatus.ASSIGNED,
  ServiceRequestStatus.IN_PROGRESS,
  ServiceRequestStatus.PENDING_CUSTOMER,
];

export class ServiceRequestStatusPolicy {
  private static readonly ALLOWED_TRANSITIONS: Record<
    ServiceRequestStatus,
    ServiceRequestStatus[]
  > = {
    [ServiceRequestStatus.SUBMITTED]: [
      ServiceRequestStatus.ASSIGNED,
      ServiceRequestStatus.CLOSED,
    ],
    [ServiceRequestStatus.ASSIGNED]: [
      ServiceRequestStatus.IN_PROGRESS,
      ServiceRequestStatus.PENDING_CUSTOMER,
      ServiceRequestStatus.CLOSED,
    ],
    [ServiceRequestStatus.IN_PROGRESS]: [
      ServiceRequestStatus.PENDING_CUSTOMER,
      ServiceRequestStatus.RESOLVED,
    ],
    [ServiceRequestStatus.PENDING_CUSTOMER]: [
      ServiceRequestStatus.IN_PROGRESS,
      ServiceRequestStatus.RESOLVED,
    ],
    [ServiceRequestStatus.RESOLVED]: [ServiceRequestStatus.CLOSED],
    [ServiceRequestStatus.CLOSED]: [],
  };

  static canTransition(
    from: ServiceRequestStatus,
    to: ServiceRequestStatus,
  ): boolean {
    return this.ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
  }

  static assertTransition(from: ServiceRequestStatus, to: ServiceRequestStatus) {
    if (!this.canTransition(from, to)) {
      throw new BadRequestException(
        `Invalid status transition from ${from} to ${to}`,
      );
    }
  }
}
