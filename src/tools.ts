import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CollectionType } from 'arangojs/collection';

export function createToolDefinitions(): Tool[] {
	return [
		{
			name: API_TOOLS.QUERY as string,
			description: 'Execute an AQL query',
			inputSchema: {
				type: 'object',
				properties: {
					query: {
						type: 'string',
						description: 'AQL query string',
					},
					bindVars: {
						type: 'object',
						description: 'Query bind variables',
						additionalProperties: { type: 'object' },
					},
				},
				required: ['query'],
			},
		},
		{
			name: API_TOOLS.INSERT as string,
			description: 'Insert a document into a collection',
			inputSchema: {
				type: 'object',
				properties: {
					collection: {
						type: 'string',
						description: 'Collection name',
					},
					document: {
						type: 'object',
						description: 'Document to insert',
						additionalProperties: { type: 'object' },
					},
				},
				required: ['collection', 'document'],
			},
		},
		{
			name: API_TOOLS.UPDATE as string,
			description: 'Update a document in a collection',
			inputSchema: {
				type: 'object',
				properties: {
					collection: {
						type: 'string',
						description: 'Collection name',
					},
					key: {
						type: 'string',
						description: 'Document key',
					},
					update: {
						type: 'object',
						description: 'Update object',
						additionalProperties: { type: 'object' },
					},
				},
				required: ['collection', 'key', 'update'],
			},
		},
		{
			name: API_TOOLS.REMOVE as string,
			description: 'Remove a document from a collection',
			inputSchema: {
				type: 'object',
				properties: {
					collection: {
						type: 'string',
						description: 'Collection name',
					},
					key: {
						type: 'string',
						description: 'Document key',
					},
				},
				required: ['collection', 'key'],
			},
		},
		{
			name: API_TOOLS.BACKUP as string,
			description: 'Backup collections to JSON files.',
			inputSchema: {
				type: 'object',
				properties: {
					outputDir: {
						type: 'string',
						description: 'An absolute directory path to store backup files',
						default: './backup',
						optional: true,
					},
					collection: {
						type: 'string',
						description: 'Collection name to backup. If not provided, backs up all collections.',
						optional: true,
					},
					docLimit: {
						type: 'integer',
						description: 'Limit the number of documents to backup. If not provided, backs up all documents.',
						optional: true,
					},
				},
				required: ['outputDir'],
			},
		},
		{
			name: API_TOOLS.COLLECTIONS as string,
			description: 'List all collections in the database',
			inputSchema: {
				type: 'object',
				properties: {},
			},
		},
		{
			name: API_TOOLS.CREATE_COLLECTION as string,
			description: 'Create a new collection in the database',
			inputSchema: {
				type: 'object',
				properties: {
					name: {
						type: 'string',
						description: 'Name of the collection to create',
					},
					type: {
						type: 'string',
						description: 'Type of collection to create ("document" or "edge")',
						default: 'document',
						enum: ['document', 'edge'],
					},
					waitForSync: {
						type: 'boolean',
						description: 'If true, wait for data to be synchronized to disk before returning',
						default: false,
					},
				},
				required: ['name'],
			},
		},
		{
			name: 'get_crlr_related_articles_unset',
			description: 'Get articles related to a given article via cr/lr relations, with unset fields.',
			inputSchema: {
				type: 'object',
				properties: {
					articleKey: { type: 'string', description: 'Key for query article' },
					graphDepth: { type: 'number', description: 'Depth for graph traversal' },
					edgeCollectionName: { type: 'string', description: 'Edge collection name' },
					simThreshold: { type: 'number', description: 'Similarity threshold' },
					dbUrl: { type: 'string', description: 'Database URL' }
				},
				required: ['articleKey', 'graphDepth', 'edgeCollectionName', 'simThreshold', 'dbUrl']
			}
		},
		{
			name: 'get_crlr_related_articles',
			description: 'Get articles related to a given article via cr/lr relations, returning full objects.',
			inputSchema: {
				type: 'object',
				properties: {
					articleKey: { type: 'string', description: 'Key for query article' },
					graphDepth: { type: 'number', description: 'Depth for graph traversal' },
					edgeCollectionName: { type: 'string', description: 'Edge collection name' },
					simThreshold: { type: 'number', description: 'Similarity threshold' },
					dbUrl: { type: 'string', description: 'Database URL' }
				},
				required: ['articleKey', 'graphDepth', 'edgeCollectionName', 'simThreshold', 'dbUrl']
			}
		},
		{
			name: 'get_path_related_articles_unset',
			description: 'Get related articles by path count, with unset fields.',
			inputSchema: {
				type: 'object',
				properties: {
					articleKey: { type: 'string', description: 'Key for query article' },
					graphDepth: { type: 'number', description: 'Depth for graph traversal' },
					limit: { type: 'number', description: 'Result limit' },
					dbUrl: { type: 'string', description: 'Database URL' },
					epochtime: { type: 'number', description: 'Epoch time (unix format) for 8 hours' }
				},
				required: ['articleKey', 'graphDepth', 'limit', 'dbUrl', 'epochtime']
			}
		},
		{
			name: 'get_path_related_articles',
			description: 'Get related articles by path count, returning full objects.',
			inputSchema: {
				type: 'object',
				properties: {
					dbUrl: { type: 'string', description: 'Database URL' },
					traversalDepth: { type: 'number', description: 'Depth for graph traversal' },
					qaCategory: { type: 'string', description: 'Category of query article' },
					qaKey: { type: 'string', description: 'Key of query article' },
					thresholdEpochtime: { type: 'number', description: 'Epoch time threshold' },
					noOfResults: { type: 'number', description: 'Number of results' },
					ipOrigin: { type: 'array', items: { type: 'string' }, description: 'Optional origin list', optional: true }
				},
				required: ['dbUrl', 'traversalDepth', 'qaCategory', 'qaKey', 'thresholdEpochtime', 'noOfResults']
			}
		},
		{
			name: 'get_related_articles_graph',
			description: 'Get related articles through graph traversal based on top terms/entities.',
			inputSchema: {
				type: 'object',
				properties: {
					dbUrl: { type: 'string', description: 'Database URL' },
					qaTopterms: { type: 'array', items: { type: 'string' }, description: 'List of top terms' },
					qaKey: { type: 'string', description: 'Key of query article' },
					traversalDepth: { type: 'number', description: 'Depth for graph traversal' },
					qaEpochtime: { type: 'number', description: 'Query article epoch time' },
					qaCategory: { type: 'string', description: 'Category of query article' },
					thresholdEpochtime: { type: 'number', description: 'Epoch time threshold' }
				},
				required: ['dbUrl', 'qaTopterms', 'qaKey', 'traversalDepth', 'qaEpochtime', 'qaCategory', 'thresholdEpochtime']
			}
		},
		{
			name: 'get_crlr_related_docs',
			description: 'Get related documents for a given document via cr/lr relations.',
			inputSchema: {
				type: 'object',
				properties: {
					dbUrl: { type: 'string', description: 'Database URL' },
					docUrl: { type: 'string', description: 'Query document URL' },
					searchDepth: { type: 'number', description: 'Depth for graph traversal' },
					edgeCollName: { type: 'string', description: 'Edge collection name' }
				},
				required: ['dbUrl', 'docUrl', 'searchDepth', 'edgeCollName']
			}
		},
		{
			name: 'get_path_related_docs',
			description: 'Get related documents based on number of connecting paths.',
			inputSchema: {
				type: 'object',
				properties: {
					dbUrl: { type: 'string', description: 'Database URL' },
					queryArticleId: { type: 'string', description: 'Query article ID' },
					searchDepth: { type: 'number', description: 'Depth for graph traversal' },
					edgeCollName: { type: 'string', description: 'Edge collection name' },
					noOfResults: { type: 'number', description: 'Number of results' }
				},
				required: ['dbUrl', 'queryArticleId', 'searchDepth', 'edgeCollName', 'noOfResults']
			}
		},
		{
			name: 'flexible_list_authors',
			description: 'Return unique authors from articles, with full flexibility: limit, offset, filter, grouping, etc.',
			inputSchema: {
				type: 'object',
				properties: {
					limit: { type: 'number', description: 'Maximum number of authors to return', default: 100 },
					offset: { type: 'number', description: 'Number of authors to skip', default: 0 },
					article_key: { type: 'string', description: 'If provided, only authors of this article/document', optional: true },
					groupBy: { type: 'string', description: 'Group authors by this field', optional: true },
				},
				required: [],
			},
		},
		{
			name: 'flexible_list_categories',
			description: 'Return unique categories and subcategories, with full flexibility: limit, offset, filter, grouping, etc.',
			inputSchema: {
				type: 'object',
				properties: {
					limit: { type: 'number', description: 'Maximum number of categories to return', default: 100 },
					offset: { type: 'number', description: 'Number of categories to skip', default: 0 },
					article_key: { type: 'string', description: 'If provided, only categories of this article/document', optional: true },
					groupBy: { type: 'string', description: 'Group categories by this field', optional: true },
				},
				required: [],
			},
		},
		{
			name: 'flexible_articles_by_entity',
			description: 'Return articles mentioning a specific entity, with full flexibility: limit, offset, detail, related, grouping, etc.',
			inputSchema: {
				type: 'object',
				properties: {
					entity: { type: 'string', description: 'Entity name or _key' },
					limit: { type: 'number', description: 'Maximum number of articles to return', default: 10 },
					offset: { type: 'number', description: 'Number of articles to skip', default: 0 },
					detail: { type: 'string', enum: ['minimal', 'summary', 'full'], description: 'Level of detail', default: 'summary' },
					withRelated: { type: 'array', items: { type: 'string' }, description: 'Related data to include', optional: true },
					groupBy: { type: 'string', description: 'Group results by this field', optional: true },
					projection: { type: 'array', items: { type: 'string' }, description: 'Fields to include in result', optional: true },
				},
				required: ['entity'],
			},
		},
		{
			name: 'flexible_recent_articles',
			description: 'Fetch the most recent articles, with full flexibility: pagination, sorting, detail, related data, etc.',
			inputSchema: {
				type: 'object',
				properties: {
					limit: { type: 'number', description: 'Maximum number of articles to return', default: 10 },
					offset: { type: 'number', description: 'Number of articles to skip', default: 0 },
					sortBy: { type: 'string', description: 'Field to sort by (e.g., "default.epoch_time")', default: 'default.epoch_time' },
					sortOrder: { type: 'string', enum: ['asc', 'desc'], description: 'Sort order', default: 'desc' },
					detail: { type: 'string', enum: ['minimal', 'summary', 'full'], description: 'Level of detail', default: 'summary' },
					withRelated: { type: 'array', items: { type: 'string' }, description: 'Related data to include (e.g., ["authors", "categories"])', optional: true },
					groupBy: { type: 'string', description: 'Group results by this field', optional: true },
					projection: { type: 'array', items: { type: 'string' }, description: 'Fields to include in result', optional: true },
				},
				required: [],
			},
		},
		{
			name: 'flexible_search_articles_by_category',
			description: 'Return articles filtered by category/subcategory, with full flexibility: pagination, sorting, detail, related data, etc.',
			inputSchema: {
				type: 'object',
				properties: {
					category: { type: 'string', description: 'Category name (e.g., "sports")' },
					subcategory: { type: 'string', description: 'Subcategory name (optional)', optional: true },
					limit: { type: 'number', description: 'Maximum number of articles to return', default: 10 },
					offset: { type: 'number', description: 'Number of articles to skip', default: 0 },
					sortBy: { type: 'string', description: 'Field to sort by', default: 'default.epoch_time' },
					sortOrder: { type: 'string', enum: ['asc', 'desc'], description: 'Sort order', default: 'desc' },
					detail: { type: 'string', enum: ['minimal', 'summary', 'full'], description: 'Level of detail', default: 'summary' },
					withRelated: { type: 'array', items: { type: 'string' }, description: 'Related data to include', optional: true },
					groupBy: { type: 'string', description: 'Group results by this field', optional: true },
					projection: { type: 'array', items: { type: 'string' }, description: 'Fields to include in result', optional: true },
				},
				required: ['category'],
			},
		},
		{
			name: 'flexible_search_articles_by_author',
			description: 'Return articles by author, with full flexibility: pagination, sorting, detail, related data, etc.',
			inputSchema: {
				type: 'object',
				properties: {
					author: { type: 'string', description: 'Author name (exact match)' },
					limit: { type: 'number', description: 'Maximum number of articles to return', default: 10 },
					offset: { type: 'number', description: 'Number of articles to skip', default: 0 },
					sortBy: { type: 'string', description: 'Field to sort by', default: 'default.epoch_time' },
					sortOrder: { type: 'string', enum: ['asc', 'desc'], description: 'Sort order', default: 'desc' },
					detail: { type: 'string', enum: ['minimal', 'summary', 'full'], description: 'Level of detail', default: 'summary' },
					withRelated: { type: 'array', items: { type: 'string' }, description: 'Related data to include', optional: true },
					groupBy: { type: 'string', description: 'Group results by this field', optional: true },
					projection: { type: 'array', items: { type: 'string' }, description: 'Fields to include in result', optional: true },
				},
				required: ['author'],
			},
		},
		{
			name: 'flexible_fulltext_search_articles',
			description: 'Search articles by text in title, summary, or content, with full flexibility: pagination, detail, related data, etc.',
			inputSchema: {
				type: 'object',
				properties: {
					query: { type: 'string', description: 'Text to search for' },
					limit: { type: 'number', description: 'Maximum number of articles to return', default: 10 },
					offset: { type: 'number', description: 'Number of articles to skip', default: 0 },
					detail: { type: 'string', enum: ['minimal', 'summary', 'full'], description: 'Level of detail', default: 'summary' },
					withRelated: { type: 'array', items: { type: 'string' }, description: 'Related data to include', optional: true },
					groupBy: { type: 'string', description: 'Group results by this field', optional: true },
					projection: { type: 'array', items: { type: 'string' }, description: 'Fields to include in result', optional: true },
				},
				required: ['query'],
			},
		},
		{
			name: 'flexible_paginated_article_list',
			description: 'List articles with full flexibility: pagination, sorting, detail, related data, etc.',
			inputSchema: {
				type: 'object',
				properties: {
					limit: { type: 'number', description: 'Maximum number of articles to return', default: 10 },
					offset: { type: 'number', description: 'Number of articles to skip', default: 0 },
					sortBy: { type: 'string', description: 'Field to sort by', default: 'default.epoch_time' },
					sortOrder: { type: 'string', enum: ['asc', 'desc'], description: 'Sort order', default: 'desc' },
					detail: { type: 'string', enum: ['minimal', 'summary', 'full'], description: 'Level of detail', default: 'summary' },
					withRelated: { type: 'array', items: { type: 'string' }, description: 'Related data to include', optional: true },
					groupBy: { type: 'string', description: 'Group results by this field', optional: true },
					projection: { type: 'array', items: { type: 'string' }, description: 'Fields to include in result', optional: true },
				},
				required: [],
			},
		},
		{
			name: 'flexible_article_by_key',
			description: 'Fetch a single article by its key or _id, with full flexibility: detail, related data, projection, etc.',
			inputSchema: {
				type: 'object',
				properties: {
					key: { type: 'string', description: 'Article _key or _id' },
					detail: { type: 'string', enum: ['minimal', 'summary', 'full'], description: 'Level of detail', default: 'full' },
					withRelated: { type: 'array', items: { type: 'string' }, description: 'Related data to include', optional: true },
					projection: { type: 'array', items: { type: 'string' }, description: 'Fields to include in result', optional: true },
				},
				required: ['key'],
			},
		},
		{
			name: 'flexible_articles_by_date_range',
			description: 'Return articles published within a date range, with full flexibility: limit, offset, detail, related data, etc.',
			inputSchema: {
				type: 'object',
				properties: {
					start_epoch: { type: 'number', description: 'Start of date range (epoch time, inclusive)' },
					end_epoch: { type: 'number', description: 'End of date range (epoch time, inclusive)' },
					limit: { type: 'number', description: 'Maximum number of articles to return', default: 10 },
					offset: { type: 'number', description: 'Number of articles to skip', default: 0 },
					detail: { type: 'string', enum: ['minimal', 'summary', 'full'], description: 'Level of detail', default: 'summary' },
					withRelated: { type: 'array', items: { type: 'string' }, description: 'Related data to include', optional: true },
					groupBy: { type: 'string', description: 'Group results by this field', optional: true },
					projection: { type: 'array', items: { type: 'string' }, description: 'Fields to include in result', optional: true },
				},
				required: ['start_epoch', 'end_epoch'],
			},
		},
		{
			name: 'flexible_document_by_key',
			description: 'Fetch a single document by its key or _id, with full flexibility: detail, related data, projection, etc.',
			inputSchema: {
				type: 'object',
				properties: {
					key: { type: 'string', description: 'Document _key or _id' },
					detail: { type: 'string', enum: ['minimal', 'summary', 'full'], description: 'Level of detail', default: 'full' },
					withRelated: { type: 'array', items: { type: 'string' }, description: 'Related data to include', optional: true },
					projection: { type: 'array', items: { type: 'string' }, description: 'Fields to include in result', optional: true },
				},
				required: ['key'],
			},
		},
		{
			name: 'flexible_documents_by_date_range',
			description: 'Return documents published within a date range, with full flexibility: limit, offset, detail, related data, etc.',
			inputSchema: {
				type: 'object',
				properties: {
					start_epoch: { type: 'number', description: 'Start of date range (epoch time, inclusive)' },
					end_epoch: { type: 'number', description: 'End of date range (epoch time, inclusive)' },
					limit: { type: 'number', description: 'Maximum number of documents to return', default: 10 },
					offset: { type: 'number', description: 'Number of documents to skip', default: 0 },
					detail: { type: 'string', enum: ['minimal', 'summary', 'full'], description: 'Level of detail', default: 'summary' },
					withRelated: { type: 'array', items: { type: 'string' }, description: 'Related data to include', optional: true },
					groupBy: { type: 'string', description: 'Group results by this field', optional: true },
					projection: { type: 'array', items: { type: 'string' }, description: 'Fields to include in result', optional: true },
				},
				required: ['start_epoch', 'end_epoch'],
			},
		},
		{
			name: 'flexible_fulltext_search_documents',
			description: 'Search documents by text in title, description, or content, with full flexibility: pagination, detail, related data, etc.',
			inputSchema: {
				type: 'object',
				properties: {
					query: { type: 'string', description: 'Text to search for' },
					limit: { type: 'number', description: 'Maximum number of documents to return', default: 10 },
					offset: { type: 'number', description: 'Number of documents to skip', default: 0 },
					detail: { type: 'string', enum: ['minimal', 'summary', 'full'], description: 'Level of detail', default: 'summary' },
					withRelated: { type: 'array', items: { type: 'string' }, description: 'Related data to include', optional: true },
					groupBy: { type: 'string', description: 'Group results by this field', optional: true },
					projection: { type: 'array', items: { type: 'string' }, description: 'Fields to include in result', optional: true },
				},
				required: ['query'],
			},
		},
		{
			name: 'flexible_list_document_authors',
			description: 'List unique authors from the Document collection, with flexible limit, offset, grouping, etc.',
			inputSchema: {
				type: 'object',
				properties: {
					limit: { type: 'number', description: 'Maximum number of authors to return', default: 100 },
					offset: { type: 'number', description: 'Number of authors to skip', default: 0 },
					document_key: { type: 'string', description: 'If provided, only authors of this document', optional: true },
					groupBy: { type: 'string', description: 'Group authors by this field', optional: true },
				},
				required: [],
			},
		},
		{
			name: 'flexible_list_document_categories',
			description: 'List unique categories and subcategories from the Document collection, with flexible limit, offset, grouping, etc.',
			inputSchema: {
				type: 'object',
				properties: {
					limit: { type: 'number', description: 'Maximum number of categories to return', default: 100 },
					offset: { type: 'number', description: 'Number of categories to skip', default: 0 },
					document_key: { type: 'string', description: 'If provided, only categories of this document', optional: true },
					groupBy: { type: 'string', description: 'Group categories by this field', optional: true },
				},
				required: [],
			},
		},
		{
			name: 'get_document_edges',
			description: 'Return all edges connected to a given Document (by _id or _key), including the connected node\'s collection and id.',
			inputSchema: {
				type: 'object',
				properties: {
					document_id: { type: 'string', description: 'Document _id or _key' },
					limit: { type: 'number', description: 'Maximum number of edges to return', default: 20 },
				},
				required: ['document_id'],
			},
		},
		{
			name: 'get_live_utc_date',
			description: 'Fetch the current live UTC date and time from a free online API.',
			inputSchema: {
				type: 'object',
				properties: {},
				required: []
			},
		},
		{
			name: 'get_system_time',
			description: 'Return the current system/server time in ISO 8601 format (from the server running the MCP instance).',
			inputSchema: {
				type: 'object',
				properties: {},
				required: []
			},
		},
	];
}

export enum API_TOOLS {
	QUERY = 'arango_query',
	INSERT = 'arango_insert',
	UPDATE = 'arango_update',
	REMOVE = 'arango_remove',
	BACKUP = 'arango_backup',
	COLLECTIONS = 'arango_list_collections',
	CREATE_COLLECTION = 'arango_create_collection',
}
