import OpenAI from 'openai';
import getClient from './openrouterClient';
import logger from '../lib/logger';

/**
 * Chat API wrapper around OpenRouter via OpenAI SDK.
 *
 * Why: Provide a simple, typed entrypoint to perform chat completions with sane defaults.
 * How: Uses getClient() to access a pre-configured OpenRouter client and forwards options.
 * Docs: https://openrouter.ai/docs/quickstart
 */

// Align with OpenAI SDK expected message shape
export type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

export type ChatOptions = {
  model?: string; // e.g., 'openai/gpt-4o' or any OpenRouter model id
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
};

const DEFAULT_MODEL = process.env.OPENROUTER_DEFAULT_MODEL || 'openai/gpt-4o';

export async function chat(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  const client: OpenAI = getClient();

  const model = options.model || DEFAULT_MODEL;
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens;

  logger.debug('chat() called', {
    model,
    temperature,
    maxTokens,
    numMessages: messages.length,
  });

  const response = await client.chat.completions.create({
    model,
    messages,
    temperature,
    ...(maxTokens ? { max_tokens: maxTokens } : {}),
  });

  const content = response.choices?.[0]?.message?.content ?? '';
  logger.info('chat() completion received', {
    model,
    contentPreview: content.slice(0, 80),
  });

  return content;
}

export default chat;


