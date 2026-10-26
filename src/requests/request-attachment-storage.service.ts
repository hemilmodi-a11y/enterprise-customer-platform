import {
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const DOWNLOAD_URL_TTL_SECONDS = 300;

@Injectable()
export class RequestAttachmentStorageService implements OnModuleDestroy {
  private readonly logger = new Logger(RequestAttachmentStorageService.name);
  private readonly client?: S3Client;
  private readonly bucket?: string;

  constructor(config: ConfigService) {
    const region = config.get<string>('AWS_REGION');
    this.bucket = config.get<string>('S3_BUCKET');
    if (region && this.bucket) {
      this.client = new S3Client({ region });
    }
  }

  onModuleDestroy(): void {
    this.client?.destroy();
  }

  async upload(
    key: string,
    body: Buffer,
    contentType: string,
    originalFileName: string,
  ): Promise<void> {
    const { client, bucket } = this.getConfiguration();
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentLength: body.length,
          ContentType: contentType,
          ContentDisposition: `attachment; filename="${this.safeHeaderFileName(originalFileName)}"`,
          ServerSideEncryption: 'AES256',
        }),
      );
    } catch (error) {
      this.logFailure('upload', error);
      throw new ServiceUnavailableException(
        'Document storage is temporarily unavailable',
      );
    }
  }

  async delete(key: string): Promise<void> {
    const { client, bucket } = this.getConfiguration();
    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: key,
        }),
      );
    } catch (error) {
      this.logFailure('cleanup', error);
      throw new ServiceUnavailableException('Document storage cleanup failed');
    }
  }

  async createDownloadUrl(
    key: string,
    contentType: string,
    originalFileName: string,
  ): Promise<string> {
    const { client, bucket } = this.getConfiguration();
    try {
      return await getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
          ResponseContentType: contentType,
          ResponseContentDisposition: `attachment; filename="${this.safeHeaderFileName(originalFileName)}"`,
        }),
        { expiresIn: DOWNLOAD_URL_TTL_SECONDS },
      );
    } catch (error) {
      this.logFailure('sign download URL', error);
      throw new ServiceUnavailableException(
        'Document storage is temporarily unavailable',
      );
    }
  }

  private getConfiguration(): { client: S3Client; bucket: string } {
    if (!this.client || !this.bucket) {
      throw new ServiceUnavailableException(
        'Document storage is not configured',
      );
    }
    return { client: this.client, bucket: this.bucket };
  }

  private safeHeaderFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
  }

  private logFailure(operation: string, error: unknown): void {
    this.logger.error(
      `S3 document ${operation} failed (${error instanceof Error ? error.name : 'UnknownError'}).`,
    );
  }
}
