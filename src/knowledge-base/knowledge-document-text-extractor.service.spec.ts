import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';

import { KnowledgeDocumentTextExtractorService } from './knowledge-document-text-extractor.service';

describe('KnowledgeDocumentTextExtractorService', () => {
  const service = new KnowledgeDocumentTextExtractorService();

  it('normalizes valid UTF-8 text', async () => {
    await expect(
      service.extract(
        Buffer.from(' First line  \r\n\r\nSecond line \n'),
        'policy.txt',
        'text/plain',
      ),
    ).resolves.toBe('First line\n\nSecond line');
  });

  it('rejects unsupported file types and mismatched MIME types', async () => {
    await expect(
      service.extract(Buffer.from('text'), 'policy.exe', 'text/plain'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.extract(Buffer.from('text'), 'policy.txt', 'application/pdf'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects empty, binary, and invalid UTF-8 text files', async () => {
    await expect(
      service.extract(Buffer.alloc(0), 'empty.txt', 'text/plain'),
    ).rejects.toThrow('Knowledge document file is empty');
    await expect(
      service.extract(
        Buffer.from([0x61, 0x00, 0x62]),
        'binary.txt',
        'text/plain',
      ),
    ).rejects.toThrow('Text document contains binary data');
    await expect(
      service.extract(Buffer.from([0xc3, 0x28]), 'invalid.txt', 'text/plain'),
    ).rejects.toThrow('Text document must use valid UTF-8');
  });

  it('validates PDF signatures before parsing', async () => {
    await expect(
      service.extract(
        Buffer.from('not a pdf'),
        'policy.pdf',
        'application/pdf',
      ),
    ).rejects.toThrow('PDF signature is invalid');
  });
});
