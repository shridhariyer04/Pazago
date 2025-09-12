// // test-client.ts - Test client to verify RAG functionality
// import fetch from 'node-fetch';
// import { RuntimeContext } from '@mastra/core/runtime-context';
// import { documentSearchTool } from '../src/mastra/tools/document-search-tool';

// const BASE_URL = 'http://localhost:4111';

// // Test queries to validate the RAG system
// const testQueries = [
//   "What are Warren Buffett's key investment principles?",
//   "How does Buffett view diversification?",
//   "What is Buffett's opinion on derivatives?",
//   "How has Berkshire's insurance business evolved?",
//   "What does Buffett think about market timing?"
// ];

// // Test streaming chat
// async function testStreamingChat(query: string) {
//   console.log(`\n🔍 Testing streaming chat with: "${query}"`);
//   console.log('='.repeat(80));

//   try {
//     const response = await fetch(`${BASE_URL}/api/chat`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ message: query }),
//     });

//     if (!response.ok) {
//       throw new Error(`HTTP ${response.status}: ${response.statusText}`);
//     }

//     const reader = response.body?.getReader();
//     if (!reader) throw new Error('No response body');

//     const decoder = new TextDecoder();
//     let buffer = '';
//     let fullResponse = '';

//     while (true) {
//       const { done, value } = await reader.read();
//       if (done) break;

//       buffer += decoder.decode(value, { stream: true });
//       const lines = buffer.split('\n');
//       buffer = lines.pop() || '';

//       for (const line of lines) {
//         if (line.startsWith('data: ')) {
//           try {
//             const data = JSON.parse(line.slice(6));
            
//             switch (data.type) {
//               case 'metadata':
//                 console.log('📄 Sources:', data.sources);
//                 break;
//               case 'text':
//                 process.stdout.write(data.content);
//                 fullResponse += data.content;
//                 break;
//               case 'done':
//                 console.log('\n✅ Stream complete\n');
//                 return fullResponse;
//               case 'error':
//                 console.error('❌ Stream error:', data.error);
//                 return null;
//             }
//           } catch (e) {
//             // Skip malformed JSON lines
//           }
//         }
//       }
//     }
//   } catch (error) {
//     console.error('❌ Streaming test failed:', error);
//     return null;
//   }
// }

// // Test simple chat
// async function testSimpleChat(query: string) {
//   console.log(`\n🔍 Testing simple chat with: "${query}"`);
  

//   try {
//     const response = await fetch(`${BASE_URL}/api/chat/simple`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ message: query }),
//     });

//     if (!response.ok) {
//       throw new Error(`HTTP ${response.status}: ${response.statusText}`);
//     }

//     const data = await response.json();
    
//     console.log('📄 Sources used:');
//     data.sources?.forEach((source: any, idx: number) => {
//       console.log(`   ${idx + 1}. ${source.year} - ${source.source} (Score: ${source.score.toFixed(3)})`);
//     });
    
//     console.log('\n🤖 Response:');
//     console.log(data.response);
//     console.log('\n' + '='.repeat(80));
    
//     return data.response;
//   } catch (error) {
//     console.error('❌ Simple chat test failed:', error);
//     return null;
//   }
// }

// // Test document search
// async function testDocumentSearch(query: string) {
//   console.log(`\n🔍 Testing document search with: "${query}"`);
//   console.log('=' .repeat(50));

//   try {
//     const response = await fetch(`${BASE_URL}/api/search`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ query, topK: 3 }),
//     });

//     if (!response.ok) {
//       throw new Error(`HTTP ${response.status}: ${response.statusText}`);
//     }

//     const data = await response.json();
    
//     console.log(`Found ${data.totalResults} results:`);
//     data.results.forEach((result: any, idx: number) => {
//       console.log(`\n${idx + 1}. [${result.year}] ${result.source} (Score: ${result.score.toFixed(3)})`);
//       console.log(`   "${result.content.substring(0, 200)}..."`);
//     });
    
//     console.log('\n' + '='.repeat(50));
//     return data;
//   } catch (error) {
//     console.error('❌ Search test failed:', error);
//     return null;
//   }
// }

// // Test health endpoint
// async function testHealth() {
//   console.log('🏥 Testing health endpoint...');
  
//   try {
//     const response = await fetch(`${BASE_URL}/health`);
    
//     if (!response.ok) {
//       throw new Error(`HTTP ${response.status}: ${response.statusText}`);
//     }
    
//     const data = await response.json();
//     console.log('✅ Health check passed:', data);
//     return true;
//   } catch (error) {
//     console.error('❌ Health check failed:', error);
//     return false;
//   }
// }

// // Main test runner
// async function runTests() {
//   console.log('🧪 Starting RAG System Tests');
//   console.log('='.repeat(80));

//   // Test health first
//   const healthOk = await testHealth();
//   if (!healthOk) {
//     console.log('❌ Server not healthy, aborting tests');
//     return;
//   }

//   // Test document search
//   for (const query of testQueries.slice(0, 2)) {
//     await testDocumentSearch(query);
//     await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
//   }

//   // Test simple chat
//   for (const query of testQueries.slice(0, 2)) {
//     await testSimpleChat(query);
//     await new Promise(resolve => setTimeout(resolve, 1000));
//   }

//   // Test streaming chat
//   for (const query of testQueries.slice(0, 1)) {
//     await testStreamingChat(query);
//     await new Promise(resolve => setTimeout(resolve, 1000));
//   }

//   console.log('\n🎉 All tests completed!');
// }

// // Interactive mode for testing specific queries
// async function interactiveMode() {
//   const readline = require('readline').createInterface({
//     input: process.stdin,
//     output: process.stdout
//   });

//   console.log('\n🎯 Interactive RAG Testing Mode');
//   console.log('Type your questions about Warren Buffett or Berkshire Hathaway');
//   console.log('Commands: /health, /search <query>, /chat <query>, /stream <query>, /quit\n');

//   const askQuestion = () => {
//     readline.question('> ', async (input: string) => {
//       const [command, ...args] = input.trim().split(' ');
//       const query = args.join(' ');

//       switch (command) {
//         case '/health':
//           await testHealth();
//           break;
//         case '/search':
//           if (query) await testDocumentSearch(query);
//           else console.log('Usage: /search <your query>');
//           break;
//         case '/chat':
//           if (query) await testSimpleChat(query);
//           else console.log('Usage: /chat <your question>');
//           break;
//         case '/stream':
//           if (query) await testStreamingChat(query);
//           else console.log('Usage: /stream <your question>');
//           break;
//         case '/quit':
//           console.log('👋 Goodbye!');
//           readline.close();
//           return;
//         default:
//           // Default to streaming chat
//           if (input.trim()) {
//             await testStreamingChat(input.trim());
//           } else {
//             console.log('Please enter a question or use /help for commands');
//           }
//       }
      
//       askQuestion();
//     });
//   };

//   askQuestion();
// }

// // Command line argument parsing
// const args = process.argv.slice(2);
// if (args.includes('--interactive') || args.includes('-i')) {
//   interactiveMode();
// } else {
//   runTests();
// }