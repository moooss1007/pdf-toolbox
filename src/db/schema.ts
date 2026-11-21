import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// The members who have used the app, keyed by the Gateway's user id.
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: integer("created_at").notNull(),
});

// Uploaded and generated files. The bytes live in R2 under `storageKey`.
export const files = sqliteTable(
  "files",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    kind: text("kind", { enum: ["pdf", "image"] }).notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    pageCount: integer("page_count"),
    storageKey: text("storage_key").notNull(),
    // The task that produced it; null for an upload.
    taskId: text("task_id"),
    // Order among the task's outputs.
    position: integer("position").notNull().default(0),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [
    index("files_owner_idx").on(table.ownerId, table.expiresAt),
    index("files_expiry_idx").on(table.expiresAt),
  ],
);

// One run of a tool: what went in, the options, and a summary of the result.
export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    tool: text("tool").notNull(),
    inputs: text("inputs", { mode: "json" }).$type<TaskInput[]>().notNull(),
    options: text("options", { mode: "json" }).notNull(),
    result: text("result", { mode: "json" }).$type<TaskResult>(),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [index("tasks_owner_idx").on(table.ownerId, table.createdAt)],
);

export interface TaskInput {
  id: string;
  name: string;
}

/** What a tool reports besides its files; only compress has anything. */
export interface TaskResult {
  originalSize: number;
  newSize: number;
  savedPercent: number;
  reduced: boolean;
}
