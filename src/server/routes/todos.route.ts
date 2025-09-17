import { Router } from 'express';
import { z } from 'zod';
import type TodoRepository from '../db/todoRepository';
import type { TodoRecord } from '../db/todoRepository';

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).optional(),
  due_date: z.string().optional(),
  priority: z.union([z.literal(0), z.literal(1)]).optional(),
});

const checkSchema = z.object({
  done: z.boolean(),
});

function view(todo: TodoRecord) {
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

export function createTodosRouter(repo: TodoRepository): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({ todos: repo.list().map(view) });
  });

  router.post('/', (req, res) => {
    const result = createSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Invalid body', details: result.error.issues });
      return;
    }

    const todo = repo.create({
      title: result.data.title,
      description: result.data.description ?? null,
      due_date: result.data.due_date ?? null,
      priority: result.data.priority ?? 0,
    });

    res.status(201).json({ todo: view(todo) });
  });

  router.patch('/:id/check', (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid id parameter' });
      return;
    }

    const result = checkSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Invalid body', details: result.error.issues });
      return;
    }

    const updated = repo.markDoneById(id, result.data.done);
    if (!updated) {
      res.status(404).json({ error: 'Todo not found' });
      return;
    }

    res.json({ todo: view(updated) });
  });

  router.delete('/:id', (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid id parameter' });
      return;
    }

    const deleted = repo.deleteById(id);
    if (!deleted) {
      res.status(404).json({ error: 'Todo not found' });
      return;
    }

    res.status(204).send();
  });

  return router;
}

export default createTodosRouter;
