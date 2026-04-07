"use client";

import { generateId } from "@/hooks/socketProtocol";

export function getUserId(): string {
  let userId = localStorage.getItem("userId");

  if (!userId) {
    userId = generateId("user");
    localStorage.setItem("userId", userId);
  }

  return userId;
}
