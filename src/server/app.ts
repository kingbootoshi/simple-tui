import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import logger from '../lib/logger';
import getDb from './db';
import TodoRepository from './db/todoRepository';
import createChatRouter from './routes/chat.route';
import createTodosRouter from './routes/todos.route';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  const db = getDb();
  const repo = new TodoRepository(db);

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/chat', createChatRouter(repo));
  app.use('/api/todos', createTodosRouter(repo));

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled server error', { err });
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

export default createApp;
