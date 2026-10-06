ALTER TABLE `admin_sessions` ADD `last_seen` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `admin_sessions` ADD `credential_hash` text DEFAULT '' NOT NULL;