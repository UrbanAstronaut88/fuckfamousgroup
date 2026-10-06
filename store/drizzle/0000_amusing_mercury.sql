CREATE TABLE IF NOT EXISTS `notifications` (
	`order_id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt` integer DEFAULT 0 NOT NULL,
	`lock_until` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`message_id` integer,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `notification_due` ON `notifications` (`status`,`next_attempt`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `order_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` text NOT NULL,
	`product_id` integer NOT NULL,
	`title` text NOT NULL,
	`size` text NOT NULL,
	`quantity` integer NOT NULL,
	`price` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "item_quantity_positive" CHECK("order_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `order_product` ON `order_items` (`order_id`,`product_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`payload_hash` text NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`created_at` integer NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`consented_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `orders_phone_created` ON `orders` (`phone`,`created_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `products` (
	`id` integer PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`quantity` integer DEFAULT 0 NOT NULL,
	`slug` text NOT NULL,
	`size` text NOT NULL,
	`price` integer NOT NULL,
	`subtitle` text NOT NULL,
	`description` text NOT NULL,
	`image` text NOT NULL,
	`category` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	CONSTRAINT "stock_nonnegative" CHECK("products"."quantity" >= 0),
	CONSTRAINT "price_positive" CHECK("products"."price" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `product_variant` ON `products` (`slug`,`size`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);

