import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface RewrittenRagQuery {
  searchQuery: string;
  terms: string[];
}

const STOP_WORDS = new Set([
  'a',
  'about',
  'an',
  'and',
  'are',
  'can',
  'for',
  'how',
  'i',
  'is',
  'it',
  'me',
  'of',
  'on',
  'or',
  'please',
  'the',
  'this',
  'to',
  'what',
  'when',
  'where',
  'which',
  'who',
  'could',
  'would',
  'why',
  'with',
  'you',
]);

@Injectable()
export class RagQueryRewriterService {
  constructor(private readonly config: ConfigService) {}

  rewrite(question: string): RewrittenRagQuery {
    const enabled = this.config.get<boolean>(
      'RAG_QUERY_REWRITING_ENABLED',
      true,
    );
    let searchQuery = question.trim().replace(/\s+/g, ' ');

    if (enabled) {
      const prefixes = [
        /^(?:hi|hello|hey)[,!\s]+/i,
        /^(?:(?:can|could|would) you\s+)?(?:please\s+)?(?:tell me|explain|help me understand|give me information about)\s+/i,
        /^(?:i would like to know|i want to know|i need to know)\s+/i,
      ];
      for (const prefix of prefixes) {
        searchQuery = searchQuery.replace(prefix, '');
      }
      searchQuery = searchQuery.trim().replace(/\s+/g, ' ');
    }

    const terms = this.extractTerms(searchQuery);
    return {
      searchQuery: searchQuery || question.trim(),
      terms,
    };
  }

  extractTerms(value: string): string[] {
    const matches =
      value
        .toLocaleLowerCase()
        .match(/[\p{L}\p{N}]+(?:[._/-][\p{L}\p{N}]+)*/gu) ?? [];
    return [
      ...new Set(
        matches.filter((term) => term.length > 1 || /^\d+$/.test(term)),
      ),
    ].filter((term) => !STOP_WORDS.has(term));
  }
}
