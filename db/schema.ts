import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const updates = sqliteTable('updates', {
 id: text('id').primaryKey(),
 payload: text('payload').notNull(),
 version: integer('version').notNull(),
 updatedAt: text('updated_at').notNull(),
 updatedBy: text('updated_by').notNull(),
});

export const customItems = sqliteTable('custom_items', {
 id: text('id').primaryKey(),
 kind: text('kind', {enum:['problems','flows','untested','deliverables']}).notNull(),
 payload: text('payload').notNull(),
 version: integer('version').notNull().default(1),
 updatedAt: text('updated_at').notNull(),
 updatedBy: text('updated_by').notNull(),
});

export const deletedItems = sqliteTable('deleted_items', {
 id: text('id').primaryKey(),
 deletedAt: text('deleted_at').notNull(),
 deletedBy: text('deleted_by').notNull(),
});
