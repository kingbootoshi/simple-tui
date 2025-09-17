import { Router } from 'express';
import { z } from 'zod';
import logger from '../../lib/logger';
import type TodoRepository from '../db/todoRepository';
import type { TodoRecord } from '../db/todoRepository';
import ToolExecutor from '../ai/toolExecutor';
import { runAssistant } from '../ai/assistantSession';
import type { ChatMessage } from '../../ai/chat';

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().nullable(),
});

const chatRequestSchema = z.object({
  messages: z.array(messageSchema),
});

const BASE_SYSTEM_PROMPT = `You are TodoMate, an assistant who manages a personal todo list using the provided tools.
Always call a tool to make any change; never invent data or state.
When a request is ambiguous or the target todo cannot be uniquely identified, ask for clarification before acting.
When calling tools with a selector, set selector.kind to "id" or "title" and set the unused field to null.
Prefer ids when the user provides them.`;

function formatLocalDateTime(now: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'full',
    timeStyle: 'long',
  }).format(now);
}

function describeTodos(todos: TodoRecord[]): string {
  if (!todos.length) {
    return '- No todos exist yet.';
  }

  return todos
    .map((todo) => {
      const status = todo.done === 1 ? 'done' : 'open';
      const priority = todo.priority === 1 ? 'high' : 'normal';
      const due = todo.due_date ? `due ${todo.due_date}` : 'no due date set';
      const description = todo.description ? `Description: ${todo.description}` : 'No description provided';
      return `- [${todo.id}] "${todo.title}" • status: ${status}; priority: ${priority}; ${due}. ${description}.`;
    })
    .join('\n');
}

function buildSystemPrompt(now: Date, todos: TodoRecord[]): string {
  const nowString = formatLocalDateTime(now);
  const todoSummary = describeTodos(todos);
  return `${BASE_SYSTEM_PROMPT}\n\nCurrent local date & time: ${nowString}.\n\nCurrent todos:\n${todoSummary}`;
}

function toChatMessages(input: Array<{ role: 'user' | 'assistant'; content: string | null }>): ChatMessage[] {
  return input.map((msg) => ({
    role: msg.role,
    content: msg.content ?? '',
  }));
}

function toTodoView(todo: TodoRecord): Record<string, unknown> {
  return {
    id: todo.id,
    title: todo.title,
    description: todo.description,
    due_date: todo.due_date,
    priority: todo.priority,
    done: todo.done === 1,
    created_at: todo.created_at,
    updated_at: todo.updated_at,
  };
}

export function createChatRouter(repo: TodoRepository): Router {
  const router = Router();
  const executor = new ToolExecutor(repo);

  router.post('/', async (req, res) => {
    const parseResult = chatRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Invalid request body', details: parseResult.error.issues });
      return;
    }

    const history = toChatMessages(parseResult.data.messages);
    const now = new Date();
    const snapshot = repo.list();
    const systemPrompt = buildSystemPrompt(now, snapshot);
    const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }, ...history];

    try {
      const result = await runAssistant(messages, executor);
      const todos = repo.list().map(toTodoView);
      res.json({ assistant: result.content, todos });
    } catch (error) {
      logger.error('Failed to process chat request', { error });
      res.status(500).json({ error: 'Failed to process chat request' });
    }
  });

  return router;
}

export default createChatRouter;
