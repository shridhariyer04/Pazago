import readline from 'readline';
import dotenv from 'dotenv';
import path from 'path';               // <-- Add this
import { fileURLToPath } from 'url';   // <-- Already have

// ESM __filename and __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from your .env
dotenv.config({ path: path.resolve(__dirname, '.env') });

async function main() {
  // Dynamic imports for ES modules
  const { openai } = await import('@ai-sdk/openai');
  const { Agent } = await import('@mastra/core/agent');
  const { Memory } = await import('@mastra/memory');
  const { LibSQLStore } = await import('@mastra/libsql');
  const { createTool } = await import('@mastra/core/tools');
  const { z } = await import('zod');
  const { Pinecone } = await import('@pinecone-database/pinecone');
  const { embed } = await import('ai');

  // Initialize Pinecone
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });

  const index = pinecone.index(process.env.PINECONE_INDEX_NAME || 'berkshire-letters');

  // Create search tool
  const documentSearchTool = createTool({
    id: 'search-berkshire-documents',
    description: 'Search through Berkshire Hathaway shareholder letters for relevant information.',
    inputSchema: z.object({
      query: z.string().describe('The search query'),
      topK: z.number().optional().default(5),
      yearFilter: z.number().optional(),
      minScore: z.number().optional().default(0.7),
    }),
    outputSchema: z.object({
      results: z.array(z.object({
        content: z.string(),
        year: z.number(),
        source: z.string(),
        score: z.number(),
        page: z.number().optional(),
        section: z.string().optional(),
      })),
      totalResults: z.number(),
      searchQuery: z.string(),
    }),
    execute: async ({ context }) => {
      try {
        const { query, topK = 5, yearFilter, minScore = 0.7 } = context;
        
        console.log(`🔍 Searching for: "${query}"`);
        
        const { embedding } = await embed({
          model: openai.embedding('text-embedding-3-small', {
            dimensions: 1024,
          }),
          value: query,
          maxRetries: 3,
        });

        const filter = {};
        if (yearFilter && yearFilter >= 1965 && yearFilter <= new Date().getFullYear()) {
          filter.year = yearFilter;
        }

        const queryResponse = await index.query({
          vector: embedding,
          topK: Math.min(topK, 10),
          includeMetadata: true,
          filter: Object.keys(filter).length > 0 ? filter : undefined,
        });

        const results = queryResponse.matches
          .filter(match => match.score && match.score >= minScore)
          .map(match => {
            const metadata = match.metadata || {};
            return {
              content: (metadata.content || '').trim(),
              year: metadata.year || 0,
              source: metadata.source || 'Unknown Source',
              score: match.score || 0,
              page: metadata.page,
              section: metadata.section,
            };
          })
          .filter(result => result.content.length > 0);

        return {
          results,
          totalResults: results.length,
          searchQuery: query,
        };
      } catch (error) {
        console.error('❌ Search error:', error);
        return {
          results: [],
          totalResults: 0,
          searchQuery: context.query,
        };
      }
    },
  });

  // Create agent
  const berkshireAgent = new Agent({
    name: 'Berkshire Hathaway Intelligence Agent',
    instructions: `
You are a knowledgeable financial analyst specializing in Warren Buffett's investment philosophy and Berkshire Hathaway's business strategy. Your expertise comes from analyzing years of Berkshire Hathaway annual shareholder letters.

Core Responsibilities:
• Answer questions about Warren Buffett's investment principles and philosophy
• Provide insights into Berkshire Hathaway's business strategies and decisions
• Reference specific examples from the shareholder letters when appropriate
• Always use the documentSearchTool to find relevant information before answering
• Maintain context across conversations for follow-up questions

Guidelines:
• ALWAYS search for relevant information using the documentSearchTool first
• Ground your responses in the provided shareholder letter content
• Quote directly from the letters when relevant, with proper citations (Year: XXXX)
• If information isn't available in the documents, clearly state this limitation
• Provide year-specific context when discussing how views or strategies evolved
• For numerical data or specific acquisitions, cite the exact source letter and year
• Explain complex financial concepts in accessible terms while maintaining accuracy

Response Format:
• Start by searching for relevant information using the available tool
• Provide comprehensive, well-structured answers based on the search results
• Include relevant quotes from the letters with year attribution
• List source documents used for your response at the end
• For follow-up questions, reference previous conversation context appropriately

Remember: Your authority comes from the shareholder letters. Always search first, then provide answers grounded in this source material. Be transparent about the scope and limitations of your knowledge.
    `,
    model: openai('gpt-4o'),
    tools: { documentSearchTool },
    memory: new Memory({
      storage: new LibSQLStore({
        url: 'file:../mastra.db',
      }),
    }),
  });

  // Setup readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('🤖 Berkshire Hathaway RAG Terminal');
  console.log('Type your question and press Enter. Type "exit" to quit.\n');

  async function askQuestion(query) {
    try {
      console.log(`🤔 Processing: "${query}"`);
      
      const response = await berkshireAgent.generate([
        {
          role: 'user',
          content: query
        }
      ]);

      console.log(`\n💡 Answer:\n${response.text}\n`);

      if (response.toolResults && response.toolResults.length > 0) {
        console.log('📄 Sources used:');
        response.toolResults.forEach(toolResult => {
          if (toolResult.result && toolResult.result.results) {
            toolResult.result.results.forEach(source => {
              console.log(`- ${source.source} (Year: ${source.year}, Score: ${source.score.toFixed(2)})`);
            });
          }
        });
        console.log('');
      }

    } catch (err) {
      console.error('❌ Error:', err);
      console.log('\n');
    }
  }

  rl.on('line', async (input) => {
    const query = input.trim();
    if (query.toLowerCase() === 'exit') {
      console.log('👋 Goodbye!');
      rl.close();
      process.exit(0);
    }

    if (query) {
      await askQuestion(query);
    }
    console.log('💬 Ask another question (or type "exit" to quit):');
  });

  console.log('💬 Ask your first question about Warren Buffett and Berkshire Hathaway:');
}

main().catch(console.error);