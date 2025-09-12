import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { documentProcessingWorkflow } from '../workflows/document-processing-workflow';
import { extractYearFromFilename } from '../utils/pdf-processor';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function processAllDocuments() {
  try {
    console.log('📚 Starting document processing...');

    const documentsPath = path.resolve(__dirname, '../documents');

    if (!fs.existsSync(documentsPath)) {
      throw new Error(`Documents directory not found: ${documentsPath}`);
    }

    const files = fs.readdirSync(documentsPath).filter(f => f.endsWith('.pdf'));

    if (files.length === 0) {
      console.log('⚠️ No PDF files found in documents directory');
      return;
    }

    for (const file of files) {
      const filePath = path.join(documentsPath, file);
      const year = extractYearFromFilename(file);

      console.log(`Processing: ${file} (Year: ${year})`);

      try {
        const input = { filePath, year };

        // ✅ Correct workflow execution
        const { results, status } = await documentProcessingWorkflow.execute({
          triggerData: input
        });

        if (status === 'COMPLETED') {
          console.log(`✅ Processed ${file}:`, results);
        } else {
          console.error(`❌ Workflow failed for ${file}`);
        }
      } catch (err) {
        console.error(`❌ Error processing ${file}:`, err);
      }
    }

    console.log('🎉 Document processing completed!');
  } catch (err) {
    console.error('💥 Document processing failed:', err);
    process.exit(1);
  }
}

processAllDocuments();
