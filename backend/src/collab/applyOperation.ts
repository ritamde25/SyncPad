import type { Operation } from "../types/operation.js";

function clampPosition(position: number, contentLength: number): number {
  return Math.max(0, Math.min(position, contentLength));
}

export function applyOperation(content: string, op: Operation): string {
  const position = clampPosition(op.position, content.length);

  if (op.type === "insert") {
    const value = op.value ?? "";
    return content.slice(0, position) + value + content.slice(position);
  }

  const length = Math.max(0, op.length ?? 0);
  return content.slice(0, position) + content.slice(position + length);
}
