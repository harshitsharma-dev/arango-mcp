import { ErrorCode, McpError, Request, Tool } from '@modelcontextprotocol/sdk/types.js';
import { Database } from 'arangojs';
import { CollectionStatus, CollectionType, CreateCollectionOptions } from 'arangojs/collection';
import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { API_TOOLS } from './tools.js';
import {
    BackupArgs,
    CollectionDocumentArgs,
    CollectionKeyArgs,
    CreateCollectionArgs,
    QueryArgs,
    UpdateDocumentArgs,
    GetCrlrRelatedArticlesUnsetArgs,
    GetCrlrRelatedArticlesArgs,
    GetPathRelatedArticlesUnsetArgs,
    GetPathRelatedArticlesArgs,
    GetRelatedArticlesGraphArgs,
    GetCrlrRelatedDocsArgs,
    GetPathRelatedDocsArgs
} from './types.js';

const PARALLEL_BACKUP_CHUNKS = 5;

export class ToolHandlers {
	constructor(private db: Database, private tools: Tool[], private ensureConnection: () => Promise<void>) {}

	async handleListTools() {
        console.log('[MCP] handleListTools called');
        return {
            tools: this.tools
        };
    }

	async handleCallTool(request: Request) {
		try {
			await this.ensureConnection();

			switch (request.params?.name) {
				case API_TOOLS.QUERY: {
					const args = request.params.arguments as QueryArgs;
					try {
						const cursor = await this.db.query(args.query, args.bindVars || {});
						const result = await cursor.all();
						return {
							content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
						};
					} catch (error) {
						throw new McpError(ErrorCode.InvalidRequest, `Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
					}
				}

				case API_TOOLS.INSERT: {
					const args = request.params.arguments as CollectionDocumentArgs;
					try {
						const coll = this.db.collection(args.collection);
						const result = await coll.save(args.document);
						return {
							content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
						};
					} catch (error) {
						throw new McpError(ErrorCode.InvalidRequest, `Insert operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
					}
				}

				case API_TOOLS.UPDATE: {
					const args = request.params.arguments as UpdateDocumentArgs;
					try {
						const coll = this.db.collection(args.collection);
						const result = await coll.update(args.key, args.update);
						return {
							content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
						};
					} catch (error) {
						throw new McpError(ErrorCode.InvalidRequest, `Update operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
					}
				}

				case API_TOOLS.REMOVE: {
					const args = request.params.arguments as CollectionKeyArgs;
					try {
						const coll = this.db.collection(args.collection);
						const result = await coll.remove(args.key);
						return {
							content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
						};
					} catch (error) {
						throw new McpError(ErrorCode.InvalidRequest, `Remove operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
					}
				}

				case API_TOOLS.COLLECTIONS: {
					try {
						const collections = await this.db.listCollections();
						return {
							content: [{ type: 'text', text: JSON.stringify(collections, null, 2) }],
						};
					} catch (error) {
						throw new McpError(ErrorCode.InternalError, `Failed to list collections: ${error instanceof Error ? error.message : 'Unknown error'}`);
					}
				}

				case API_TOOLS.CREATE_COLLECTION: {
					const args = request.params.arguments as CreateCollectionArgs;
					try {
						const options: CreateCollectionOptions & { type?: CollectionType } = {
							waitForSync: args.waitForSync || false,
						};

						// Map string type to CollectionType enum
						if (args.type === 'edge') {
							options.type = CollectionType.EDGE_COLLECTION;
						} else {
							// Default to document collection
							options.type = CollectionType.DOCUMENT_COLLECTION;
						}

						const collection = await this.db.createCollection(
							args.name,
							options as CreateCollectionOptions & {
								type: typeof options.type extends CollectionType.EDGE_COLLECTION ? CollectionType.EDGE_COLLECTION : CollectionType.DOCUMENT_COLLECTION;
							},
						);

						// Return a simplified response without circular references
						const properties = await collection.properties();
						const response = {
							name: collection.name,
							indexes: collection.indexes(),
							type: CollectionType[properties.type],
							status: CollectionStatus[properties.status],
						};

						return {
							content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
						};
					} catch (error) {
						throw new McpError(ErrorCode.InvalidRequest, `Failed to create collection: ${error instanceof Error ? error.message : 'Unknown error'}`);
					}
				}

				case API_TOOLS.BACKUP: {
					const args = request.params.arguments as BackupArgs;
					const outputDir = resolve(args.outputDir);
					const collection = args.collection;
					const docLimit = args.docLimit;

					try {
						await fs.mkdir(outputDir, { recursive: true, mode: 0o755 });
					} catch (error) {
						throw new McpError(ErrorCode.InternalError, `Failed to create backup directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
					}

					try {
						const results = [];
						async function backupCollection(db: Database, outputDir: string, collection?: string, docLimit?: number) {
							try {
								const cursor = await db.query({
									query: docLimit ? 'FOR doc IN @@collection LIMIT @limit RETURN doc' : 'FOR doc IN @@collection RETURN doc',
									bindVars: {
										'@collection': collection,
										...(docLimit && { limit: docLimit }),
									},
								});
								const data = await cursor.all();
								const filePath = join(outputDir, `${collection}.json`);
								await fs.writeFile(filePath, JSON.stringify(data, null, 2));
								return {
									collection,
									status: 'success',
									count: data.length,
									outputFile: filePath,
								};
							} catch (error) {
								return {
									collection,
									status: 'error',
									error: error instanceof Error ? error.message : 'Unknown error',
								};
							}
						}

						if (collection) {
							// Backup single collection
							console.info(`Backing up collection: ${collection}`);
							results.push(await backupCollection(this.db, outputDir, collection, docLimit));
						} else {
							// Backup all collections in parallel chunks
							const collections = await this.db.listCollections();
							console.info(`Found ${collections.length} collections to backup.`);

							// Process collections in chunks
							for (let i = 0; i < collections.length; i += PARALLEL_BACKUP_CHUNKS) {
								const chunk = collections.slice(i, i + PARALLEL_BACKUP_CHUNKS);
								const backupPromises = chunk.map((collection) => {
									console.info(`Backing up collection: ${collection.name}`);
									return backupCollection(this.db, outputDir, collection.name, docLimit);
								});

								// Wait for the current chunk to complete before processing the next
								const chunkResults = await Promise.all(backupPromises);
								results.push(...chunkResults);
							}
						}

						return {
							content: [
								{
									type: 'text',
									text: JSON.stringify(
										{
											status: 'completed',
											outputDirectory: outputDir,
											results,
										},
										null,
										2,
									),
								},
							],
						};
					} catch (error) {
						throw new McpError(ErrorCode.InternalError, `Backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
					}
				}

				// --- Custom ArangoDB advanced tools ---
				case 'get_crlr_related_articles_unset': {
					const args = request.params.arguments as GetCrlrRelatedArticlesUnsetArgs;
					const result = await getCrlrRelatedArticlesUnsetHandler(args);
					return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
				}
				case 'get_crlr_related_articles': {
					const args = request.params.arguments as GetCrlrRelatedArticlesArgs;
					const result = await getCrlrRelatedArticlesHandler(args);
					return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
				}
				case 'get_path_related_articles_unset': {
					const args = request.params.arguments as GetPathRelatedArticlesUnsetArgs;
					const result = await getPathRelatedArticlesUnsetHandler(args);
					return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
				}
				case 'get_path_related_articles': {
					const args = request.params.arguments as GetPathRelatedArticlesArgs;
					const result = await getPathRelatedArticlesHandler(args);
					return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
				}
				case 'get_related_articles_graph': {
					const args = request.params.arguments as GetRelatedArticlesGraphArgs;
					const result = await getRelatedArticlesGraphHandler(args);
					return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
				}
				case 'get_crlr_related_docs': {
					const args = request.params.arguments as GetCrlrRelatedDocsArgs;
					const result = await getCrlrRelatedDocsHandler(args);
					return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
				}
				case 'get_path_related_docs': {
					const args = request.params.arguments as GetPathRelatedDocsArgs;
					const result = await getPathRelatedDocsHandler(args);
					return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
				}
				case 'get_live_utc_date': {
					// Use a free online API to fetch the current IST date/time
					const https = await import('https');
					const getTime = () => new Promise((resolve, reject) => {
						https.get('https://worldtimeapi.org/api/timezone/Asia/Kolkata', (res) => {
							let data = '';
							res.on('data', chunk => data += chunk);
							res.on('end', () => {
								try {
									const json = JSON.parse(data);
									resolve(json.datetime || json.utc_datetime);
								} catch (e) {
									reject(e);
								}
							});
						}).on('error', reject);
					});
					const istDatetime = await getTime();
					return {
						content: [{ type: 'text', text: istDatetime }],
					};
				}
				case 'get_system_time': {
					// Use Python to get the current system time in ISO format
					const { execSync } = await import('child_process');
					try {
						const pyCode = "import datetime; print(datetime.datetime.now().isoformat())";
						const result = execSync(`python -c \"${pyCode}\"`).toString().trim();
						return {
							content: [{ type: 'text', text: result }],
						};
					} catch (e) {
						return {
							content: [{ type: 'text', text: 'Error fetching time from Python: ' + (e instanceof Error ? e.message : String(e)) }],
						};
					}
				}

				// --- Custom ArangoDB news/article tools ---
				case 'flexible_recent_articles': {
					const { limit = 10, offset = 0, sortBy = 'default.epoch_time', sortOrder = 'desc', detail = 'summary', withRelated = [], groupBy, projection } = request.params.arguments as any;
					let proj = 'article';
					if (projection && projection.length > 0) {
						proj = `{ ${projection.map((f: string) => f + ': article.' + f).join(', ')} }`;
					} else if (detail === 'minimal') {
						proj = '{_key: article._key, title: article.default.title}';
					} else if (detail === 'summary') {
						proj = '{_key: article._key, title: article.default.title, summary: article.default_summary}';
					}
					const cursor = await this.db.query(
						`FOR article IN Article SORT article.${sortBy} ${sortOrder.toUpperCase()} LIMIT @offset, @limit RETURN ${proj}`,
						{ limit, offset }
					);
					let result = await cursor.all();
					// Optionally group results
					if (groupBy) {
						result = result.reduce((acc, item) => {
							const key = item[groupBy];
							if (!acc[key]) acc[key] = [];
							acc[key].push(item);
							return acc;
						}, {});
					}
					// Optionally add related data (stub, can be expanded)
					// ...
					return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
				}
				case 'flexible_search_articles_by_category': {
					const { category, subcategory, limit = 10, offset = 0, sortBy = 'default.epoch_time', sortOrder = 'desc', detail = 'summary', withRelated = [], groupBy, projection } = request.params.arguments as any;
					let filter = '@category IN article.category';
					if (subcategory) filter += ' && @subcategory IN article.subcategory';
					let proj = 'article';
					if (projection && projection.length > 0) {
						proj = `{ ${projection.map((f: string) => f + ': article.' + f).join(', ')} }`;
					} else if (detail === 'minimal') {
						proj = '{_key: article._key, title: article.default.title}';
					} else if (detail === 'summary') {
						proj = '{_key: article._key, title: article.default.title, summary: article.default_summary}';
					}
					const query = `FOR article IN Article FILTER ${filter} SORT article.${sortBy} ${sortOrder.toUpperCase()} LIMIT @offset, @limit RETURN ${proj}`;
					const cursor = await this.db.query(query, { category, subcategory, limit, offset });
					let result = await cursor.all();
					if (groupBy) {
						result = result.reduce((acc, item) => {
							const key = item[groupBy];
							if (!acc[key]) acc[key] = [];
							acc[key].push(item);
							return acc;
						}, {});
					}
					// ...withRelated stub...
					return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
				}
				case 'flexible_search_articles_by_author': {
					const { author, limit = 10, offset = 0, sortBy = 'default.epoch_time', sortOrder = 'desc', detail = 'summary', withRelated = [], groupBy, projection } = request.params.arguments as any;
					let proj = 'article';
					if (projection && projection.length > 0) {
						proj = `{ ${projection.map((f: string) => f + ': article.' + f).join(', ')} }`;
					} else if (detail === 'minimal') {
						proj = '{_key: article._key, title: article.default.title}';
					} else if (detail === 'summary') {
						proj = '{_key: article._key, title: article.default.title, summary: article.default_summary}';
					}
					const cursor = await this.db.query(
						`FOR article IN Article FILTER article.author == @author SORT article.${sortBy} ${sortOrder.toUpperCase()} LIMIT @offset, @limit RETURN ${proj}`,
						{ author, limit, offset }
					);
					let result = await cursor.all();
					if (groupBy) {
						result = result.reduce((acc, item) => {
							const key = item[groupBy];
							if (!acc[key]) acc[key] = [];
							acc[key].push(item);
							return acc;
						}, {});
					}
					// ...withRelated stub...
					return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
				}
				case 'flexible_fulltext_search_articles': {
					const { query: search, limit = 10, offset = 0, detail = 'summary', withRelated = [], groupBy, projection } = request.params.arguments as any;
					let proj = 'article';
					if (projection && projection.length > 0) {
						proj = `{ ${projection.map((f: string) => f + ': article.' + f).join(', ')} }`;
					} else if (detail === 'minimal') {
						proj = '{_key: article._key, title: article.default.title}';
					} else if (detail === 'summary') {
						proj = '{_key: article._key, title: article.default.title, summary: article.default_summary}';
					}
					const cursor = await this.db.query(
						`FOR article IN Article FILTER CONTAINS(LOWER(article.default.title), LOWER(@search)) || CONTAINS(LOWER(article.default_summary), LOWER(@search)) || (HAS(article, 'description') && CONTAINS(LOWER(article.description), LOWER(@search))) LIMIT @offset, @limit RETURN ${proj}`,
						{ search, limit, offset }
					);
					let result = await cursor.all();
					if (groupBy) {
						result = result.reduce((acc, item) => {
							const key = item[groupBy];
							if (!acc[key]) acc[key] = [];
							acc[key].push(item);
							return acc;
						}, {});
					}
					// ...withRelated stub...
					return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
				}
				case 'flexible_paginated_article_list': {
					const { limit = 10, offset = 0, sortBy = 'default.epoch_time', sortOrder = 'desc', detail = 'summary', withRelated = [], groupBy, projection } = request.params.arguments as any;
					let proj = 'article';
					if (projection && projection.length > 0) {
						proj = `{ ${projection.map((f: string) => f + ': article.' + f).join(', ')} }`;
					} else if (detail === 'minimal') {
						proj = '{_key: article._key, title: article.default.title}';
					} else if (detail === 'summary') {
						proj = '{_key: article._key, title: article.default.title, summary: article.default_summary}';
					}
					const cursor = await this.db.query(
						`FOR article IN Article SORT article.${sortBy} ${sortOrder.toUpperCase()} LIMIT @offset, @limit RETURN ${proj}`,
						{ limit, offset }
					);
					let result = await cursor.all();
					if (groupBy) {
						result = result.reduce((acc, item) => {
							const key = item[groupBy];
							if (!acc[key]) acc[key] = [];
							acc[key].push(item);
							return acc;
						}, {});
					}
					// ...withRelated stub...
					return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
				}
				case 'flexible_article_by_key': {
					const { key, detail = 'full', withRelated = [], projection } = request.params.arguments as any;
					let proj = 'article';
					if (projection && projection.length > 0) {
						proj = `{ ${projection.map((f: string) => f + ': article.' + f).join(', ')} }`;
					} else if (detail === 'minimal') {
						proj = '{_key: article._key, title: article.default.title}';
					} else if (detail === 'summary') {
						proj = '{_key: article._key, title: article.default.title, summary: article.default_summary}';
					}
					let query;
					if (key.includes('/')) {
						query = `FOR article IN Article FILTER article._id == @key LIMIT 1 RETURN ${proj}`;
					} else {
						query = `FOR article IN Article FILTER article._key == @key LIMIT 1 RETURN ${proj}`;
					}
					const cursor = await this.db.query(query, { key });
					let result = await cursor.all();
					result = result[0] || null;
					// ...withRelated stub...
					return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
				}
				case 'flexible_list_all_categories': {
					const { limit = 100, offset = 0, article_key, groupBy } = request.params.arguments as any;
					let catQuery, subcatQuery, bindVars;
					if (article_key) {
						catQuery = `FOR article IN Article FILTER article._key == @article_key FOR cat IN article.category COLLECT category = cat INTO g LIMIT @offset, @limit RETURN DISTINCT category`;
						subcatQuery = `FOR article IN Article FILTER article._key == @article_key FOR subcat IN article.subcategory COLLECT subcategory = subcat INTO g LIMIT @offset, @limit RETURN DISTINCT subcategory`;
						bindVars = { article_key, limit, offset };
					} else {
						catQuery = `FOR article IN Article FOR cat IN article.category COLLECT category = cat INTO g LIMIT @offset, @limit RETURN DISTINCT category`;
						subcatQuery = `FOR article IN Article FOR subcat IN article.subcategory COLLECT subcategory = subcat INTO g LIMIT @offset, @limit RETURN DISTINCT subcategory`;
						bindVars = { limit, offset };
					}
					const catCursor = await this.db.query(catQuery, bindVars);
					let categories = await catCursor.all();
					const subcatCursor = await this.db.query(subcatQuery, bindVars);
					let subcategories = await subcatCursor.all();
					if (groupBy) {
						categories = categories.reduce((acc, item) => {
							const key = item[groupBy];
							if (!acc[key]) acc[key] = [];
							acc[key].push(item);
							return acc;
						}, {});
						subcategories = subcategories.reduce((acc, item) => {
							const key = item[groupBy];
							if (!acc[key]) acc[key] = [];
							acc[key].push(item);
							return acc;
						}, {});
					}
					return { content: [{ type: 'text', text: JSON.stringify({ categories, subcategories }, null, 2) }] };
				}
				case 'flexible_list_authors': {
					const { limit = 100, offset = 0, article_key, groupBy } = request.params.arguments as any;
					let query, bindVars;
					if (article_key) {
						query = `FOR article IN Article FILTER article._key == @article_key && HAS(article, 'author') && article.author != null COLLECT author = article.author INTO g LIMIT @offset, @limit RETURN DISTINCT author`;
						bindVars = { article_key, limit, offset };
					} else {
						query = `FOR article IN Article FILTER HAS(article, 'author') && article.author != null COLLECT author = article.author INTO g LIMIT @offset, @limit RETURN DISTINCT author`;
						bindVars = { limit, offset };
					}
					const cursor = await this.db.query(query, bindVars);
					let authors = await cursor.all();
					if (groupBy) {
						authors = authors.reduce((acc, item) => {
							const key = item[groupBy];
							if (!acc[key]) acc[key] = [];
							acc[key].push(item);
							return acc;
						}, {});
					}
					return { content: [{ type: 'text', text: JSON.stringify(authors, null, 2) }] };
				}
				case 'flexible_articles_by_entity': {
					const { entity, limit = 10, offset = 0, detail = 'summary', withRelated = [], groupBy, projection } = request.params.arguments as any;
					let proj = 'article';
					if (projection && projection.length > 0) {
						proj = `{ ${projection.map((f: string) => f + ': article.' + f).join(', ')} }`;
					} else if (detail === 'minimal') {
						proj = '{_key: article._key, title: article.default.title}';
					} else if (detail === 'summary') {
						proj = '{_key: article._key, title: article.default.title, summary: article.default_summary}';
					}
					const cursor = await this.db.query(
						`LET entityDoc = FIRST(FOR e IN Entity FILTER e._key == @entity OR e.name == @entity RETURN e)
                         FOR edge IN article_entities FILTER edge._to == CONCAT('Entity/', entityDoc._key)
                         FOR article IN Article FILTER article._id == edge._from
                         SORT article.default.epoch_time DESC LIMIT @offset, @limit RETURN ${proj}`,
						{ entity, limit, offset }
					);
					let result = await cursor.all();
					if (groupBy) {
						result = result.reduce((acc, item) => {
							const key = item[groupBy];
							if (!acc[key]) acc[key] = [];
							acc[key].push(item);
							return acc;
						}, {});
					}
					// ...withRelated stub...
					return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
				}
				case 'flexible_articles_by_date_range': {
					const { start_epoch, end_epoch, limit = 10, offset = 0, detail = 'summary', withRelated = [], groupBy, projection } = request.params.arguments as any;
					let proj = 'article';
					if (projection && projection.length > 0) {
						proj = `{ ${projection.map((f: string) => f + ': article.' + f).join(', ')} }`;
					} else if (detail === 'minimal') {
						proj = '{_key: article._key, title: article.default.title}';
					} else if (detail === 'summary') {
						proj = '{_key: article._key, title: article.default.title, summary: article.default_summary}';
					}
					const cursor = await this.db.query(
						`FOR article IN Article FILTER article.default.epoch_time >= @start_epoch && article.default.epoch_time <= @end_epoch SORT article.default.epoch_time DESC LIMIT @offset, @limit RETURN ${proj}`,
						{ start_epoch, end_epoch, limit, offset }
					);
					let result = await cursor.all();
					if (groupBy) {
						result = result.reduce((acc, item) => {
							const key = item[groupBy];
							if (!acc[key]) acc[key] = [];
							acc[key].push(item);
							return acc;
						}, {});
					}
					// ...withRelated stub...
					return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
				}

				// --- Custom ArangoDB Document tools ---
				case 'flexible_document_by_key': {
					const { key, detail = 'full', withRelated = [], projection } = request.params.arguments as any;
					let proj = 'doc';
					if (projection && projection.length > 0) {
						proj = `{ ${projection.map((f: string) => f + ': doc.' + f).join(', ')} }`;
					} else if (detail === 'minimal') {
						proj = '{_key: doc._key, title: doc.title}';
					} else if (detail === 'summary') {
						proj = '{_key: doc._key, title: doc.title, description: doc.description}';
					}
					let query;
					if (key.includes('/')) {
						query = `FOR doc IN Document FILTER doc._id == @key LIMIT 1 RETURN ${proj}`;
					} else {
						query = `FOR doc IN Document FILTER doc._key == @key LIMIT 1 RETURN ${proj}`;
					}
					const cursor = await this.db.query(query, { key });
					let result = await cursor.all();
					result = result[0] || null;
					// ...withRelated stub...
					return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
				}
				case 'flexible_documents_by_date_range': {
					const { start_epoch, end_epoch, limit = 10, offset = 0, detail = 'summary', withRelated = [], groupBy, projection } = request.params.arguments as any;
					let proj = 'doc';
					if (projection && projection.length > 0) {
						proj = `{ ${projection.map((f: string) => f + ': doc.' + f).join(', ')} }`;
					} else if (detail === 'minimal') {
						proj = '{_key: doc._key, title: doc.title}';
					} else if (detail === 'summary') {
						proj = '{_key: doc._key, title: doc.title, description: doc.description}';
					}
					const cursor = await this.db.query(
						`FOR doc IN Document FILTER doc.epoch_published >= @start_epoch && doc.epoch_published <= @end_epoch SORT doc.epoch_published DESC LIMIT @offset, @limit RETURN ${proj}`,
						{ start_epoch, end_epoch, limit, offset }
					);
					let result = await cursor.all();
					if (groupBy) {
						result = result.reduce((acc, item) => {
							const key = item[groupBy];
							if (!acc[key]) acc[key] = [];
							acc[key].push(item);
							return acc;
						}, {});
					}
					// ...withRelated stub...
					return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
				}
				case 'flexible_fulltext_search_documents': {
					const { query: search, limit = 10, offset = 0, detail = 'summary', withRelated = [], groupBy, projection } = request.params.arguments as any;
					let proj = 'doc';
					if (projection && projection.length > 0) {
						proj = `{ ${projection.map((f: string) => f + ': doc.' + f).join(', ')} }`;
					} else if (detail === 'minimal') {
						proj = '{_key: doc._key, title: doc.title}';
					} else if (detail === 'summary') {
						proj = '{_key: doc._key, title: doc.title, description: doc.description}';
					}
					const cursor = await this.db.query(
						`FOR doc IN Document FILTER CONTAINS(LOWER(doc.title), LOWER(@search)) || CONTAINS(LOWER(doc.description), LOWER(@search)) || CONTAINS(LOWER(doc.content), LOWER(@search)) LIMIT @offset, @limit RETURN ${proj}`,
						{ search, limit, offset }
					);
					let result = await cursor.all();
					if (groupBy) {
						result = result.reduce((acc, item) => {
							const key = item[groupBy];
							if (!acc[key]) acc[key] = [];
							acc[key].push(item);
							return acc;
						}, {});
					}
					// ...withRelated stub...
					return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
				}
				case 'flexible_list_document_authors': {
					const { limit = 100, offset = 0, document_key, groupBy } = request.params.arguments as any;
					let query, bindVars;
					if (document_key) {
						query = `FOR doc IN Document FILTER doc._key == @document_key && HAS(doc, 'author') && doc.author != null COLLECT author = doc.author INTO g LIMIT @offset, @limit RETURN DISTINCT author`;
						bindVars = { document_key, limit, offset };
					} else {
						query = `FOR doc IN Document FILTER HAS(doc, 'author') && doc.author != null COLLECT author = doc.author INTO g LIMIT @offset, @limit RETURN DISTINCT author`;
						bindVars = { limit, offset };
					}
					const cursor = await this.db.query(query, bindVars);
					let authors = await cursor.all();
					if (groupBy) {
						authors = authors.reduce((acc, item) => {
							const key = item[groupBy];
							if (!acc[key]) acc[key] = [];
							acc[key].push(item);
							return acc;
						}, {});
					}
					return { content: [{ type: 'text', text: JSON.stringify(authors, null, 2) }] };
				}
				case 'flexible_list_document_categories': {
					const { limit = 100, offset = 0, document_key, groupBy } = request.params.arguments as any;
					let catQuery, subcatQuery, bindVars;
					if (document_key) {
						catQuery = `FOR doc IN Document FILTER doc._key == @document_key FOR cat IN doc.category COLLECT category = cat INTO g LIMIT @offset, @limit RETURN DISTINCT category`;
						subcatQuery = `FOR doc IN Document FILTER doc._key == @document_key FOR subcat IN doc.subcategory COLLECT subcategory = subcat INTO g LIMIT @offset, @limit RETURN DISTINCT subcategory`;
						bindVars = { document_key, limit, offset };
					} else {
						catQuery = `FOR doc IN Document FOR cat IN doc.category COLLECT category = cat INTO g LIMIT @offset, @limit RETURN DISTINCT category`;
						subcatQuery = `FOR doc IN Document FOR subcat IN doc.subcategory COLLECT subcategory = subcat INTO g LIMIT @offset, @limit RETURN DISTINCT subcategory`;
						bindVars = { limit, offset };
					}
					const catCursor = await this.db.query(catQuery, bindVars);
					let categories = await catCursor.all();
					const subcatCursor = await this.db.query(subcatQuery, bindVars);
					let subcategories = await subcatCursor.all();
					if (groupBy) {
						categories = categories.reduce((acc, item) => {
							const key = item[groupBy];
							if (!acc[key]) acc[key] = [];
							acc[key].push(item);
							return acc;
						}, {});
						subcategories = subcategories.reduce((acc, item) => {
							const key = item[groupBy];
							if (!acc[key]) acc[key] = [];
							acc[key].push(item);
							return acc;
						}, {});
					}
					return { content: [{ type: 'text', text: JSON.stringify({ categories, subcategories }, null, 2) }] };
				}
				case 'get_document_edges': {
					const { document_id, limit = 20 } = request.params.arguments as any;
					// Accept both _id and _key
					let docId = document_id;
					if (!docId.includes('/')) docId = `Document/${docId}`;
					// Search all edge collections for edges connected to this Document
					const edgeCollections = ['edges', 'closeness', 'connections'];
					let allEdges: any[] = [];
					for (const coll of edgeCollections) {
						const cursor = await this.db.query(
							`FOR edge IN ${coll} FILTER edge._from == @docId OR edge._to == @docId LIMIT @limit RETURN MERGE(edge, { _edgeCollection: '${coll}' })`,
							{ docId, limit }
						);
						const edges: any[] = await cursor.all();
						allEdges = allEdges.concat(edges);
					}
					return { content: [{ type: 'text', text: JSON.stringify(allEdges, null, 2) }] };
				}

				default:
					throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params?.name}`);
			}
		} catch (error: unknown) {
			if (error instanceof McpError) throw error;

			// Check if it's a connection error
			if (error instanceof Error && error.message.includes('connect')) {
				throw new McpError(ErrorCode.InternalError, `Database connection lost: ${error.message}`);
			}

			throw new McpError(ErrorCode.InternalError, `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}
}

// Handler for get_crlr_related_articles_unset
async function getCrlrRelatedArticlesUnsetHandler(args: GetCrlrRelatedArticlesUnsetArgs) {
    const { articleKey, graphDepth, edgeCollectionName, simThreshold, dbUrl } = args;
    const db = new Database({ url: dbUrl });
    const adb = db.database('newsDB2022');
    adb.useBasicAuth('root', 'i-0172f1f969c7548c4');
    const query = `FOR article IN Article FILTER article._key==@key FOR v,e,p IN @depth OUTBOUND article GRAPH 'newsGraph' FILTER SPLIT(e._id,'/')[0]==@edgeColl && v._id!=article._id FILTER e.sim_value<@sim_threshold RETURN DISTINCT {articleID:v._key,category:v.category,subcategory:v.subcategory,default:UNSET(v.default,'description','docID','image','summary','url'),default_image:v.default_image,read:[UNSET(v.read[0],'description','docID','image','summary','url')],watch:[UNSET(v.watch[0],'description','image','url','videoID')],tag:v.source_tags[0]}`;
    const cursor = await adb.query(query, { key: articleKey, depth: graphDepth, edgeColl: edgeCollectionName, sim_threshold: simThreshold });
    return await cursor.all();
}

// Handler for get_crlr_related_articles
async function getCrlrRelatedArticlesHandler(args: GetCrlrRelatedArticlesArgs) {
    const { articleKey, graphDepth, edgeCollectionName, simThreshold, dbUrl } = args;
    const db = new Database({ url: dbUrl });
    const adb = db.database('newsDB2022');
    adb.useBasicAuth('root', 'i-0172f1f969c7548c4');
    const query = `FOR article IN Article FILTER article._key==@key FOR v,e,p IN @depth OUTBOUND article GRAPH 'newsGraph' FILTER SPLIT(e._id,'/')[0]==@edgeColl && v._id!=article._id FILTER e.sim_value<@sim_threshold RETURN DISTINCT {articleID:v._key,category:v.category,subcategory:v.subcategory,default:v.default,default_image:v.default_image,read:[v.read[0]],watch:[v.watch[0]],source_tags:v.source_tags}`;
    const cursor = await adb.query(query, { key: articleKey, depth: graphDepth, edgeColl: edgeCollectionName, sim_threshold: simThreshold });
    return await cursor.all();
}

// Handler for get_path_related_articles_unset
async function getPathRelatedArticlesUnsetHandler(args: GetPathRelatedArticlesUnsetArgs) {
    const { articleKey, graphDepth, limit, dbUrl, epochtime } = args;
    const db = new Database({ url: dbUrl });
    const adb = db.database('newsDB2022');
    adb.useBasicAuth('root', 'i-0172f1f969c7548c4');
    const query = `LET epochtime_8hours=@epochtime FOR article IN Article FILTER article._key==@key LET query_epochtime=article.default.epoch_time LET related_docs=(FOR doc IN Document FILTER doc.url==article.default.url FOR v1,e1,p1 IN @depth OUTBOUND doc GRAPH 'newsGraph' FILTER e1.ne_tf>0 || e1.np_tf>0 || e1.ep_tf>0 FOR v2,e2,p2 IN @depth INBOUND v1 GRAPH 'newsGraph' FILTER v2._id!=doc._id && v2.source==doc.source COLLECT target_url=p2.vertices[1]['url'] WITH COUNT INTO no_of_paths SORT no_of_paths DESC LIMIT @limit RETURN {'url':target_url,'no_of_paths':no_of_paths}) FOR doc1 IN related_docs FOR article1 IN Article FILTER article1.default.url==doc1.url FILTER to_number(article1.default.epoch_time) > (to_number(query_epochtime)-to_number(epochtime_8hours)) && to_number(article1.default.epoch_time) < (to_number(query_epochtime)+to_number(epochtime_8hours)) SORT doc1.no_of_paths DESC RETURN {'articleID':article1._key,'category':article1.category,'subcategory':article1.subcategory,'default':UNSET(article1.default,'description','docID','image','summary','url'),'default_image':article1.default_image,'read':[UNSET(article1.read[0],'description','docID','image','summary','url')],'watch':[UNSET(article1.watch[0],'description','image','url','videoID')],'tag':article1.source_tags[0]}`;
    const cursor = await adb.query(query, { key: articleKey, depth: graphDepth, limit, epochtime });
    return await cursor.all();
}

// Handler for get_path_related_articles
async function getPathRelatedArticlesHandler(args: GetPathRelatedArticlesArgs) {
    const { dbUrl, traversalDepth, qaCategory, qaKey, thresholdEpochtime, noOfResults, ipOrigin } = args;
    const db = new Database({ url: dbUrl });
    const adb = db.database('newsDB2022');
    adb.useBasicAuth('root', 'i-0172f1f969c7548c4');
    let query, bindVars;
    if (ipOrigin) {
        query = `LET graph_rel_articles=(FOR article IN Article FILTER article._key==@articlekey FOR v,e,p IN @depth ANY article GRAPH 'newsGraph' FILTER length(intersection(@iporigin,e.origin))>0 && @cat IN v.category && v._key!=@articlekey && (to_number(v.default.epoch_time)>(to_number(article.default.epoch_time)-to_number(@threshold_epochtime)) && to_number(v.default.epoch_time)<(to_number(article.default.epoch_time)+to_number(@threshold_epochtime))) COLLECT aid=v._id WITH COUNT INTO no_of_paths RETURN DISTINCT {'aid':aid,'no_of_paths':no_of_paths}) FOR relart IN graph_rel_articles SORT relart.no_of_paths DESC FOR article IN Article FILTER article._id==relart.aid LIMIT @limit RETURN {'article':article,'no_of_paths':relart.no_of_paths}`;
        bindVars = { depth: traversalDepth, cat: qaCategory, articlekey: qaKey, threshold_epochtime: thresholdEpochtime, limit: noOfResults, iporigin: ipOrigin };
    } else {
        query = `LET graph_rel_articles=(FOR article IN Article FILTER article._key==@articlekey FOR v,e,p IN @depth ANY article GRAPH 'newsGraph' LET iporigin=e.origin FILTER iporigin!=null && iporigin!=[] && length(intersection(iporigin,e.origin))>0 && @cat IN v.category && v._key!=@articlekey && (to_number(v.default.epoch_time)>(to_number(article.default.epoch_time)-to_number(@threshold_epochtime)) && to_number(v.default.epoch_time)<(to_number(article.default.epoch_time)+to_number(@threshold_epochtime))) COLLECT aid=v._id WITH COUNT INTO no_of_paths RETURN DISTINCT {'aid':aid,'no_of_paths':no_of_paths}) FOR relart IN graph_rel_articles SORT relart.no_of_paths DESC FOR article IN Article FILTER article._id==relart.aid LIMIT @limit RETURN {'article':article,'no_of_paths':relart.no_of_paths}`;
        bindVars = { depth: traversalDepth, cat: qaCategory, articlekey: qaKey, threshold_epochtime: thresholdEpochtime, limit: noOfResults };
    }
    const cursor = await adb.query(query, bindVars);
    const related_articles = await cursor.all();
    // Format output as in Python
    return related_articles.map(resultobj => {
        const articleobj = resultobj.article;
        return {
            articleID: articleobj._key,
            category: articleobj.category,
            subcategory: articleobj.subcategory,
            default: articleobj.default,
            default_image: articleobj.default_image,
            read: [articleobj.read?.[0]],
            watch: [articleobj.watch?.[0]],
            source_tags: articleobj.source_tags,
            no_of_paths: resultobj.no_of_paths
        };
    });
}

// Handler for get_related_articles_graph
async function getRelatedArticlesGraphHandler(args: GetRelatedArticlesGraphArgs) {
    const { dbUrl, qaTopterms, qaKey, traversalDepth, qaEpochtime, qaCategory, thresholdEpochtime } = args;
    const db = new Database({ url: dbUrl });
    const adb = db.database('newsDB2022');
    adb.useBasicAuth('root', 'i-0172f1f969c7548c4');
    const query = `FOR term IN @top_terms FOR entity IN Entity FILTER entity.name==term FOR v,e,p IN @depth INBOUND entity GRAPH 'articleGraph' FILTER @cat IN v.category FILTER v._key!=@articlekey && (to_number(v.default.epoch_time)>(to_number(@query_epochtime)-to_number(@threshold_epochtime)) && to_number(v.default.epoch_time)<(to_number(@query_epochtime)+to_number(@threshold_epochtime))) RETURN DISTINCT {articleID:v._key,category:v.category,subcategory:v.subcategory,default:v.default,default_image:v.default_image,read:[v.read[0]],watch:[v.watch[0]],source_tags:v.source_tags}`;
    const cursor = await adb.query(query, { top_terms: qaTopterms, depth: traversalDepth, cat: qaCategory, articlekey: qaKey, query_epochtime: qaEpochtime, threshold_epochtime: thresholdEpochtime });
    return await cursor.all();
}

// Handler for get_crlr_related_docs
async function getCrlrRelatedDocsHandler(args: GetCrlrRelatedDocsArgs) {
    const { dbUrl, docUrl, searchDepth, edgeCollName } = args;
    const db = new Database({ url: dbUrl });
    const adb = db.database('newsDB2022');
    adb.useBasicAuth('root', 'i-0172f1f969c7548c4');
    const query = `LET qarticle=(FOR article IN Article LET readobj=article.read LET readurls=(FOR read IN readobj RETURN read.url) FILTER @url IN readurls RETURN article) LET related_articles=(FOR article1 IN Article FILTER article1._id==qarticle[0]['_id'] FOR v,e,p IN @depth ANY article1 GRAPH 'newsGraph' FILTER SPLIT(e._id,'/')[0]==@edgeColl && v._id!=article1._id RETURN v) RETURN {'qarticle':qarticle,'related_articles':related_articles}`;
    const cursor = await adb.query(query, { url: docUrl, depth: searchDepth, edgeColl: edgeCollName });
    const result = await cursor.all();
    if (result.length > 0) {
        return { query_article: result[0].qarticle, related_articles: result[0].related_articles };
    }
    return { query_article: [], related_articles: [] };
}

// Handler for get_path_related_docs
async function getPathRelatedDocsHandler(args: GetPathRelatedDocsArgs) {
    const { dbUrl, queryArticleId, searchDepth, edgeCollName, noOfResults } = args;
    const db = new Database({ url: dbUrl });
    const adb = db.database('newsDB2022');
    adb.useBasicAuth('root', 'i-0172f1f969c7548c4');
    const query = `FOR article IN Article FILTER article._id==@id LET related_articles=(FOR v1,e1,p1 IN @depth ANY article GRAPH 'newsGraph' FILTER SPLIT(e1._id,'/')[0]==@edgeColl && v1._id!=article._id COLLECT artid=p1.vertices[2]['_id'] WITH COUNT INTO no_of_paths SORT no_of_paths LIMIT @limit RETURN {'articleid':artid,'no_of_paths':no_of_paths}) FOR result IN related_articles FOR article1 IN Article FILTER article1._id==result['articleid'] RETURN {'related_article':article1,'no_of_paths':result['no_of_paths']}`;
    const cursor = await adb.query(query, { id: queryArticleId, edgeColl: edgeCollName, depth: searchDepth, limit: noOfResults });
    const path_related_docs = await cursor.all();
    // Format output as in Python
    const related_articles_arr = [], path_count_arr = [];
    for (const item of path_related_docs) {
        related_articles_arr.push(item.related_article);
        path_count_arr.push(item.no_of_paths);
    }
    return { related_articles: related_articles_arr, path_counts: path_count_arr };
}

export {
    getCrlrRelatedArticlesUnsetHandler,
    getCrlrRelatedArticlesHandler,
    getPathRelatedArticlesUnsetHandler,
    getPathRelatedArticlesHandler,
    getRelatedArticlesGraphHandler,
    getCrlrRelatedDocsHandler,
    getPathRelatedDocsHandler
};
