CREATE TABLE `article` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`league_slug` text,
	`tag` text DEFAULT '' NOT NULL,
	`title` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`author` text DEFAULT '' NOT NULL,
	`image_url` text,
	`caption` text DEFAULT '' NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`comments_on` integer DEFAULT true NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`published_at` integer,
	`editor_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`editor_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `article_public_idx` ON `article` (`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `article_updated_idx` ON `article` (`updated_at`);--> statement-breakpoint
ALTER TABLE `session` ADD `impersonated_by` text;--> statement-breakpoint
ALTER TABLE `user` ADD `role` text;--> statement-breakpoint
ALTER TABLE `user` ADD `banned` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `user` ADD `ban_reason` text;--> statement-breakpoint
ALTER TABLE `user` ADD `ban_expires` integer;