import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
export const gameRegistry = sqliteTable("game_registry", {
 id: integer("id").primaryKey(),
 version: integer("version").notNull().default(0),
 state: text("state").notNull().default('{"rooms":[]}'),
});
