/**
 * Demo script showing the proof-of-concept workflow
 * Usage: npx ts-node src/utils/test-gen/demoInstructionFlow.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { InstructionParser } from './instructionParser';

async function runDemo() {
  console.log('========================================');
  console.log('🚀 Instruction-Based Test Generation POC');
  console.log('========================================\n');

  // Step 1: Load instructions
  console.log('📖 STEP 1: Loading instructions from file...\n');
  const instructionsPath = path.join(
    process.cwd(),
    'instructions.json'
  );

  if (!fs.existsSync(instructionsPath)) {
    console.error(`❌ Instructions file not found at ${instructionsPath}`);
    process.exit(1);
  }

  const instructions = JSON.parse(
    fs.readFileSync(instructionsPath, 'utf-8')
  );

  console.log(`✅ Loaded: ${instructions.projectName}`);
  console.log(`📍 URL: ${instructions.url}`);
  console.log(`📝 Description: ${instructions.description}\n`);

  // Step 2: Parse and generate artifacts
  console.log('🔄 STEP 2: Generating artifacts from instructions...\n');

  const parser = new InstructionParser();
  const artifacts = parser.generateFromInstructions(instructions);

  // Step 3: Show extracted elements
  console.log(
    '🔍 Extracted Page Elements:',
    artifacts.pageElements.length
  );
  artifacts.pageElements.forEach((elem) => {
    console.log(`  • ${elem.name} (${elem.type}): ${elem.description}`);
  });
  console.log('');

  // Step 4: Display generated artifacts
  console.log('═════════════════════════════════════════');
  console.log('📄 GENERATED PAGE OBJECT');
  console.log('═════════════════════════════════════════\n');
  console.log(artifacts.pageObject);

  console.log('\n═════════════════════════════════════════');
  console.log('🎭 GENERATED FEATURE FILE');
  console.log('═════════════════════════════════════════\n');
  console.log(artifacts.featureFile);

  console.log('\n═════════════════════════════════════════');
  console.log('⚙️  GENERATED STEP DEFINITIONS (snippet)');
  console.log('═════════════════════════════════════════\n');
  console.log(artifacts.stepDefinitions.substring(0, 800) + '\n...\n');

  // Step 5: Save artifacts
  console.log('═════════════════════════════════════════');
  console.log('💾 STEP 3: Saving artifacts...\n');

  const outputDir = path.join(process.cwd(), 'src');

  // Save page object
  const pageObjectPath = path.join(
    outputDir,
    'page-objects',
    'generatedPage.ts'
  );
  fs.writeFileSync(pageObjectPath, artifacts.pageObject);
  console.log(`✅ Page Object saved to: ${pageObjectPath}`);

  // Save feature file
  const featureFileName = 'generated_from_instructions.feature';
  const featurePath = path.join(outputDir, 'features', featureFileName);
  fs.writeFileSync(featurePath, artifacts.featureFile);
  console.log(`✅ Feature File saved to: ${featurePath}`);

  // Save step definitions
  const stepsPath = path.join(
    outputDir,
    'step-definitions',
    'generatedSteps.ts'
  );
  fs.writeFileSync(stepsPath, artifacts.stepDefinitions);
  console.log(`✅ Step Definitions saved to: ${stepsPath}`);

  console.log('\n✨ All artifacts generated successfully!\n');

  console.log('📋 WORKFLOW SUMMARY:');
  console.log('┌──────────────────────────────────────────┐');
  console.log('│ 1. ✅ Instructions parsed                │');
  console.log('│ 2. ✅ Page elements extracted            │');
  console.log('│ 3. ✅ Page Object generated              │');
  console.log('│ 4. ✅ Feature File generated             │');
  console.log('│ 5. ✅ Step Definitions generated         │');
  console.log('│ 6. ✅ All files saved                    │');
  console.log('└──────────────────────────────────────────┘\n');

  console.log('🎯 Key Benefits of This Approach:');
  console.log('  • All artifacts are aligned and consistent');
  console.log('  • Page elements extracted automatically');
  console.log('  • Steps match actual implementations');
  console.log('  • Quick to generate and iterate');
  console.log('  • AI can refine each artifact independently\n');
}

runDemo().catch(console.error);