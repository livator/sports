ALTER TABLE `article` ADD `title_en` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `article` ADD `title_ru` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `article` ADD `title_ro` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `article` ADD `summary_en` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `article` ADD `summary_ru` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `article` ADD `summary_ro` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `article` ADD `body_en` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `article` ADD `body_ru` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `article` ADD `body_ro` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `article` DROP COLUMN `title`;--> statement-breakpoint
ALTER TABLE `article` DROP COLUMN `summary`;--> statement-breakpoint
ALTER TABLE `article` DROP COLUMN `body`;
