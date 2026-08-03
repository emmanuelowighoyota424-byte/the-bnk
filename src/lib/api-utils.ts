import { z } from 'zod';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
}

export function successResponse<T>(data: T, status = 200): Response {
  return Response.json({ success: true, data } as ApiResponse<T>, { status });
}

export function errorResponse(error: string, status = 400, errors?: Record<string, string[]>): Response {
  return Response.json({ success: false, error, ...(errors && { errors }) } as ApiResponse, { status });
}

export function unauthorizedResponse(message = 'Unauthorized'): Response {
  return errorResponse(message, 401);
}

export function forbiddenResponse(message = 'Forbidden'): Response {
  return errorResponse(message, 403);
}

export function notFoundResponse(message = 'Not found'): Response {
  return errorResponse(message, 404);
}

export function validateBody<T extends z.ZodType>(
  schema: T,
  body: unknown
): { success: true; data: z.infer<T> } | { success: false; errors: Record<string, string[]> } {
  const result = schema.safeParse(body);
  if (!result.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_root';
      if (!errors[key]) errors[key] = [];
      errors[key].push(issue.message);
    }
    return { success: false, errors };
  }
  return { success: true, data: result.data };
}