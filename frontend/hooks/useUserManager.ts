"use client";

import { useState, useEffect } from "react";
import { generateId } from "./socketProtocol";

interface UserInfo {
  id: string;
  name: string;
}

const USER_STORAGE_KEY = "syncpad_user";

export function getClientDisplayName(userId: string): string {
  const shortId = userId.split("-")[1]?.slice(0, 4) || userId.slice(0, 4);
  return `User${shortId.toUpperCase()}`;
}

export function getClientColor(userId: string): string {
  let hash = 2166136261;
  for (let i = 0; i < userId.length; i += 1) {
    hash ^= userId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const hue = (hash >>> 0) % 360;
  return `hsl(${hue} 72% 48%)`;
}

export function getInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

function getOrCreateUser(): UserInfo {
  const storedUser = localStorage.getItem(USER_STORAGE_KEY);

  if (storedUser) {
    try {
      const parsed = JSON.parse(storedUser) as Partial<UserInfo>;
      if (parsed.id && parsed.name) {
        return { id: parsed.id, name: parsed.name };
      }
    } catch {

    }
  }

  const userId = generateId("user");
  const newUser: UserInfo = {
    id: userId,
    name: getClientDisplayName(userId),
  };

  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
  return newUser;
}

export function useUserManager() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const currentUser = getOrCreateUser();
    setUser(currentUser);
    setMounted(true);
  }, []);

  const updateUserName = (name: string) => {
    if (!user) return;

    const updatedName = name.trim() || getClientDisplayName(user.id);
    const updatedUser = { ...user, name: updatedName };

    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  return {
    user,
    mounted,
    updateUserName,
  };
}
