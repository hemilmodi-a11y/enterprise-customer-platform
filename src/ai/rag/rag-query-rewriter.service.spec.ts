import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { RagQueryRewriterService } from './rag-query-rewriter.service';

describe('RagQueryRewriterService', () => {
  let enabled: boolean;
  let service: RagQueryRewriterService;

  beforeEach(() => {
    enabled = true;
    service = new RagQueryRewriterService({
      get: jest.fn(() => enabled),
    } as never);
  });

  it('removes conversational framing while preserving intent and exact identifiers', () => {
    expect(
      service.rewrite(
        'Hi, could you please explain the refund policy for ERR-503?',
      ),
    ).toEqual({
      searchQuery: 'the refund policy for ERR-503?',
      terms: ['refund', 'policy', 'err-503'],
    });
  });

  it('keeps the original question when rewriting is disabled', () => {
    enabled = false;
    expect(service.rewrite('  Can you explain HTTP 503?  ')).toEqual({
      searchQuery: 'Can you explain HTTP 503?',
      terms: ['explain', 'http', '503'],
    });
  });

  it('returns an empty term list for stop-word-only input', () => {
    expect(service.rewrite('What is it?').terms).toEqual([]);
  });
});
