import { ApiProperty } from '@nestjs/swagger';

export class RequestAttachmentResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  serviceRequestId: number;

  @ApiProperty()
  uploadedByUserId: number;

  @ApiProperty()
  originalFileName: string;

  @ApiProperty({
    enum: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  })
  contentType: string;

  @ApiProperty()
  sizeBytes: number;

  @ApiProperty()
  createdAt: Date;
}

export class RequestAttachmentDownloadDto {
  @ApiProperty({ description: 'Short-lived, private S3 download URL.' })
  url: string;

  @ApiProperty({ example: 300 })
  expiresInSeconds: number;
}
