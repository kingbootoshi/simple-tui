import { FormEvent, useEffect, useRef, useState } from 'react';

type Role = 'user' | 'assistant';

type Message = {
  role: Role;
  content: string;
};

type Todo = {
  id: number;
  title: string;
  description?: string | null;
  due_date?: string | null;
  priority: 0 | 1;
  done: boolean;
  created_at: string;
  updated_at: string;
};

const emptyMessage: Message = {
  role: 'assistant',
  content: "Hi! I'm your AI todo buddy. Let me know what you need and I'll manage your list.",
};

async function fetchTodos(): Promise<Todo[]> {
  const response = await fetch('/api/todos');
  if (!response.ok) return [];
  const json = await response.json();
  return Array.isArray(json.todos) ? json.todos : [];
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([emptyMessage]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchTodos()
      .then(setTodos)
      .catch(() => {
        setError('Failed to load todos. The assistant can still create them for you.');
      });
  }, []);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!input.trim() || isSending) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setError(null);
    setIsSending(true);

    const conversationToSend = [...messages.filter((m) => m !== emptyMessage), userMessage];

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: conversationToSend }),
      });

      if (!response.ok) {
        throw new Error('Failed to reach the assistant');
      }

      const payload = await response.json();
      const assistantText = typeof payload.assistant === 'string' ? payload.assistant : '';
      const assistantMessage: Message = { role: 'assistant', content: assistantText || "I'm sorry, I could not generate a response." };

      setMessages((prev) => [...prev, assistantMessage]);

      if (Array.isArray(payload.todos)) {
        setTodos(payload.todos);
      }
    } catch (err) {
      setError((err as Error).message || 'Unexpected error talking to the assistant.');
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Something went wrong reaching the AI. Please try again in a moment.',
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="app-shell">
      <header>
        <div>
          <h1>AI Todo Chat</h1>
          <p>Talk naturally. The assistant will update your todos using trusted tools.</p>
        </div>
        <span>{isSending ? 'Thinking…' : 'Ready'}</span>
      </header>

      <main>
        <section className="chat-panel">
          <div className="message-list" ref={listRef}>
            {messages.map((message, idx) => (
              <div key={`${message.role}-${idx}`} className={`message ${message.role}`}>
                {message.content}
              </div>
            ))}
          </div>

          <form className="input-row" onSubmit={handleSubmit}>
            <textarea
              value={input}
              placeholder="Ask me to add, delete, or check off a todo…"
              onChange={(event) => setInput(event.target.value)}
              disabled={isSending}
            />
            <button type="submit" disabled={isSending}>
              Send
            </button>
          </form>
          {error ? <span style={{ color: '#f87171', marginTop: '0.5rem' }}>{error}</span> : null}
        </section>

        <section className="todos-panel">
          <h2>Todo list</h2>
          {todos.length === 0 ? (
            <p>No todos yet. Ask the assistant to create one.</p>
          ) : (
            <ul>
              {todos.map((todo) => (
                <li key={todo.id} className={`todo-item ${todo.done ? 'done' : ''}`}>
                  <strong>{todo.title}</strong>
                  {todo.description ? <div>{todo.description}</div> : null}
                  <div style={{ fontSize: '0.85rem', marginTop: '0.35rem', opacity: 0.8 }}>
                    {todo.due_date ? <span>Due: {todo.due_date}</span> : <span>No due date</span>}
                    {' • '}Status: {todo.done ? 'Done' : 'Open'}
                    {todo.priority === 1 ? ' • High priority' : ''}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <footer>Powered by OpenRouter + better-sqlite3 tools.</footer>
    </div>
  );
}
