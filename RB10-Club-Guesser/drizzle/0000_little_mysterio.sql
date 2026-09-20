CREATE TABLE `game_registry` (
	`id` integer PRIMARY KEY NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`state` text DEFAULT '{"rooms":[]}' NOT NULL
);
