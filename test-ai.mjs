// 测试 AI Agent 接口
const { chat } = await import('./src/lib/ai-agent/service.ts');

console.log('Testing AI chat - list tables...');

try {
  for await (const chunk of chat({
    message: '列出所有数据表',
    apiKey: process.env.AI_API_KEY,
    baseURL: process.env.AI_BASE_URL,
    model: process.env.AI_MODEL,
  })) {
    console.log('Chunk:', JSON.stringify(chunk, null, 2));
  }

  console.log('\n--- Done ---');
} catch (error) {
  console.error('Error:', error);
}