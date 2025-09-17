import { z } from 'zod';

const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/;

const dueDateSchema = z
  .string()
  .refine((value) => isoDateOnly.test(value) || !Number.isNaN(Date.parse(value)), {
    message: 'Due date must be ISO 8601 date (YYYY-MM-DD) or datetime.',
  });

export const AddTodoArgs = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).nullish(),
  due_date: dueDateSchema.nullish(),
  priority: z.union([z.literal(0), z.literal(1)]).default(0),
});

const SelectorSchema = z
  .object({
    kind: z.enum(['id', 'title']),
    id: z.number().int().positive().nullable().default(null),
    title: z.string().min(1).max(200).nullable().default(null),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.kind === 'id' && value.id == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['id'],
        message: 'Provide the numeric id when selector.kind is "id".',
      });
    }
    if (value.kind === 'title' && (!value.title || value.title.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['title'],
        message: 'Provide the exact title when selector.kind is "title".',
      });
    }
  });

export const DeleteTodoArgs = z
  .object({
    selector: SelectorSchema,
  })
  .strict();

export const CheckDoneArgs = z
  .object({
    selector: SelectorSchema,
    done: z.boolean().default(true),
  })
  .strict();

export type AddTodoInput = z.infer<typeof AddTodoArgs>;
export type DeleteTodoInput = z.infer<typeof DeleteTodoArgs>;
export type CheckDoneInput = z.infer<typeof CheckDoneArgs>;

export type ToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description: string;
    strict: true;
    parameters: Record<string, unknown>;
  };
};

export const toolDefinitions: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'add_todo',
      description: 'Create a new todo item.',
      strict: true,
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 200 },
          description: {
            type: ['string', 'null'],
            minLength: 1,
            description: 'Optional detail about the todo; provide null if not supplied.',
            default: null,
          },
          due_date: {
            type: ['string', 'null'],
            description:
              'ISO 8601 date or datetime (e.g., 2025-09-17 or 2025-09-17T09:00:00Z)',
            default: null,
          },
          priority: { type: 'integer', enum: [0, 1], default: 0 },
        },
        required: ['title', 'description', 'due_date', 'priority'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_todo',
      description: 'Delete a todo by id or by exact title.',
      strict: true,
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          selector: {
            type: 'object',
            additionalProperties: false,
            properties: {
              kind: { type: 'string', enum: ['id', 'title'] },
              id: { type: ['integer', 'null'], minimum: 1, default: null },
              title: {
                type: ['string', 'null'],
                minLength: 1,
                maxLength: 200,
                default: null,
              },
            },
            required: ['kind', 'id', 'title'],
          },
        },
        required: ['selector'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_done',
      description: 'Mark a todo as done by id or exact title.',
      strict: true,
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          selector: {
            type: 'object',
            additionalProperties: false,
            properties: {
              kind: { type: 'string', enum: ['id', 'title'] },
              id: { type: ['integer', 'null'], minimum: 1, default: null },
              title: {
                type: ['string', 'null'],
                minLength: 1,
                maxLength: 200,
                default: null,
              },
            },
            required: ['kind', 'id', 'title'],
          },
          done: { type: 'boolean', default: true },
        },
        required: ['selector', 'done'],
      },
    },
  },
];

export const toolNames = toolDefinitions.map((tool) => tool.function.name);
