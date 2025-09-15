// import { Mastra } from '@mastra/core/mastra';
// import { PinoLogger } from '@mastra/loggers';
// import { LibSQLStore } from '@mastra/libsql';
// import { documentProcessingWorkflow } from './workflows/document-processing-workflow';
// import { berkshireAgent } from './agents/brk-agent';

// export const mastra = new Mastra({
//   workflows: { documentProcessingWorkflow },
//   agents: { berkshireAgent },
//   storage: new LibSQLStore({
//     url: 'file:../mastra.db',
//   }),
//   logger: new PinoLogger({
//     name: 'Berkshire-RAG',
//     level: 'info',
//   }),
// });

// async function main() {
//   try {
//     console.log('🚀 Starting Berkshire Hathaway RAG Application...');
//     console.log('✅ Application initialized successfully');
//     console.log('📚 RAG system ready for Berkshire Hathaway document queries');
//     console.log('🤖 Agent available at: http://localhost:4111');

//     process.on('SIGINT', async () => {
//       console.log('🛑 Shutting down gracefully...');
//       process.exit(0);
//     });

//   } catch (error) {
//     console.error('❌ Failed to start application:', error);
//     process.exit(1);
//   }
// }

// // ✅ CommonJS entry check
// if (require.main === module) {
//   main();
// }

import * as dotenv from 'dotenv';
dotenv.config();

import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { documentProcessingWorkflow } from './workflows/document-processing-workflow.js';
import { berkshireAgent } from './agents/brk-agent.js';

export const mastra = new Mastra({
  workflows: { documentProcessingWorkflow },
  agents: { berkshireAgent },
  storage: new LibSQLStore({
    url: 'file:../mastra.db',
  }),
  logger: new PinoLogger({
    name: 'Berkshire-RAG',
    level: 'info',
  }),
});

async function main(): Promise<void> {
  try {
    console.log('🚀 Starting Berkshire Hathaway RAG Application...');
    console.log('✅ Application initialized successfully');
    console.log('📚 RAG system ready for Berkshire Hathaway document queries');
    console.log('🤖 Agent available at: http://localhost:4111');

    // Keep the process running
    process.stdin.resume();

    const gracefulShutdown = async (): Promise<void> => {
      console.log('🛑 Shutting down gracefully...');
      process.exit(0);
    };

    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);

  } catch (error) {
    console.error('❌ Failed to start application:', error);
    process.exit(1);
  }
}

// ✅ ESM entry point – just call main
main().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
