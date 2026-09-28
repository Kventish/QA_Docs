import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

type ErrorContext = {
  action: string;
  entityType: string;
  entityId?: string;
};

function prismaCode(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
}

function isRelationConflict(error: unknown) {
  const code = prismaCode(error);
  if (code === "P2003" || code === "P2014") return true;

  // PostgreSQL RESTRICT may be wrapped by Prisma as an unknown request error.
  return error instanceof Prisma.PrismaClientUnknownRequestError
    && /code: "(?:23001|23503)"/.test(error.message);
}

function logMutationError(error: unknown, context: ErrorContext) {
  console.error("API mutation failed", {
    ...context,
    prismaCode: prismaCode(error),
    errorName: error instanceof Error ? error.name : typeof error
  });
}

export function deleteErrorResponse(error: unknown, context: ErrorContext) {
  const code = prismaCode(error);

  // DELETE remains idempotent: an already absent record has the requested end state.
  if (code === "P2025") {
    return NextResponse.json({ ok: true });
  }

  logMutationError(error, context);

  if (isRelationConflict(error)) {
    return NextResponse.json(
      { error: "Cannot delete because related data exists" },
      { status: 409 }
    );
  }

  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export function mutationErrorResponse(error: unknown, context: ErrorContext) {
  const code = prismaCode(error);
  logMutationError(error, context);

  if (code === "P2025") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (code === "P2002" || isRelationConflict(error)) {
    return NextResponse.json({ error: "Conflict with related data" }, { status: 409 });
  }

  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
