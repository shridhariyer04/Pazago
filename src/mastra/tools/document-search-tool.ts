import dotenv from "dotenv";
dotenv.config();
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Pinecone } from '@pinecone-database/pinecone';
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';

console.log("Loaded Pinecone key:", process.env.PINECONE_API_KEY);

// Define types for better TypeScript support
interface PineconeMatch {
  id: string;
  score?: number;
  metadata?: Record<string, any>;
}

interface SearchResult {
  content: string;
  year: number;
  source: string;
  score: number;
  page?: number;
  section?: string;
}

// Initialize Pinecone client with error handling
let pinecone: Pinecone;
let index: any;

try {
  pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
  });
  index = pinecone.index(process.env.PINECONE_INDEX_NAME || 'berkshire-letters');
} catch (error) {
  console.error('❌ Failed to initialize Pinecone:', error);
  throw error;
}

export const documentSearchTool = createTool({
  id: 'search-berkshire-documents',
  description: 'Search through Berkshire Hathaway shareholder letters for relevant information about Warren Buffett\'s investment philosophy, business strategies, and company decisions.',
  inputSchema: z.object({
    query: z.string().describe('The search query to find relevant information from Berkshire Hathaway shareholder letters'),
    topK: z.number().optional().default(5).describe('Number of top results to return (1-10)'),
    yearFilter: z.number().optional().describe('Filter results by specific year (e.g., 2023, 2022, etc.)'),
    minScore: z.number().optional().default(0.7).describe('Minimum similarity score threshold (0-1)'),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      content: z.string().describe('The actual text content from the shareholder letter'),
      year: z.number().describe('Year of the shareholder letter'),
      source: z.string().describe('Source document name'),
      score: z.number().describe('Similarity score (0-1, higher is more relevant)'),
      page: z.number().optional().describe('Page number in the document'),
      section: z.string().optional().describe('Section of the document'),
    })),
    totalResults: z.number().describe('Total number of results found'),
    searchQuery: z.string().describe('The original search query'),
  }),
  execute: async ({ context }) => {
    try {
      const { query, topK = 5, yearFilter, minScore = 0.7 } = context;
      
      // Validate inputs
      if (!query || query.trim().length === 0) {
        throw new Error('Search query cannot be empty');
      }

      if (topK < 1 || topK > 10) {
        throw new Error('topK must be between 1 and 10');
      }
      
      console.log(`🔍 Searching for: "${query}" with topK: ${topK}${yearFilter ? `, year: ${yearFilter}` : ''}`);
      
      // Generate embedding for the query using text-embedding-3-small with 1024 dimensions
      const { embedding } = await embed({
        model: openai.embedding('text-embedding-3-small', {
          dimensions: 1024, // Match your Pinecone index dimensions
        }),
        value: query,
        maxRetries: 3,
      });

      if (!embedding || embedding.length === 0) {
        throw new Error('Failed to generate embedding for query');
      }

      console.log(`✅ Generated query embedding with ${embedding.length} dimensions`);

      // Prepare filter for Pinecone query
      const filter: any = {};
      if (yearFilter && yearFilter >= 1965 && yearFilter <= new Date().getFullYear()) {
        filter.year = yearFilter;
        console.log(`🗓️ Filtering by year: ${yearFilter}`);
      }

      // Query Pinecone with error handling
      const queryResponse = await index.query({
        vector: embedding,
        topK: Math.min(topK, 10), // Ensure topK doesn't exceed reasonable limits
        includeMetadata: true,
        filter: Object.keys(filter).length > 0 ? filter : undefined,
      });

      if (!queryResponse || !queryResponse.matches) {
        throw new Error('Invalid response from Pinecone');
      }

      console.log(`📊 Found ${queryResponse.matches.length} potential results`);

      // Format and filter results with proper typing
      const results: SearchResult[] = queryResponse.matches
        .filter((match: PineconeMatch) => match.score && match.score >= minScore)
        .map((match: PineconeMatch): SearchResult => {
          const metadata = match.metadata || {};
          return {
            content: (metadata.content as string || '').trim(),
            year: metadata.year as number || 0,
            source: metadata.source as string || 'Unknown Source',
            score: match.score || 0,
            page: metadata.page as number | undefined,
            section: metadata.section as string | undefined,
          };
        })
        .filter((result: SearchResult) => result.content.length > 0); // Remove empty content

      console.log(`✅ Returning ${results.length} high-quality results (score >= ${minScore})`);

      if (results.length === 0) {
        console.log(`⚠️ No results found above similarity threshold of ${minScore} for query: "${query}"`);
      }

      return {
        results,
        totalResults: results.length,
        searchQuery: query,
      };
    } catch (error) {
      console.error('❌ Error in documentSearchTool:', error);
      
      // Return a structured error response instead of throwing
      return {
        results: [],
        totalResults: 0,
        searchQuery: context.query,
      };
    }
  },
});