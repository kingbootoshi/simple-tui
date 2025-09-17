import type Database from 'better-sqlite3';

export type TodoRecord = {
  id: number;
  title: string;
  description?: string | null;
  due_date?: string | null;
  priority: 0 | 1;
  done: 0 | 1;
  created_at: string;
  updated_at: string;
};

export type CreateTodoArgs = {
  title: string;
  description?: string | null;
  due_date?: string | null;
  priority?: 0 | 1;
};

export default class TodoRepository {
  constructor(private readonly db: Database.Database) {}

  list(): TodoRecord[] {
    return this.db
      .prepare<[], TodoRecord>('SELECT * FROM todos ORDER BY created_at DESC')
      .all();
  }

  findById(id: number): TodoRecord | undefined {
    return this.db.prepare<[number], TodoRecord>('SELECT * FROM todos WHERE id = ?').get(id);
  }

  findByExactTitle(title: string): TodoRecord[] {
    return this.db
      .prepare<[string], TodoRecord>('SELECT * FROM todos WHERE title = ?')
      .all(title);
  }

  create(args: CreateTodoArgs): TodoRecord {
    const now = new Date().toISOString();
    const info = this.db
      .prepare(
        `INSERT INTO todos (title, description, due_date, priority, done, created_at, updated_at)
         VALUES (@title, @description, @due_date, COALESCE(@priority, 0), 0, @now, @now)`
      )
      .run({
        title: args.title,
        description: args.description ?? null,
        due_date: args.due_date ?? null,
        priority: args.priority ?? 0,
        now,
      });

    const id = Number(info.lastInsertRowid);
    return this.findById(id)!;
  }

  deleteById(id: number): boolean {
    const result = this.db.prepare('DELETE FROM todos WHERE id = ?').run(id);
    return result.changes === 1;
  }

  markDoneById(id: number, done: boolean): TodoRecord | undefined {
    const now = new Date().toISOString();
    const result = this.db
      .prepare('UPDATE todos SET done = ?, updated_at = ? WHERE id = ?')
      .run(done ? 1 : 0, now, id);

    if (result.changes !== 1) return undefined;
    return this.findById(id);
  }
}
