// scripts/test-tool-directly.ts - Direct tool testing
import { documentSearchTool } from '../tools/document-search-tool.js';
import { RuntimeContext } from '@mastra/core/runtime-context';
import 'dotenv/config';

async function testTool() {
  try {
    console.log('🧪 Testing document search tool directly...');
    
    const runtimeContext = new RuntimeContext();
    
    const testQuery = "investment principles";
    console.log(`🔍 Searching for: "${testQuery}"`);
    
    const result = await documentSearchTool.execute({
      context: {
        query: testQuery,
        topK: 3,
      },
      runtimeContext
    });
    
    console.log('\n📊 Results:');
    console.log(`Total results: ${result.totalResults}`);
    
    result.results.forEach((res, idx) => {
      console.log(`\n${idx + 1}. [${res.year}] ${res.source} (Score: ${res.score.toFixed(3)})`);
      console.log(`   "${res.content.substring(0, 150)}..."`);
    });
    
    console.log('\n✅ Tool test completed successfully!');
    
  } catch (error) {
    console.error('❌ Tool test failed:', error);
    process.exit(1);
  }
}

testTool();