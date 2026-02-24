/**
 * Migration Runner CLI
 *
 * Usage:
 *   npm run db:migrate              - Run all pending migrations
 *   npm run db:migrate:down         - Rollback last migration
 *   npm run db:migrate:status       - Show migration status
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { FileMigrationProvider, Migrator } from "kysely";

import { closeDatabase, db } from "./client";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

const migrator = new Migrator({
  db,
  provider: new FileMigrationProvider({
    fs,
    path,
    migrationFolder: path.join(currentDirectory, "migrations"),
  }),
});

async function migrateToLatest(): Promise<void> {
  console.error("Running migrations...\n");

  const { error, results } = await migrator.migrateToLatest();

  if (results === undefined || results.length === 0) {
    console.error("No pending migrations\n");
  } else {
    for (const result of results) {
      if (result.status === "Success") {
        console.error(`  OK: ${result.migrationName}`);
      } else if (result.status === "Error") {
        console.error(`  FAIL: ${result.migrationName}`);
      }
    }
    console.error("");
  }

  if (error !== undefined) {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  }
}

async function migrateDown(): Promise<void> {
  console.error("Rolling back last migration...\n");

  const { error, results } = await migrator.migrateDown();

  if (results === undefined || results.length === 0) {
    console.error("No migrations to rollback\n");
  } else {
    for (const result of results) {
      if (result.status === "Success") {
        console.error(`  DOWN: ${result.migrationName}`);
      } else if (result.status === "Error") {
        console.error(`  FAIL: ${result.migrationName}`);
      }
    }
    console.error("");
  }

  if (error !== undefined) {
    console.error("Rollback failed:", error);
    process.exitCode = 1;
  }
}

async function showStatus(): Promise<void> {
  console.error("Migration status:\n");

  const migrations = await migrator.getMigrations();

  for (const migration of migrations) {
    const status = migration.executedAt === undefined ? "PENDING" : "DONE";
    const date =
      migration.executedAt === undefined ? "" : ` (${migration.executedAt.toISOString()})`;

    console.error(`  [${status}] ${migration.name}${date}`);
  }
  console.error("");
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? "latest";

  try {
    switch (command) {
      case "latest":
      case "up": {
        await migrateToLatest();
        break;
      }
      case "down": {
        await migrateDown();
        break;
      }
      case "status": {
        await showStatus();
        break;
      }
      default: {
        console.error(`Unknown command: ${command}`);
        console.error("Usage: migrate [latest|down|status]");
        process.exitCode = 1;
      }
    }
  } finally {
    await closeDatabase();
  }
}

void main();
