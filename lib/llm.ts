// LLM client configuration
// Uncomment and configure after choosing your LLM provider

/*
// Option 1: OpenAI
import OpenAI from 'openai';

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function analyzeWithLLM(prompt: string, data?: any) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant for a landscaping business. Help analyze measurements and provide billing insights."
      },
      {
        role: "user",
        content: `${prompt}\n\nData: ${JSON.stringify(data)}`
      }
    ],
  });

  return completion.choices[0].message.content;
}
*/

/*
// Option 2: Anthropic
import Anthropic from '@anthropic-ai/sdk';

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function analyzeWithLLM(prompt: string, data?: any) {
  const message = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are a helpful assistant for a landscaping business. Help analyze measurements and provide billing insights.\n\n${prompt}\n\nData: ${JSON.stringify(data)}`
      }
    ],
  });

  return message.content[0].type === 'text' ? message.content[0].text : '';
}
*/

// Placeholder export
export async function analyzeWithLLM(prompt: string, data?: any) {
  return "LLM not configured. Please set up OpenAI or Anthropic API key.";
}
