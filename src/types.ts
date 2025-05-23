import { CollectionType } from 'arangojs/collection';

// Type definitions for request arguments
export interface BackupArgs {
	outputDir: string;
	collection?: string;
	docLimit?: number;
}

export interface QueryArgs {
	query: string;
	bindVars?: Record<string, unknown>;
}

export interface CollectionDocumentArgs {
	collection: string;
	document: Record<string, unknown>;
}

export interface CollectionKeyArgs {
	collection: string;
	key: string;
}

export interface UpdateDocumentArgs extends CollectionKeyArgs {
	update: Record<string, unknown>;
}

export interface CreateCollectionArgs {
	name: string;
	type?: 'document' | 'edge'; // Changed from CollectionType to string literals
	waitForSync?: boolean;
}

export interface GetCrlrRelatedArticlesUnsetArgs {
    articleKey: string;
    graphDepth: number;
    edgeCollectionName: string;
    simThreshold: number;
    dbUrl: string;
}

export interface GetCrlrRelatedArticlesArgs {
    articleKey: string;
    graphDepth: number;
    edgeCollectionName: string;
    simThreshold: number;
    dbUrl: string;
}

export interface GetPathRelatedArticlesUnsetArgs {
    articleKey: string;
    graphDepth: number;
    limit: number;
    dbUrl: string;
    epochtime: number;
}

export interface GetPathRelatedArticlesArgs {
    dbUrl: string;
    traversalDepth: number;
    qaCategory: string;
    qaKey: string;
    thresholdEpochtime: number;
    noOfResults: number;
    ipOrigin?: string[];
}

export interface GetRelatedArticlesGraphArgs {
    dbUrl: string;
    qaTopterms: string[];
    qaKey: string;
    traversalDepth: number;
    qaEpochtime: number;
    qaCategory: string;
    thresholdEpochtime: number;
}

export interface GetCrlrRelatedDocsArgs {
    dbUrl: string;
    docUrl: string;
    searchDepth: number;
    edgeCollName: string;
}

export interface GetPathRelatedDocsArgs {
    dbUrl: string;
    queryArticleId: string;
    searchDepth: number;
    edgeCollName: string;
    noOfResults: number;
}
