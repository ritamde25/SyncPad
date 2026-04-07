import type { Operation } from "../types/operation.js";

function operationOrderKey(op: Operation): string {
  return op.opId;
}

function cloneOperation(op: Operation): Operation {
  return {
    ...op,
    value: op.value,
  };
}

function getInsertLength(op: Operation): number {
  return op.value?.length ?? 0;
}

function getDeleteLength(op: Operation): number {
  return Math.max(0, op.length ?? 0);
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
        operationOrderKey(transformed) > operationOrderKey(existing)
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
    const overlap = incomingEnd - existingStart;
    transformed.length = Math.max(0, incomingLength - overlap);
    return transformed;
  }

  const overlapInsideDelete = existingEnd - incomingStart;
  transformed.position = existingStart;
  transformed.length = Math.max(0, incomingLength - overlapInsideDelete);

  return transformed;
}
