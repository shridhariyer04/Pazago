// Final Correct Document Processing Workflow - Based on Mastra Documentation
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { MDocument } from '@mastra/rag';
import { z } from 'zod';
import { Pinecone } from '@pinecone-database/pinecone';
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';
import { processPDF } from '../utils/pdf-processor.js';
import fs from 'fs';
import path from 'path';

const documentSchema = z.object({
  filePath: z.string(),
  year: z.number(),
});

const processedDocumentSchema = z.object({
  chunks: z.array(z.object({
    content: z.string(),
    metadata: z.record(z.any()),
  })),
  fileName: z.string(),
  year: z.number(),
});

// Initialize Pinecone
let pinecone: Pinecone;
let index: any;

try {
  pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
  });
  
  index = pinecone.index(process.env.PINECONE_INDEX_NAME || 'berkshire-letters');
  console.log('✅ Pinecone initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Pinecone:', error);
  throw error;
}

export const extractAndChunkDocument = createStep({
  id: 'extract-and-chunk',
  description: 'Extract text from PDF and chunk it for processing',
  inputSchema: documentSchema,
  outputSchema: processedDocumentSchema,
  execute: async ({ inputData }) => {
    if (!inputData) {
      throw new Error('Input data not found');
    }

    const { filePath, year } = inputData;
    
    try {
      console.log(`🔄 Processing PDF: ${filePath}`);
      
      // Extract text from PDF
      const pdfText = await processPDF(filePath);
      console.log(`📝 Extracted ${pdfText.length} characters from PDF`);
      
      if (!pdfText || pdfText.trim().length === 0) {
        throw new Error('No text extracted from PDF');
      }
      
      // Create MDocument instance
      const document = MDocument.fromText(pdfText, {
        source: path.basename(filePath),
        year,
        type: 'shareholder-letter',
      });

      // Chunk the document using maxSize (as per Mastra docs)
      console.log('✂️ Chunking document...');
      const chunks = await document.chunk({
        strategy: 'recursive',
        maxSize: 800,
        overlap: 200,
        separators: ['\n\n', '\n', '. ', ' '],
      });

      console.log(`📊 Created ${chunks.length} chunks`);

      // Get the docs from MDocument
      const docs = document.getDocs();
      
      // Convert chunks to proper format, handling different possible property names
      const processedChunks = docs.map((doc, index) => {
        // Try different property names that might contain the text content
        const content = doc.text || doc.content || doc.pageContent || (typeof doc === 'string' ? doc : '');
        return {
          content: content,
          metadata: doc.metadata || {},
        };
      });

      return {
        chunks: processedChunks,
        fileName: path.basename(filePath),
        year,
      };
    } catch (error) {
      console.error(`❌ Error in extractAndChunkDocument for ${filePath}:`, error);
      throw new Error(`Failed to process document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

export const embedAndStore = createStep({
  id: 'embed-and-store',
  description: 'Generate embeddings and store in Pinecone',
  inputSchema: processedDocumentSchema,
  outputSchema: z.object({
    stored: z.number(),
    fileName: z.string(),
  }),
  execute: async ({ inputData }) => {
    if (!inputData) {
      throw new Error('Input data not found');
    }

    const { chunks, fileName, year } = inputData;
    
    try {
      console.log(`🧠 Generating embeddings for ${chunks.length} chunks...`);
      
      const vectors = [];

      // Generate embeddings for each chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        console.log(`Processing chunk ${i + 1}/${chunks.length} (${chunk.content?.length || 0} chars)`);
        
        // Validate chunk content
        if (!chunk.content || chunk.content.trim().length === 0) {
          console.warn(`⚠️ Skipping empty chunk ${i}`);
          continue;
        }
        
        try {
          // Use text-embedding-3-small with dimensions parameter set to 1024 to match your Pinecone index
          const { embedding } = await embed({
            model: openai.embedding('text-embedding-3-small', {
              dimensions: 1024, // This reduces from default 1536 to 1024 to match your index
            }),
            value: chunk.content.trim(),
            maxRetries: 2,
          });

          if (!embedding || embedding.length === 0) {
            throw new Error(`Empty embedding returned for chunk ${i}`);
          }

          console.log(`✅ Generated embedding for chunk ${i + 1} (${embedding.length} dimensions)`);

          vectors.push({
            id: `${fileName.replace('.pdf', '')}-chunk-${i}-${Date.now()}`,
            values: embedding,
            metadata: {
              content: chunk.content,
              source: fileName,
              year,
              chunkIndex: i,
              ...chunk.metadata,
            },
          });
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (embedError) {
          console.error(`❌ Failed to generate embedding for chunk ${i}:`, embedError);
          // Continue with next chunk instead of failing completely
          continue;
        }
      }

      if (vectors.length === 0) {
        throw new Error('No valid vectors generated');
      }

      console.log(`📤 Uploading ${vectors.length} vectors to Pinecone...`);

      // Batch upsert to Pinecone (process in batches of 50)
      const batchSize = 50;
      let totalStored = 0;
      
      for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize);
        console.log(`Uploading batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(vectors.length / batchSize)}`);
        
        try {
          await index.upsert(batch);
          totalStored += batch.length;
          console.log(`✅ Uploaded batch of ${batch.length} vectors`);
          
          // Small delay between batches
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (upsertError) {
          console.error(`❌ Failed to upsert batch:`, upsertError);
          // Continue with next batch instead of failing completely
          continue;
        }
      }

      console.log(`🎉 Successfully stored ${totalStored} chunks from ${fileName}`);

      return {
        stored: totalStored,
        fileName,
      };
    } catch (error) {
      console.error(`❌ Error in embedAndStore for ${fileName}:`, error);
      throw new Error(`Failed to embed and store: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

export const documentProcessingWorkflow = createWorkflow({
  id: 'document-processing-workflow',
  inputSchema: documentSchema,
  outputSchema: z.object({
    stored: z.number(),
    fileName: z.string(),
  }),
})
  .then(extractAndChunkDocument)
  .then(embedAndStore);

documentProcessingWorkflow.commit();