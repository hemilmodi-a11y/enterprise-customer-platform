import { BadRequestException, Injectable } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import * as mammoth from 'mammoth';

const SUPPORTED_TYPES = new Map([
  ['.txt', ['text/plain']],
  ['.md', ['text/markdown', 'text/plain']],
  ['.pdf', ['application/pdf']],
  [
    '.docx',
    ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ],
]);

@Injectable()
export class KnowledgeDocumentTextExtractorService {
  async extract(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
  ): Promise<string> {
    const extension = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
    const allowedMimeTypes = SUPPORTED_TYPES.get(extension);
    if (!allowedMimeTypes || !allowedMimeTypes.includes(mimeType)) {
      throw new BadRequestException('Unsupported knowledge document format');
    }
    if (buffer.length === 0) {
      throw new BadRequestException('Knowledge document file is empty');
    }

    let text: string;
    if (extension === '.txt' || extension === '.md') {
      text = this.extractPlainText(buffer);
    } else if (extension === '.pdf') {
      text = await this.extractPdf(buffer);
    } else {
      text = await this.extractDocx(buffer);
    }

    const normalized = text
      .replace(/\r\n?/g, '\n')
      .replaceAll('\0', '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (!normalized) {
      throw new BadRequestException(
        'Knowledge document contains no extractable text',
      );
    }
    return normalized;
  }

  private extractPlainText(buffer: Buffer): string {
    if (buffer.includes(0)) {
      throw new BadRequestException('Text document contains binary data');
    }
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      throw new BadRequestException('Text document must use valid UTF-8');
    }
  }

  private async extractPdf(buffer: Buffer): Promise<string> {
    if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new BadRequestException('PDF signature is invalid');
    }
    const parser = new PDFParse({ data: buffer });
    try {
      return (await parser.getText()).text;
    } catch {
      throw new BadRequestException('Unable to extract text from PDF');
    } finally {
      await parser.destroy();
    }
  }

  private async extractDocx(buffer: Buffer): Promise<string> {
    if (
      buffer.length < 4 ||
      buffer[0] !== 0x50 ||
      buffer[1] !== 0x4b ||
      buffer[2] !== 0x03 ||
      buffer[3] !== 0x04
    ) {
      throw new BadRequestException('DOCX archive signature is invalid');
    }
    try {
      return (await mammoth.extractRawText({ buffer })).value;
    } catch {
      throw new BadRequestException('Unable to extract text from DOCX');
    }
  }
}
