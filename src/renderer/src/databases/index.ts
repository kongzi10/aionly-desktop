/**
 * @deprecated Scheduled for removal in v2.0.0
 * --------------------------------------------------------------------------
 * ⚠️ NOTICE: V2 DATA&UI REFACTORING (by 0xfullex)
 * --------------------------------------------------------------------------
 * STOP: Feature PRs affecting this file are currently BLOCKED.
 * Only critical bug fixes are accepted during this migration phase.
 *
 * This file is being refactored to v2 standards.
 * Any non-critical changes will conflict with the ongoing work.
 *
 * 🔗 Context & Status:
 * --------------------------------------------------------------------------
 */
import type {
  CustomTranslateLanguage,
  FileMetadata,
  KnowledgeNoteItem,
  QuickPhrase,
  TranslateHistory
} from '@renderer/types'
// Import necessary types for blocks and new message structure
import type { Message as NewMessage, MessageBlock } from '@renderer/types/newMessage'
import { Dexie, type EntityTable } from 'dexie'

import { getActiveProfileId, getDexieDatabaseName } from '../services/ProfileStorageService'
import { upgradeToV5, upgradeToV7, upgradeToV8 } from './upgrades'

export type AppDatabase = Dexie & {
  files: EntityTable<FileMetadata, 'id'>
  topics: EntityTable<{ id: string; messages: NewMessage[] }, 'id'> // Correct type for topics
  settings: EntityTable<{ id: string; value: any }, 'id'>
  knowledge_notes: EntityTable<KnowledgeNoteItem, 'id'>
  translate_history: EntityTable<TranslateHistory, 'id'>
  quick_phrases: EntityTable<QuickPhrase, 'id'>
  message_blocks: EntityTable<MessageBlock, 'id'> // Correct type for message_blocks
  translate_languages: EntityTable<CustomTranslateLanguage, 'id'>
}

function createDatabase(): AppDatabase {
  const databaseName = getActiveProfileId() ? getDexieDatabaseName() : 'AiOnly-login'
  const database = new Dexie(databaseName, {
    chromeTransactionDurability: 'strict'
  }) as AppDatabase

  database.version(1).stores({
    files: 'id, name, origin_name, path, size, ext, type, created_at, count'
  })

  database.version(2).stores({
    files: 'id, name, origin_name, path, size, ext, type, created_at, count',
    topics: '&id, messages',
    settings: '&id, value'
  })

  database.version(3).stores({
    files: 'id, name, origin_name, path, size, ext, type, created_at, count',
    topics: '&id, messages',
    settings: '&id, value',
    knowledge_notes: '&id, baseId, type, content, created_at, updated_at'
  })

  database.version(4).stores({
    files: 'id, name, origin_name, path, size, ext, type, created_at, count',
    topics: '&id, messages',
    settings: '&id, value',
    knowledge_notes: '&id, baseId, type, content, created_at, updated_at',
    translate_history: '&id, sourceText, targetText, sourceLanguage, targetLanguage, createdAt'
  })

  database
    .version(5)
    .stores({
      files: 'id, name, origin_name, path, size, ext, type, created_at, count',
      topics: '&id, messages',
      settings: '&id, value',
      knowledge_notes: '&id, baseId, type, content, created_at, updated_at',
      translate_history: '&id, sourceText, targetText, sourceLanguage, targetLanguage, createdAt'
    })
    .upgrade((tx) => upgradeToV5(tx))

  database.version(6).stores({
    files: 'id, name, origin_name, path, size, ext, type, created_at, count',
    topics: '&id, messages',
    settings: '&id, value',
    knowledge_notes: '&id, baseId, type, content, created_at, updated_at',
    translate_history: '&id, sourceText, targetText, sourceLanguage, targetLanguage, createdAt',
    quick_phrases: 'id'
  })

  // --- NEW VERSION 7 ---
  database
    .version(7)
    .stores({
      // Redeclare all tables for the new version
      files: 'id, name, origin_name, path, size, ext, type, created_at, count',
      topics: '&id', // Correct index for topics
      settings: '&id, value',
      knowledge_notes: '&id, baseId, type, content, created_at, updated_at',
      translate_history: '&id, sourceText, targetText, sourceLanguage, targetLanguage, createdAt',
      quick_phrases: 'id',
      message_blocks: 'id, messageId, file.id' // Correct syntax with comma separator
    })
    .upgrade((tx) => upgradeToV7(tx))

  database
    .version(8)
    .stores({
      // Redeclare all tables for the new version
      files: 'id, name, origin_name, path, size, ext, type, created_at, count',
      topics: '&id', // Correct index for topics
      settings: '&id, value',
      knowledge_notes: '&id, baseId, type, content, created_at, updated_at',
      translate_history: '&id, sourceText, targetText, sourceLanguage, targetLanguage, createdAt',
      quick_phrases: 'id',
      message_blocks: 'id, messageId, file.id' // Correct syntax with comma separator
    })
    .upgrade((tx) => upgradeToV8(tx))

  database.version(9).stores({
    // Redeclare all tables for the new version
    files: 'id, name, origin_name, path, size, ext, type, created_at, count',
    topics: '&id', // Correct index for topics
    settings: '&id, value',
    knowledge_notes: '&id, baseId, type, content, created_at, updated_at',
    translate_history: '&id, sourceText, targetText, sourceLanguage, targetLanguage, createdAt',
    translate_languages: '&id, langCode',
    quick_phrases: 'id',
    message_blocks: 'id, messageId, file.id' // Correct syntax with comma separator
  })

  database.version(10).stores({
    files: 'id, name, origin_name, path, size, ext, type, created_at, count',
    topics: '&id',
    settings: '&id, value',
    knowledge_notes: '&id, baseId, type, content, created_at, updated_at',
    translate_history: '&id, sourceText, targetText, sourceLanguage, targetLanguage, createdAt',
    translate_languages: '&id, langCode',
    quick_phrases: 'id',
    message_blocks: 'id, messageId, file.id'
  })

  return database
}

export let db = createDatabase()

export function resetDatabase(): AppDatabase {
  db.close()
  db = createDatabase()
  return db
}

export { db as default }
