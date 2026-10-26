import {
  BadRequestException,
  ForbiddenException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { RequestAttachmentsService } from './request-attachments.service';

const customer: AuthenticatedUser = {
  userId: 7,
  email: 'customer@example.com',
  roles: ['Customer'],
};

function createStoredZip(entries: string[]): Buffer {
  const localRecords: Buffer[] = [];
  const centralRecords: Buffer[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(name.length, 26);
    localRecords.push(localHeader, name);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt32LE(localOffset, 42);
    centralRecords.push(centralHeader, name);
    localOffset += localHeader.length + name.length;
  }

  const centralDirectory = Buffer.concat(centralRecords);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(entries.length, 8);
  endRecord.writeUInt16LE(entries.length, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(localOffset, 16);

  return Buffer.concat([...localRecords, centralDirectory, endRecord]);
}

describe('RequestAttachmentsService', () => {
  let service: RequestAttachmentsService;
  let attachments: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
  };
  let requestsService: { findById: jest.Mock };
  let storage: {
    upload: jest.Mock;
    delete: jest.Mock;
    createDownloadUrl: jest.Mock;
  };

  beforeEach(() => {
    attachments = {
      create: jest.fn((attachment) => attachment),
      save: jest.fn(async (attachment) => ({
        ...attachment,
        id: 4,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      })),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    };
    requestsService = { findById: jest.fn().mockResolvedValue({ id: 12 }) };
    storage = {
      upload: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      createDownloadUrl: jest
        .fn()
        .mockResolvedValue('https://private.example/signed'),
    };
    service = new RequestAttachmentsService(
      attachments as never,
      requestsService as never,
      storage as never,
    );
  });

  it('validates PDF bytes and stores a unique S3 key with MySQL metadata', async () => {
    const pdf = Buffer.from('%PDF-1.7\nsafe');
    const response = await service.upload(
      12,
      {
        originalname: 'report.pdf',
        mimetype: 'application/pdf',
        size: pdf.length,
        buffer: pdf,
      } as Express.Multer.File,
      customer,
    );

    expect(response).toMatchObject({
      id: 4,
      serviceRequestId: 12,
      uploadedByUserId: 7,
      originalFileName: 'report.pdf',
      contentType: 'application/pdf',
      sizeBytes: pdf.length,
    });
    const key = storage.upload.mock.calls[0][0];
    expect(key).toMatch(/^service-requests\/12\/[0-9a-f-]+\.pdf$/);
    expect(storage.upload).toHaveBeenCalledWith(
      key,
      pdf,
      'application/pdf',
      'report.pdf',
    );
    expect(attachments.create).toHaveBeenCalledWith(
      expect.objectContaining({ storageKey: key, uploadedByUserId: 7 }),
    );
  });

  it('accepts supported image and DOCX signatures', async () => {
    const files = [
      {
        originalname: 'photo.jpg',
        mimetype: 'image/jpeg',
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
      },
      {
        originalname: 'photo.png',
        mimetype: 'image/png',
        buffer: Buffer.from([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
        ]),
      },
      {
        originalname: 'report.docx',
        mimetype:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        buffer: createStoredZip(['[Content_Types].xml', 'word/document.xml']),
      },
    ];

    for (const file of files) {
      await expect(
        service.upload(
          12,
          { ...file, size: file.buffer.length } as Express.Multer.File,
          customer,
        ),
      ).resolves.toMatchObject({ originalFileName: file.originalname });
    }
    expect(storage.upload).toHaveBeenCalledTimes(3);
  });

  it('rejects unsupported or mismatched file formats before S3 upload', async () => {
    await expect(
      service.upload(
        12,
        {
          originalname: 'malware.pdf',
          mimetype: 'application/pdf',
          size: 5,
          buffer: Buffer.from('not pdf'),
        } as Express.Multer.File,
        customer,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.upload(
        12,
        {
          originalname: 'report.docx',
          mimetype:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          size: 32,
          buffer: Buffer.from('PK[Content_Types].xmlword/document.xml'),
        } as Express.Multer.File,
        customer,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.upload(
        12,
        {
          originalname: 'report.exe',
          mimetype: 'application/pdf',
          size: 12,
          buffer: Buffer.from('%PDF-1.7\nsafe'),
        } as Express.Multer.File,
        customer,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('rejects oversized files and users without access to the request', async () => {
    await expect(
      service.upload(
        12,
        {
          originalname: 'large.pdf',
          mimetype: 'application/pdf',
          size: 10 * 1024 * 1024 + 1,
          buffer: Buffer.from('%PDF-1.7\nsafe'),
        } as Express.Multer.File,
        customer,
      ),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);

    requestsService.findById.mockRejectedValue(new ForbiddenException());
    await expect(
      service.upload(
        12,
        {
          originalname: 'report.pdf',
          mimetype: 'application/pdf',
          size: 12,
          buffer: Buffer.from('%PDF-1.7\nsafe'),
        } as Express.Multer.File,
        customer,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('issues download URLs only for attachment metadata belonging to the request', async () => {
    attachments.findOne.mockResolvedValue({
      id: 4,
      serviceRequestId: 12,
      storageKey: 'service-requests/12/uuid.pdf',
      contentType: 'application/pdf',
      originalFileName: 'report.pdf',
    });

    await expect(service.createDownloadUrl(12, 4, customer)).resolves.toEqual({
      url: 'https://private.example/signed',
      expiresInSeconds: 300,
    });
    expect(attachments.findOne).toHaveBeenCalledWith({
      where: { id: 4, serviceRequestId: 12 },
    });
    expect(storage.createDownloadUrl).toHaveBeenCalledWith(
      'service-requests/12/uuid.pdf',
      'application/pdf',
      'report.pdf',
    );
  });
});
