# Database Migrations

This directory contains SQL migration files for the database schema.

## Migration Files

1. **001_initial_schema.sql** - Core tables (users, sessions, projects, assets, shares, interactions)
2. **002_collaboration_tables.sql** - Collaboration features (collaborators, live sessions, user roles)
3. **003_community_features.sql** - Community features (charts, discovery, comments, remixes, notifications)

## Running Migrations

Migrations run automatically when the server starts. You can also run them manually:

```bash
# Run all pending migrations
npm run migrate

# Rollback last migration
npm run migrate:down
```

## Migration Format

Each migration file should have:
- `-- UP` section: SQL to apply the migration
- `-- DOWN` section: SQL to rollback the migration

Example:
```sql
-- UP
CREATE TABLE users (...);

-- DOWN
DROP TABLE users;
```

## Creating New Migrations

1. Create a new file: `00X_description.sql`
2. Add `-- UP` and `-- DOWN` sections
3. Run `npm run migrate`

