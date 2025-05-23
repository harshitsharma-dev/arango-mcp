// TypeScript type definitions for news_article_tools_registry.ts
// This allows for type-safe imports and IDE autocomplete.

export interface NewsArticleToolRegistryEntry {
  toolName: string;
  handlerName: string;
  description: string;
}

export declare const NEWS_ARTICLE_TOOLS: NewsArticleToolRegistryEntry[];
