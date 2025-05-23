// Registry of all custom news/article MCP tools for quick reference and import.
// Update this file when adding, removing, or renaming any custom news/article tool or handler.
export const NEWS_ARTICLE_TOOLS = [
    {
        toolName: 'get_recent_articles',
        handlerName: 'handleGetRecentArticles',
        description: 'Fetch the most recent articles, optionally paginated.'
    },
    {
        toolName: 'search_articles_by_category',
        handlerName: 'handleSearchArticlesByCategory',
        description: 'Return articles filtered by category (and optional subcategory), paginated.'
    },
    {
        toolName: 'search_articles_by_author',
        handlerName: 'handleSearchArticlesByAuthor',
        description: 'Return articles written by a specific author, paginated.'
    },
    {
        toolName: 'fulltext_search_articles',
        handlerName: 'handleFulltextSearchArticles',
        description: 'Search articles by a text query in title, summary, or content.'
    },
    {
        toolName: 'paginated_article_list',
        handlerName: 'handlePaginatedArticleList',
        description: 'List articles with offset/limit for pagination.'
    },
    {
        toolName: 'get_article_by_key',
        handlerName: 'handleGetArticleByKey',
        description: 'Fetch a single article by its key or _id.'
    },
    {
        toolName: 'list_all_categories',
        handlerName: 'handleListAllCategories',
        description: 'Return all unique categories and subcategories from articles.'
    },
    {
        toolName: 'list_all_authors',
        handlerName: 'handleListAllAuthors',
        description: 'Return all unique authors from articles.'
    },
    {
        toolName: 'get_articles_by_entity',
        handlerName: 'handleGetArticlesByEntity',
        description: 'Return articles mentioning a specific entity (by name or _key).'
    },
    {
        toolName: 'get_articles_by_date_range',
        handlerName: 'handleGetArticlesByDateRange',
        description: 'Return articles published within a date range.'
    },
    {
        toolName: 'flexible_document_by_key',
        handlerName: 'handleFlexibleDocumentByKey',
        description: 'Fetch a single document by its key or _id, with flexible projection, detail, and related data.'
    },
    {
        toolName: 'flexible_documents_by_date_range',
        handlerName: 'handleFlexibleDocumentsByDateRange',
        description: 'Return documents published within a date range, with flexible parameters.'
    },
    {
        toolName: 'flexible_fulltext_search_documents',
        handlerName: 'handleFlexibleFulltextSearchDocuments',
        description: 'Search documents by text in title, summary, or content, with flexible parameters.'
    },
    {
        toolName: 'flexible_list_document_authors',
        handlerName: 'handleFlexibleListDocumentAuthors',
        description: 'Return unique authors from documents, with flexible filtering and grouping.'
    },
    {
        toolName: 'flexible_list_document_categories',
        handlerName: 'handleFlexibleListDocumentCategories',
        description: 'Return unique categories and subcategories from documents, with flexible filtering and grouping.'
    },
    {
        toolName: 'get_document_edges',
        handlerName: 'handleGetDocumentEdges',
        description: 'Return all edges connected to a Document node, searching all relevant edge collections.'
    },
    {
        toolName: 'get_live_utc_date',
        handlerName: 'handleCallTool',
        description: 'Fetch the current live UTC date and time from a free online API.'
    },
    {
        toolName: 'get_system_time',
        handlerName: 'handleCallTool',
        description: 'Return the current system/server time in ISO 8601 format (from the server running the MCP instance).'
    }
];
