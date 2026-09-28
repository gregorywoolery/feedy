import { NextResponse } from "next/server";
import type { ZodError } from "zod";

import type { ApiErrorBody } from "@/entities/contracts/api";

export function errorResponse(
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string[]>,
) {
  return NextResponse.json<ApiErrorBody>(
    { error: { code, message, ...(fields ? { fields } : {}) } },
    { status },
  );
}

export function validationErrorResponse(error: ZodError) {
  return errorResponse(
    400,
    "VALIDATION_ERROR",
    "Please correct the highlighted fields.",
    error.flatten().fieldErrors as Record<string, string[]>,
  );
}
