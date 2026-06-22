# Database Migrations Workflow

We use Supabase CLI to manage database migrations. This ensures versioning, repeatability, and predictability across development, staging, and production environments.

## Directory Structure

- `supabase/migrations/`: Contains versioned, idempotent `.sql` migration files.
- `supabase/legacy_sql/`: Legacy raw schema files (archived for reference; do not run directly on new setups).

## Managing Migrations locally

### 1. Apply Migrations Locally
To apply all pending migrations to your local Supabase Docker instance:
```bash
supabase db reset
```
This resets the local database and reapplies all migrations in chronological order.

To apply changes without resetting:
```bash
supabase db push
```

### 2. Generate a New Migration
To create a new empty versioned migration:
```bash
supabase migration new <migration_name>
```
Write your schema changes inside the generated file at `supabase/migrations/<timestamp>_<migration_name>.sql`.

### 3. Check Migration Status
To check which migrations have been applied:
```bash
supabase db list
```

## Production Deployment

Apply migrations to production using the Supabase CLI:
```bash
supabase db push --db-url "postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres"
```

## Rollbacks and Idempotency

- **Idempotency:** All migrations are written defensively using `CREATE TABLE IF NOT EXISTS`, `DROP INDEX IF EXISTS`, and `CREATE OR REPLACE FUNCTION` to ensure they can be rerun without errors.
- **Rollbacks:** 
  - To rollback a migration, write a corresponding down script to revert columns/tables (e.g. `DROP FUNCTION`, `ALTER TABLE DROP COLUMN`).
  - Standard Postgres rollbacks cannot be fully automated; execute rollback SQL manually via the Supabase Dashboard SQL Editor or using `psql`.
