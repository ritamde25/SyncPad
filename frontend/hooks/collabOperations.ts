export interface Operation {
  type: "insert" | "delete";
  position: number;
  value?: string;
  length?: number;
  clientId: string;
  opId: string;
  version: number;
}

export type OperationDraft = Omit<Operation, "opId">;

function clampPosition(position: number, contentLength: number): number {
  return Math.max(0, Math.min(position, contentLength));
}

function getInsertLength(op: Operation): number {
  return op.value?.length ?? 0;
}

function getDeleteLength(op: Operation): number {
  return Math.max(0, op.length ?? 0);
}

function cloneOperation(op: Operation): Operation {
  return {
    ...op,
    value: op.value,
  };
}

export function transform(incoming: Operation, existing: Operation): Operation {
  const transformed = cloneOperation(incoming);

  if (existing.type === "insert") {
    const existingLength = getInsertLength(existing);

    if (transformed.type === "insert") {
      if (transformed.position > existing.position) {
        transformed.position += existingLength;
      } else if (
        transformed.position === existing.position &&
        transformed.opId > existing.opId
      ) {
        transformed.position += existingLength;
      }
      return transformed;
    }

    if (transformed.position >= existing.position) {
      transformed.position += existingLength;
    }

    return transformed;
  }

  const existingLength = getDeleteLength(existing);

  if (transformed.type === "insert") {
    if (transformed.position > existing.position + existingLength) {
      transformed.position -= existingLength;
    } else if (transformed.position >= existing.position) {
      transformed.position = existing.position;
    }

    return transformed;
  }

  const incomingStart = transformed.position;
  const incomingLength = getDeleteLength(transformed);
  const incomingEnd = incomingStart + incomingLength;
  const existingStart = existing.position;
  const existingEnd = existing.position + existingLength;

  if (incomingEnd <= existingStart) {
    return transformed;
  }

  if (incomingStart >= existingEnd) {
    transformed.position -= existingLength;
    return transformed;
  }

  if (incomingStart < existingStart) {
    if (incomingEnd > existingEnd) {
      transformed.length = Math.max(0, incomingLength - existingLength);
      return transformed;
    }

    const overlap = incomingEnd - existingStart;
    transformed.length = Math.max(0, incomingLength - overlap);
    return transformed;
  }

  const overlapInsideDelete = existingEnd - incomingStart;
  transformed.position = existingStart;
  transformed.length = Math.max(0, incomingLength - overlapInsideDelete);

  return transformed;
}

export function applyOperationToContent(currentContent: string, operation: Operation): string {
  const position = clampPosition(operation.position, currentContent.length);

  if (operation.type === "insert") {
    return (
      currentContent.slice(0, position) +
      (operation.value || "") +
      currentContent.slice(position)
    );
  }

  const length = Math.max(0, operation.length || 0);
  return currentContent.slice(0, position) + currentContent.slice(position + length);
}

export function deriveOperations(
  previousContent: string,
  nextContent: string,
  clientId: string,
  baseVersion: number
): OperationDraft[] {
  if (previousContent === nextContent) {
    return [];
  }

  let start = 0;
  while (
    start < previousContent.length &&
    start < nextContent.length &&
    previousContent[start] === nextContent[start]
  ) {
    start += 1;
  }

  let previousEnd = previousContent.length - 1;
  let nextEnd = nextContent.length - 1;

  while (
    previousEnd >= start &&
    nextEnd >= start &&
    previousContent[previousEnd] === nextContent[nextEnd]
  ) {
    previousEnd -= 1;
    nextEnd -= 1;
  }

  const removedText = previousContent.slice(start, previousEnd + 1);
  const insertedText = nextContent.slice(start, nextEnd + 1);

  const operations: OperationDraft[] = [];

  if (removedText.length > 0) {
    operations.push({
      type: "delete",
      position: start,
      length: removedText.length,
      clientId,
      version: baseVersion,
    });
  }

  if (insertedText.length > 0) {
    operations.push({
      type: "insert",
      position: start,
      value: insertedText,
      clientId,
      version: baseVersion + operations.length,
    });
  }

  return operations;
}