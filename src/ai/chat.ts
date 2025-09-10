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
  // Optional OpenAI-style tools array
  tools?: Array<
    | {
        type: 'function';
        function: {
          name: string;
          description?: string;
          parameters?: Record<string, unknown>;
          strict?: boolean;
        };
      }
  >;
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

/**
 * chatWithTools
 * One-turn helper that allows tool calls, executes them locally, then
 * feeds their outputs back as a user message to avoid repeated calls.
 * Returns final assistant text plus the mutated messages array.
 */
export async function chatWithTools(
  messages: ChatMessage[],
  options: ChatOptions & {
    tools: NonNullable<ChatOptions['tools']>;
    // Map tool name -> executor(argsJSON) => any
    executors: Record<string, (args: any) => Promise<any> | any>;
  }
): Promise<{ content: string; messages: ChatMessage[] }> {
  const client = getClient();

  const model = options.model || DEFAULT_MODEL;
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens;

  logger.debug('chatWithTools() initial call', {
    model,
    temperature,
    maxTokens,
    tools: options.tools?.map((t) => (t.type === 'function' ? t.function.name : 'unknown')),
  });

  // First call: let the model decide if it needs tools
  const first = await client.chat.completions.create({
    model,
    messages,
    temperature,
    ...(maxTokens ? { max_tokens: maxTokens } : {}),
    tools: options.tools,
    tool_choice: 'auto',
  } as any);

  const firstMsg = (first as any).choices?.[0]?.message ?? {};
  const toolCalls = (firstMsg.tool_calls ?? []) as Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;

  // Persist assistant message (with its tool calls) in history
  messages.push({
    role: 'assistant',
    content: firstMsg.content ?? null,
    tool_calls: toolCalls?.length ? toolCalls : undefined,
  });

  if (toolCalls && toolCalls.length > 0) {
    // Execute each tool call and append a tool message with results
    for (const call of toolCalls) {
      const name = call.function?.name;
      let args: any = {};
      try {
        args = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
      } catch (e) {
        logger.warn('Failed to parse tool arguments JSON', { name });
        args = { _raw: call.function?.arguments };
      }

      const exec = options.executors[name];
      let output: any;
      if (typeof exec !== 'function') {
        output = { error: `No executor registered for tool: ${name}` };
      } else {
        try {
          output = await exec(args);
        } catch (err: any) {
          output = { error: String(err?.message || err || 'unknown error') };
        }
      }

      // Required by Chat Completions: tool message responding to tool_call_id
      messages.push({
        role: 'tool',
        content: JSON.stringify(output),
        tool_call_id: call.id,
      });

      // Optional: also add a synthetic user message for visibility/persistence
      const payload = `YOU EXECUTED ${name} THE OUTPUT IS ${JSON.stringify(
        output
      )} USE THIS TO RESPOND TO THE USER YOU ARE TALKING NOW WITH`;
      messages.push({ role: 'user', content: payload });
    }

    // Second call: force no further tool calls, ask for final response
    const second = await client.chat.completions.create({
      model,
      messages,
      temperature,
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
      tools: options.tools,
      tool_choice: 'none',
    } as any);

    const content = (second as any).choices?.[0]?.message?.content ?? '';
    messages.push({ role: 'assistant', content });
    logger.info('chatWithTools() final completion received', {
      model,
      contentPreview: content.slice(0, 80),
    });
    return { content, messages };
  }

  // No tool calls – return the first assistant response
  const content = firstMsg.content ?? '';
  logger.info('chatWithTools() completion without tools', {
    model,
    contentPreview: String(content).slice(0, 80),
  });
  return { content, messages };
}
