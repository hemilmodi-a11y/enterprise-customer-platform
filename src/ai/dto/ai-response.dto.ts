import { ApiProperty } from '@nestjs/swagger';

import { KnowledgeDocumentCategory } from '../../knowledge-base/knowledge-document.enums';

export class AiAnswerSourceDto {
  @ApiProperty({ format: 'uuid' })
  documentId: string;

  @ApiProperty()
  documentName: string;

  @ApiProperty({ enum: KnowledgeDocumentCategory })
  category: KnowledgeDocumentCategory;

  @ApiProperty({ minimum: 1 })
  version: number;

  @ApiProperty({ minimum: 0 })
  chunkIndex: number;

  @ApiProperty()
  sourceReference: string;
}

export class AiCustomerSupportResponseDto {
  @ApiProperty({
    example:
      'Check that your router is powered on and connected. If the issue continues, contact technical support.',
  })
  answer: string;

  @ApiProperty({ type: [AiAnswerSourceDto] })
  sources: AiAnswerSourceDto[];

  @ApiProperty({ nullable: true, example: null })
  confidence: number | null;
}
