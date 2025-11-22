#!/usr/bin/env node

import { pipeline } from '@huggingface/transformers';

async function testQwenEmbedding() {
  console.log('🤖 Testing Qwen3-Embedding-0.6B-ONNX with dimension reduction...\n');

  const testTag = 'legal_proceeding';
  console.log(`📝 Test tag: "${testTag}"\n`);

  // Test 1: Try truncate_dim at model initialization
  console.log('1️⃣ Testing truncate_dim at model level...');
  try {
    const extractor1 = await pipeline(
      'feature-extraction',
      'onnx-community/Qwen3-Embedding-0.6B-ONNX',
      {
        dtype: 'fp16',
        truncate_dim: 32  // Similar to SentenceTransformer approach
      }
    );

    const output1 = await extractor1(testTag, {
      pooling: 'last_token',
      normalize: true
    });
    const embedding1 = Array.from(output1.data);

    console.log(`   ✓ Success!`);
    console.log(`   Dimension: ${embedding1.length}`);
    console.log(`   First 5 values: ${embedding1.slice(0, 5).map(v => v.toFixed(4)).join(', ')}\n`);
  } catch (error) {
    console.log(`   ✗ Error: ${error instanceof Error ? error.message : String(error)}\n`);
  }

  // Test 2: Try model_kwargs approach
  console.log('2️⃣ Testing with model_kwargs...');
  try {
    const extractor2 = await pipeline(
      'feature-extraction',
      'onnx-community/Qwen3-Embedding-0.6B-ONNX',
      {
        dtype: 'fp16',
        model_kwargs: {
          truncate_dim: 32
        }
      }
    );

    const output2 = await extractor2(testTag, {
      pooling: 'last_token',
      normalize: true
    });
    const embedding2 = Array.from(output2.data);

    console.log(`   ✓ Success!`);
    console.log(`   Dimension: ${embedding2.length}`);
    console.log(`   First 5 values: ${embedding2.slice(0, 5).map(v => v.toFixed(4)).join(', ')}\n`);
  } catch (error) {
    console.log(`   ✗ Error: ${error instanceof Error ? error.message : String(error)}\n`);
  }

  // Test 3: Manual truncation after extraction
  console.log('3️⃣ Testing manual truncation to 32 dimensions...');
  try {
    const extractor3 = await pipeline(
      'feature-extraction',
      'onnx-community/Qwen3-Embedding-0.6B-ONNX',
      { dtype: 'fp16' }
    );

    const output3 = await extractor3(testTag, {
      pooling: 'last_token',
      normalize: false  // Normalize AFTER truncation
    });
    let embedding3 = Array.from(output3.data);

    // Truncate to first 32 dimensions
    embedding3 = embedding3.slice(0, 32);

    // Manually normalize the truncated vector
    const magnitude = Math.sqrt(embedding3.reduce((sum, val) => sum + val * val, 0));
    embedding3 = embedding3.map(val => val / magnitude);

    console.log(`   ✓ Success with manual truncation!`);
    console.log(`   Dimension: ${embedding3.length}`);
    console.log(`   First 5 values: ${embedding3.slice(0, 5).map(v => v.toFixed(4)).join(', ')}`);
    console.log(`   Vector magnitude: ${Math.sqrt(embedding3.reduce((sum, val) => sum + val * val, 0)).toFixed(4)}\n`);
  } catch (error) {
    console.log(`   ✗ Error: ${error instanceof Error ? error.message : String(error)}\n`);
  }

  // Test 4: Full 1024 dimensions for comparison
  console.log('4️⃣ Full 1024 dimensions (baseline)...');
  try {
    const extractor4 = await pipeline(
      'feature-extraction',
      'onnx-community/Qwen3-Embedding-0.6B-ONNX',
      { dtype: 'fp16' }
    );

    const output4 = await extractor4(testTag, {
      pooling: 'last_token',
      normalize: true
    });
    const embedding4 = Array.from(output4.data);

    console.log(`   ✓ Success!`);
    console.log(`   Dimension: ${embedding4.length}`);
    console.log(`   First 5 values: ${embedding4.slice(0, 5).map(v => v.toFixed(4)).join(', ')}\n`);
  } catch (error) {
    console.log(`   ✗ Error: ${error instanceof Error ? error.message : String(error)}\n`);
  }

  console.log('✅ Summary:');
  console.log('   If truncate_dim works: Use at model initialization');
  console.log('   Otherwise: Manual truncation + normalization works fine');
  console.log('   Trade-off: 32d is faster but may lose some semantic info');
}

testQwenEmbedding().catch(console.error);
