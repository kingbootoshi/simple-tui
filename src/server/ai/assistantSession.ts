import { ChatMessage } from '../../ai/chat';
import getClient from '../../ai/openrouterClient';
import logger from '../../lib/logger';
import ToolExecutor, { ToolExecutionResult } from './toolExecutor';
import { toolDefinitions } from './tools';
import withRetry from '../lib/retry';

type ToolChoice = 'auto' | 'none';

const DEFAULT_MODEL = process.env.OPENROUTER_DEFAULT_MODEL || 'openai/gpt-4o';
const TEMPERATURE = Number(process.env.ASSISTANT_TEMPERATURE ?? 0.2);
const MAX_TOOL_LOOPS = 6;

export type AssistantRunResult = {
  content: string;
  messages: ChatMessage[];
};

export async function runAssistant(
  initialMessages: ChatMessage[],
  executor: ToolExecutor
): Promise<AssistantRunResult> {
  const messages: ChatMessage[] = [...initialMessages];
  const client = getClient();

  let iteration = 0;
  let toolChoice: ToolChoice = 'auto';

  while (iteration < MAX_TOOL_LOOPS) {
    iteration += 1;
    const response = await withRetry(() =>
      client.chat.completions.create({
        model: DEFAULT_MODEL,
        messages,
        temperature: TEMPERATURE,
        tools: toolDefinitions,
        tool_choice: toolChoice,
      } as any)
    );

    const choice = (response as any).choices?.[0]?.message ?? {};
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: choice.content ?? null,
      tool_calls: choice.tool_calls?.length ? choice.tool_calls : undefined,
    } as ChatMessage;

    messages.push(assistantMessage);

    const toolCalls = (choice.tool_calls ?? []) as Array<{
      id: string;
      type: 'function';
      function: { name: string; arguments: string };
    }>;

    if (!toolCalls.length) {
      const finalContent = assistantMessage.content ? String(assistantMessage.content) : '';
      logger.info('Assistant responded without tool calls', {
        iteration,
        preview: finalContent.slice(0, 120),
      });
      return { content: finalContent, messages };
    }

    const executionResults: ToolExecutionResult[] = [];

    for (const call of toolCalls) {
      const { id, function: fn } = call;
      let parsed: unknown;
      try {
        parsed = fn.arguments ? JSON.parse(fn.arguments) : {};
      } catch (error) {
        logger.warn('Failed to parse tool arguments', {
          tool: fn.name,
          raw: fn.arguments,
        });
        const result: ToolExecutionResult = {
          ok: false,
          message: 'Invalid JSON arguments supplied to tool.',
        };
        executionResults.push(result);
        messages.push({
          role: 'tool',
          tool_call_id: id,
          content: JSON.stringify(result),
        });
        continue;
      }

      const result = executor.execute(fn.name, parsed);
      executionResults.push(result);

      messages.push({
        role: 'tool',
        tool_call_id: id,
        content: JSON.stringify(result),
      });
    }

    const allSucceeded = executionResults.every((r) => r.ok);
    toolChoice = allSucceeded ? 'none' : 'auto';
  }

  throw new Error('Assistant exceeded maximum tool iterations');
}
