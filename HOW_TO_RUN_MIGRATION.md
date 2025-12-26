# How to Run the Migration - Step by Step

## Option 1: Using psql Command Line (Easiest)

### Step 1: Connect to your database
```bash
psql -d your_database_name -U your_username
```

**Or if you have DATABASE_URL:**
```bash
psql $DATABASE_URL
```

### Step 2: Paste the SQL
Once connected, you'll see a prompt like `your_database_name=#`. Then paste:

```sql
ALTER TABLE ai_agents 
ADD COLUMN IF NOT EXISTS calendar_integration_id INTEGER REFERENCES integrations(id);

CREATE INDEX IF NOT EXISTS idx_ai_agents_calendar_integration ON ai_agents(calendar_integration_id);
```

### Step 3: Press Enter
You should see:
```
ALTER TABLE
CREATE INDEX
```

### Step 4: Exit
Type `\q` and press Enter to exit psql.

---

## Option 2: One-Line Command (No Interactive Session)

If you know your database connection details:

```bash
psql -d your_database_name -U your_username -c "ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS calendar_integration_id INTEGER REFERENCES integrations(id); CREATE INDEX IF NOT EXISTS idx_ai_agents_calendar_integration ON ai_agents(calendar_integration_id);"
```

**Or using DATABASE_URL:**
```bash
psql $DATABASE_URL -c "ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS calendar_integration_id INTEGER REFERENCES integrations(id); CREATE INDEX IF NOT EXISTS idx_ai_agents_calendar_integration ON ai_agents(calendar_integration_id);"
```

---

## Option 3: Using the SQL File

```bash
psql -d your_database_name -U your_username -f backend/config/add-calendar-integration-to-agents.sql
```

**Or:**
```bash
psql $DATABASE_URL -f backend/config/add-calendar-integration-to-agents.sql
```

---

## Option 4: Using Node.js Script

```bash
cd /Users/muhammadharis/Developer/EHealthMedAI
node backend/scripts/run-calendar-integration-migration.js
```

**Note**: This requires database credentials in `.env` file.

---

## Option 5: Using Database GUI Tool

1. Open pgAdmin, DBeaver, TablePlus, or any PostgreSQL client
2. Connect to your database
3. Open a SQL query window
4. Paste the SQL:
```sql
ALTER TABLE ai_agents 
ADD COLUMN IF NOT EXISTS calendar_integration_id INTEGER REFERENCES integrations(id);

CREATE INDEX IF NOT EXISTS idx_ai_agents_calendar_integration ON ai_agents(calendar_integration_id);
```
5. Click "Execute" or press F5

---

## Quick Check: What's Your Database Setup?

### If you have DATABASE_URL in .env:
```bash
# Check if it exists
grep DATABASE_URL backend/.env

# Then use:
psql $DATABASE_URL -f backend/config/add-calendar-integration-to-agents.sql
```

### If you have individual DB_* variables:
```bash
# Check what you have
grep DB_ backend/.env

# Then use:
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f backend/config/add-calendar-integration-to-agents.sql
```

### If you don't know:
1. Check your `.env` file in `backend/.env`
2. Look for `DATABASE_URL` or `DB_HOST`, `DB_USER`, `DB_NAME`
3. Use the appropriate method above

---

## Verify Migration Worked

After running, verify it worked:

```sql
-- Check if column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'ai_agents' 
AND column_name = 'calendar_integration_id';

-- Should return 1 row with the column info
```

Or in psql:
```bash
psql $DATABASE_URL -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'ai_agents' AND column_name = 'calendar_integration_id';"
```

---

## Troubleshooting

### Error: "relation ai_agents does not exist"
- Your database might use a different schema
- Try: `psql -d your_db -c "SET search_path TO public; ALTER TABLE ai_agents ..."`

### Error: "permission denied"
- You need superuser or table owner permissions
- Contact your database administrator

### Error: "column already exists"
- Migration already ran - this is safe to ignore
- The `IF NOT EXISTS` clause prevents errors

---

## Recommended Method

**For most users, I recommend Option 3 (using the SQL file):**

```bash
cd /Users/muhammadharis/Developer/EHealthMedAI
psql $DATABASE_URL -f backend/config/add-calendar-integration-to-agents.sql
```

This is the cleanest and easiest way!

