import 'dotenv/config';
import logger from './lib/logger';
import chat, { ChatMessage } from './ai/chat';

/**
 * Demo entrypoint for the AI core module.
 *
 * Why: Provide a minimal example showcasing how to call the chat wrapper.
 * How: Sends a single user message to the default model and logs the response.
 */
async function main(): Promise<void> {
  try {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Say hello from OpenRouter.' },
    ];

    const reply = await chat(messages);
    
    console.log(reply);
  } catch (error) {
    process.exitCode = 1;
  }
}

void main();

