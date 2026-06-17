ALTER TABLE `chat_messages` ADD `relatedKnowledgeSnapshot` json;
--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `llmProvider` varchar(32);
--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `llmModel` varchar(128);
