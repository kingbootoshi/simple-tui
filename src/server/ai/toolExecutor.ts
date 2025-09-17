import logger from '../../lib/logger';
import TodoRepository, { TodoRecord } from '../db/todoRepository';
import { AddTodoArgs, CheckDoneArgs, DeleteTodoArgs } from './tools';

export type ToolExecutionSuccess = {
  ok: true;
  data: Record<string, unknown>;
};

export type ToolExecutionError = {
  ok: false;
  message: string;
};

export type ToolExecutionResult = ToolExecutionSuccess | ToolExecutionError;

export class ToolExecutor {
  constructor(private readonly repo: TodoRepository) {}

  execute(name: string, rawArgs: unknown): ToolExecutionResult {
    try {
      switch (name) {
        case 'add_todo':
          return this.handleAdd(rawArgs);
        case 'delete_todo':
          return this.handleDelete(rawArgs);
        case 'check_done':
          return this.handleCheck(rawArgs);
        default:
          return { ok: false, message: `Unknown tool: ${name}` };
      }
    } catch (error: unknown) {
      logger.warn('Tool execution threw', { name, error });
      if (error instanceof Error) {
        return { ok: false, message: `Validation error: ${error.message}` };
      }
      return { ok: false, message: 'Validation error: invalid arguments' };
    }
  }

  private handleAdd(raw: unknown): ToolExecutionResult {
    const args = AddTodoArgs.parse(raw);
    const todo = this.repo.create({
      title: args.title,
      description: args.description ?? null,
      due_date: args.due_date ?? null,
      priority: args.priority ?? 0,
    });

    return {
      ok: true,
      data: {
        action: 'add',
        todo: this.toModelView(todo),
      },
    };
  }

  private handleDelete(raw: unknown): ToolExecutionResult {
    const args = DeleteTodoArgs.parse(raw);
    const id = this.resolveId(args.selector);
    if (typeof id !== 'number') {
      return { ok: false, message: id };
    }

    const removed = this.repo.deleteById(id);
    if (!removed) {
      return { ok: false, message: 'No todo exists with that id.' };
    }

    return {
      ok: true,
      data: {
        action: 'delete',
        id,
      },
    };
  }

  private handleCheck(raw: unknown): ToolExecutionResult {
    const args = CheckDoneArgs.parse(raw);
    const id = this.resolveId(args.selector);
    if (typeof id !== 'number') {
      return { ok: false, message: id };
    }

    const doneValue = args.done ?? true;
    const updated = this.repo.markDoneById(id, doneValue);
    if (!updated) {
      return { ok: false, message: 'No todo exists with that id.' };
    }

    return {
      ok: true,
      data: {
        action: 'check',
        todo: this.toModelView(updated),
      },
    };
  }

  private resolveId(args: { kind: 'id' | 'title'; id: number | null; title: string | null }): number | string {
    if (args.kind === 'id') {
      if (typeof args.id === 'number') {
        return args.id;
      }
      return 'Missing identifier. Provide a numeric id when using the id selector.';
    }

    const title = args.title?.trim();
    if (!title) {
      return 'Missing identifier. Provide an exact title when using the title selector.';
    }

    const candidates = this.repo.findByExactTitle(title);
    if (candidates.length === 0) {
      return 'No todo exists with that exact title.';
    }
    if (candidates.length > 1) {
      return 'Multiple todos share that title. Ask the user for the id to disambiguate.';
    }

    return candidates[0].id;
  }

  private toModelView(todo: TodoRecord) {
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
}

export default ToolExecutor;
