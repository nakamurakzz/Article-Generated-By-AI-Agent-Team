import { runBasicExamples } from './basic-examples';

async function main() {
  console.log('TypeScript Validation Libraries Comparison');
  console.log('==========================================\n');
  
  await runBasicExamples();
}

main().catch(console.error);