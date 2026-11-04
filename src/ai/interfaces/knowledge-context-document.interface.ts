import { KnowledgeDocumentCategory } from '../../knowledge-base/knowledge-document.enums';

export interface KnowledgeContextDocument {
  documentId: string;
  name: string;
  category: KnowledgeDocumentCategory;
  department: string;
  content: string;
}
