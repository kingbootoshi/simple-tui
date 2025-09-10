import 'dotenv/config';
import readline from 'readline';
import logger from '../lib/logger';
import { ChatMessage, chatWithTools } from '../ai/chat';
import { calculatorTool, runCalculator } from '../tools/calculator';
import { internetSearchTool, runInternetSearch } from '../tools/internetSearch';

// Silence non-error logs for a clean terminal UI
logger.level = 'error';

type AppState = {
  model: string | undefined;
  temperature: number;
  maxTokens?: number;
  system: string;
  messages: ChatMessage[];
};

function makeInitialMessages(system: string): ChatMessage[] {
  return [{ role: 'system', content: system }];
}

function printHelp(): void {
  const help = [
    'Commands:',
    '  /help                 Show this help',
    '  /exit | /quit         Exit the chat',
    '  /reset                Reset conversation (keeps current settings)',
    '  /system <text>        Set system prompt and reset conversation',
    '  /model <id>           Set model (e.g., openai/gpt-4o)',
    '  /temp <0..2>          Set temperature (number)',
    '  /maxtokens <n>        Set max tokens (optional cap)'
  ].join('\n');
  console.log(help);
}

async function main(): Promise<void> {
  const initialSystem = process.env.CHAT_SYSTEM_PROMPT || 'You are a concise, expert assistant.';
  const initialModel = process.env.OPENROUTER_DEFAULT_MODEL; // falls back inside chat()
  const initialTemp = process.env.CHAT_TEMPERATURE ? Number(process.env.CHAT_TEMPERATURE) : 0.7;
  const initialMaxTokens = process.env.CHAT_MAX_TOKENS ? Number(process.env.CHAT_MAX_TOKENS) : undefined;

  const state: AppState = {
    model: initialModel,
    temperature: Number.isFinite(initialTemp) ? initialTemp : 0.7,
    maxTokens: Number.isFinite(initialMaxTokens as number) ? initialMaxTokens : undefined,
    system: initialSystem,
    messages: makeInitialMessages(initialSystem),
  };

  console.log('─'.repeat(60));
  console.log('Terminal Chat – using OpenRouter via chat()');
  console.log(`Model: ${state.model || process.env.OPENROUTER_DEFAULT_MODEL || 'openai/gpt-4o'}`);
  console.log(`System: ${state.system}`);
  console.log("Type '/help' for commands. Press Ctrl+C or type /exit to quit.");
  console.log('─'.repeat(60));

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'You> ' });

  const handleLine = async (line: string) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    // Commands
    if (input === '/help') {
      printHelp();
      rl.prompt();
      return;
    }
    if (input === '/exit' || input === '/quit') {
      rl.close();
      return;
    }
    if (input === '/reset') {
      state.messages = makeInitialMessages(state.system);
      console.log('(conversation reset)');
      rl.prompt();
      return;
    }
    if (input.startsWith('/system ')) {
      const next = input.slice('/system '.length).trim();
      if (next.length === 0) {
        console.log('Usage: /system <text>');
      } else {
        state.system = next;
        state.messages = makeInitialMessages(state.system);
        console.log('(system prompt set and conversation reset)');
      }
      rl.prompt();
      return;
    }
    if (input.startsWith('/model ')) {
      const id = input.slice('/model '.length).trim();
      if (id.length === 0) {
        console.log('Usage: /model <id>');
      } else {
        state.model = id;
        console.log(`(model set to ${id})`);
      }
      rl.prompt();
      return;
    }
    if (input.startsWith('/temp ')) {
      const num = Number(input.slice('/temp '.length).trim());
      if (!Number.isFinite(num)) {
        console.log('Usage: /temp <number between 0 and 2>');
      } else {
        state.temperature = num;
        console.log(`(temperature set to ${num})`);
      }
      rl.prompt();
      return;
    }
    if (input.startsWith('/maxtokens ')) {
      const num = Number(input.slice('/maxtokens '.length).trim());
      if (!Number.isFinite(num)) {
        console.log('Usage: /maxtokens <integer>');
      } else {
        state.maxTokens = Math.max(1, Math.floor(num));
        console.log(`(maxTokens set to ${state.maxTokens})`);
      }
      rl.prompt();
      return;
    }

    // Normal message
    state.messages.push({ role: 'user', content: input });
    try {
      const { content } = await chatWithTools(state.messages, {
        model: state.model,
        temperature: state.temperature,
        maxTokens: state.maxTokens,
        tools: [calculatorTool, internetSearchTool],
        executors: {
          [calculatorTool.function.name]: runCalculator,
          [internetSearchTool.function.name]: runInternetSearch,
        },
      });
      console.log(`AI> ${content}\n`);
    } catch (err: any) {
      console.error('Error: failed to get a response. Check your network and OPENROUTER_API_KEY.');
    } finally {
      rl.prompt();
    }
  };

  rl.on('line', (line) => { void handleLine(line); });
  rl.on('SIGINT', () => rl.close());
  rl.on('close', () => {
    console.log('\nGoodbye!');
    process.exit(0);
  });

  rl.prompt();
}

void main();
