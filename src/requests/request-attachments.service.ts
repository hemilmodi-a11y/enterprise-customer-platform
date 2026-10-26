import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { Repository } from 'typeorm';
import 'multer';

import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { RequestAttachmentDownloadDto } from './dto/request-attachment-response.dto';
import { RequestAttachmentResponseDto } from './dto/request-attachment-response.dto';
import { RequestAttachmentStorageService } from './request-attachment-storage.service';
import { ServiceRequestAttachment } from './request-attachment.entity';
import { RequestsService } from './requests.service';

const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
const DOWNLOAD_URL_TTL_SECONDS = 300;

const ALLOWED_FILE_TYPES = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    '.docx',
} as const;

type AllowedContentType = keyof typeof ALLOWED_FILE_TYPES;

@Injectable()
export class RequestAttachmentsService {
  private readonly logger = new Logger(RequestAttachmentsService.name);

  constructor(
    @InjectRepository(ServiceRequestAttachment)
    private readonly attachments: Repository<ServiceRequestAttachment>,
    private readonly requestsService: RequestsService,
    private readonly storage: RequestAttachmentStorageService,
  ) {}

  private readonly maxSizeBytes = MAX_ATTACHMENT_SIZE_BYTES;

  async upload(
    requestId: number,
    file: Express.Multer.File | undefined,
    actor: AuthenticatedUser,
  ): Promise<RequestAttachmentResponseDto> {
    await this.requestsService.findById(requestId, actor);
    if (!file) {
      throw new BadRequestException('A document file is required');
    }
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new PayloadTooLargeException('Document must not exceed 10 MB');
    }
    if (!Buffer.isBuffer(file.buffer) || file.size !== file.buffer.length) {
      throw new BadRequestException('Invalid uploaded document');
    }
    if (file.buffer.length > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new PayloadTooLargeException('Document must not exceed 10 MB');
    }

    const detectedType = this.detectContentType(file.buffer);
    if (!detectedType || detectedType !== file.mimetype) {
      throw new BadRequestException(
        'Document content must match a supported file type',
      );
    }

    const originalFileName = this.safeOriginalFileName(file.originalname);
    if (
      extname(originalFileName).toLowerCase() !==
      ALLOWED_FILE_TYPES[detectedType]
    ) {
      throw new BadRequestException(
        'Document extension must match its content',
      );
    }
    const storageKey = `service-requests/${requestId}/${randomUUID()}${ALLOWED_FILE_TYPES[detectedType]}`;
    await this.storage.upload(
      storageKey,
      file.buffer,
      detectedType,
      originalFileName,
    );

    try {
      const attachment = await this.attachments.save(
        this.attachments.create({
          serviceRequestId: requestId,
          uploadedByUserId: actor.userId,
          originalFileName,
          contentType: detectedType,
          sizeBytes: file.size,
          storageKey,
        }),
      );
      return this.toResponse(attachment);
    } catch (error) {
      try {
        await this.storage.delete(storageKey);
      } catch (cleanupError) {
        this.logger.error(
          `Failed to remove unreferenced uploaded document for request ${requestId} (${cleanupError instanceof Error ? cleanupError.name : 'UnknownError'}).`,
        );
      }
      throw error;
    }
  }

  async list(
    requestId: number,
    actor: AuthenticatedUser,
  ): Promise<RequestAttachmentResponseDto[]> {
    await this.requestsService.findById(requestId, actor);
    const attachments = await this.attachments.find({
      where: { serviceRequestId: requestId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return attachments.map((attachment) => this.toResponse(attachment));
  }

  async createDownloadUrl(
    requestId: number,
    attachmentId: number,
    actor: AuthenticatedUser,
  ): Promise<RequestAttachmentDownloadDto> {
    await this.requestsService.findById(requestId, actor);
    const attachment = await this.attachments.findOne({
      where: { id: attachmentId, serviceRequestId: requestId },
    });
    if (!attachment) {
      throw new NotFoundException('Document not found for this request');
    }

    const url = await this.storage.createDownloadUrl(
      attachment.storageKey,
      attachment.contentType,
      attachment.originalFileName,
    );
    return { url, expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS };
  }

  private detectContentType(buffer: Buffer): AllowedContentType | null {
    if (
      buffer.length >= 5 &&
      buffer.subarray(0, 5).toString('ascii') === '%PDF-'
    ) {
      return 'application/pdf';
    }
    if (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    ) {
      return 'image/jpeg';
    }
    if (
      buffer.length >= 8 &&
      buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    ) {
      return 'image/png';
    }
    if (
      buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      this.hasValidDocxContainer(buffer)
    ) {
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
    return null;
  }

  private hasValidDocxContainer(buffer: Buffer): boolean {
    const endSignature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
    const endOffset = buffer.lastIndexOf(endSignature);
    if (endOffset < 0 || endOffset + 22 > buffer.length) {
      return false;
    }

    const entryCount = buffer.readUInt16LE(endOffset + 10);
    const centralDirectorySize = buffer.readUInt32LE(endOffset + 12);
    const centralDirectoryOffset = buffer.readUInt32LE(endOffset + 16);
    if (
      centralDirectoryOffset + centralDirectorySize > endOffset ||
      entryCount === 0
    ) {
      return false;
    }

    const names = new Set<string>();
    let offset = centralDirectoryOffset;
    for (let index = 0; index < entryCount; index += 1) {
      if (
        offset + 46 > endOffset ||
        buffer.readUInt32LE(offset) !== 0x02014b50
      ) {
        return false;
      }

      const flags = buffer.readUInt16LE(offset + 8);
      const method = buffer.readUInt16LE(offset + 10);
      const nameLength = buffer.readUInt16LE(offset + 28);
      const extraLength = buffer.readUInt16LE(offset + 30);
      const commentLength = buffer.readUInt16LE(offset + 32);
      const localHeaderOffset = buffer.readUInt32LE(offset + 42);
      const entryEnd = offset + 46 + nameLength + extraLength + commentLength;
      const localNameLength =
        localHeaderOffset + 30 <= buffer.length
          ? buffer.readUInt16LE(localHeaderOffset + 26)
          : 0;
      const fileName = buffer.toString(
        'utf8',
        offset + 46,
        offset + 46 + nameLength,
      );
      if (
        entryEnd > endOffset ||
        (flags & 1) !== 0 ||
        (method !== 0 && method !== 8) ||
        localHeaderOffset + 30 > buffer.length ||
        buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50 ||
        buffer.readUInt16LE(localHeaderOffset + 8) !== method ||
        localNameLength !== nameLength ||
        localHeaderOffset + 30 + localNameLength > buffer.length ||
        buffer.toString(
          'utf8',
          localHeaderOffset + 30,
          localHeaderOffset + 30 + localNameLength,
        ) !== fileName
      ) {
        return false;
      }
      names.add(fileName);
      offset = entryEnd;
    }

    return (
      offset === centralDirectoryOffset + centralDirectorySize &&
      names.has('[Content_Types].xml') &&
      names.has('word/document.xml')
    );
  }

  private safeOriginalFileName(fileName: string): string {
    const normalized = fileName.replace(/\\/g, '/').split('/').pop() ?? '';
    const safe = normalized.replace(/[^\p{L}\p{N}._ -]/gu, '_').trim();
    if (!safe || safe.length > 255) {
      throw new BadRequestException('Invalid document file name');
    }
    return safe;
  }

  private toResponse(
    attachment: ServiceRequestAttachment,
  ): RequestAttachmentResponseDto {
    return {
      id: attachment.id,
      serviceRequestId: attachment.serviceRequestId,
      uploadedByUserId: attachment.uploadedByUserId,
      originalFileName: attachment.originalFileName,
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes,
      createdAt: attachment.createdAt,
    };
  }
}
