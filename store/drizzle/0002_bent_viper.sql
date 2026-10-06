CREATE TABLE `admin_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `admin_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `products` ADD `title_en` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `subtitle_en` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `description_en` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `is_demo` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `archived` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
INSERT OR IGNORE INTO settings (key,value) VALUES ('catalog_revision','0');
--> statement-breakpoint
UPDATE products SET title_en='Original T-shirt',subtitle_en='Black / relaxed fit',description_en='A black Fuck Famous Group print T-shirt. A relaxed silhouette, stripped back to what matters.',is_demo=1 WHERE slug='original-tee' AND image='/images/tshirt.png';
--> statement-breakpoint
UPDATE products SET title_en='FFG Hoodie',subtitle_en='Black / relaxed fit',description_en='An oversized black FFG hoodie. Everyday merch for those on the same wavelength.',is_demo=1 WHERE slug='ffg-hoodie' AND image='/images/hoodie.png';
--> statement-breakpoint
UPDATE products SET title_en='FFG Cap',subtitle_en='Black / adjustable fit',description_en='A black cap with FFG embroidery and an adjustable strap. A simple everyday detail.',is_demo=1 WHERE slug='ffg-cap' AND image='/images/cap.png';
