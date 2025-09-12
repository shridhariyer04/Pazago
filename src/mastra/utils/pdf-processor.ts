import fs from 'fs';
import pdf from 'pdf-parse-debugging-disabled';
import 'dotenv/config';

export async function processPDF(filePath: string): Promise<string> {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Read PDF file
    const pdfBuffer = fs.readFileSync(filePath);
    
    // Parse PDF
    const pdfData = await pdf(pdfBuffer);
    
    // Clean and return text
    return cleanText(pdfData.text);
  } catch (error) {
    throw new Error(`Failed to process PDF ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function cleanText(text: string): string {
  // Remove excessive whitespace and clean up the text
  return text
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/\n\s*\n/g, '\n\n') // Normalize line breaks
    .replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII characters
    .trim();
}

// Utility function to extract year from filename
export function extractYearFromFilename(filename: string): number {
  const yearMatch = filename.match(/(\d{4})/);
  return yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
}