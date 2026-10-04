export interface User {
  id: string;
  email: string;
  displayName: string;
  role: string;
  avatarUrl?: string | null;
  theme: string;
  locale: string;
  persona: string;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: User;
}

export interface Conversation {
  id: string;
  title: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export type Role = "USER" | "ASSISTANT" | "SYSTEM";

export interface Message {
  id: string;
  role: Role;
  content: string;
  tokens: number;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Reminder {
  id: string;
  title: string;
  notes?: string | null;
  remindAt: string;
  recurrence: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
  completed: boolean;
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  color: string;
}

export interface MemoryItem {
  id: string;
  content: string;
  kind: "FACT" | "PREFERENCE" | "EVENT" | "GOAL";
  importance: number;
  source: string;
  createdAt: string;
}

export interface NovaNotification {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  read: boolean;
  actionUrl?: string | null;
  createdAt: string;
}

export interface DashboardSummary {
  tasks: { total: number; todo: number; inProgress: number; done: number };
  notes: number;
  remindersPending: number;
  upcomingEvents: number;
  conversations: number;
  memories: number;
  unreadNotifications: number;
}

/** Holographic HUD card emitted while NOVA uses a tool. */
export interface ToolCard {
  id: string;
  tool: string;
  phase: "start" | "done";
  title: string;
  subtitle?: string;
  status: "running" | "ok" | "warn" | "danger" | "error";
  text?: string;
  gauge?: number;
  metrics?: { label: string; value: string | number }[];
}

export interface Protocol {
  id: string | null;
  name: string;
  steps: string;
  builtIn: boolean;
}
