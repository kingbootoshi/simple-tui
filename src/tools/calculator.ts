export type CalculatorArgs = {
  operation: 'add' | 'subtract' | 'multiply' | 'divide';
  x: number[]; // first set of numbers
  y: number[]; // second set of numbers
};

// JSON schema tool definition for OpenAI tool calling
export const calculatorTool = {
  type: 'function',
  function: {
    name: 'calculator',
    description:
      'Perform basic arithmetic on two sets of numbers. Supports add, subtract, multiply, divide. Arrays may be broadcast if one side has length 1 or equal lengths.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        operation: {
          type: 'string',
          description: 'The arithmetic operation to perform',
          enum: ['add', 'subtract', 'multiply', 'divide'],
        },
        x: {
          type: 'array',
          description: 'First set of numbers (non-empty)',
          items: { type: 'number' },
          minItems: 1,
        },
        y: {
          type: 'array',
          description: 'Second set of numbers (non-empty)',
          items: { type: 'number' },
          minItems: 1,
        },
      },
      required: ['operation', 'x', 'y'],
    },
  },
} as const;

function elementwise(
  a: number[],
  b: number[],
  fn: (u: number, v: number) => number
): number[] | string {
  const n = a.length;
  const m = b.length;
  if (n === m) {
    return a.map((v, i) => fn(v, b[i]));
  }
  if (n === 1) {
    return b.map((v) => fn(a[0], v));
  }
  if (m === 1) {
    return a.map((v) => fn(v, b[0]));
  }
  return 'length_mismatch';
}

export function runCalculator(args: CalculatorArgs): { result: number | number[] } | { error: string } {
  const { operation, x, y } = args;
  if (!Array.isArray(x) || !Array.isArray(y) || x.length < 1 || y.length < 1) {
    return { error: 'x and y must be non-empty arrays of numbers' };
  }

  const op = operation;
  let out: number | number[] | string;
  switch (op) {
    case 'add':
      out = elementwise(x, y, (u, v) => u + v);
      break;
    case 'subtract':
      out = elementwise(x, y, (u, v) => u - v);
      break;
    case 'multiply':
      out = elementwise(x, y, (u, v) => u * v);
      break;
    case 'divide':
      out = elementwise(x, y, (u, v) => v === 0 ? Number.NaN : u / v);
      break;
    default:
      return { error: `Unsupported operation: ${op}` };
  }

  if (out === 'length_mismatch') {
    return { error: 'Array lengths must match, or one side must have length 1 to broadcast.' };
  }

  // Collapse singletons to a number for cleanliness
  if (Array.isArray(out) && out.length === 1) {
    return { result: out[0] };
  }
  return { result: out as number | number[] };
}

export type ToolDef = typeof calculatorTool;

