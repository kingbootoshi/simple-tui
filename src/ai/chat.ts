import getClient from './openrouterClient';
import logger from '../lib/logger';

/**
 * Chat API wrapper around OpenRouter via OpenAI SDK.
 *
 * Why: Provide a simple, typed entrypoint to perform chat completions with sane defaults.
 * How: Uses getClient() to access a pre-configured OpenRouter client and forwards options.
 * Docs: https://openrouter.ai/docs/quickstart
 */

// Align with OpenPipe/OpenAI message shapes (compatible subset)
type ContentPartText = { type: 'text'; text: string };
type ContentPartImage = {
  type: 'image_url';
  image_url: { url: string; detail?: 'auto' | 'low' | 'high' };
};

type SystemMessage = { role: 'system'; content: string | null };
type UserMessage = {
  role: 'user';
  content: string | Array<ContentPartText | ContentPartImage> | null;
};
type AssistantMessage = {
  role: 'assistant';
  content: string | null;
  function_call?: { name: string; arguments: string };
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
};
type ToolMessage = { role: 'tool'; content: string | null; tool_call_id: string };
type FunctionMessage = { role: 'function'; name: string; content: string | null };

export type ChatMessage =
  | SystemMessage
  | UserMessage
  | AssistantMessage
  | ToolMessage
  | FunctionMessage;

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
  const client = getClient();

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

  const content = (response as any).choices?.[0]?.message?.content ?? '';
  logger.info('chat() completion received', {
    model,
    contentPreview: content.slice(0, 80),
  });

  return content;
}

export default chat;
