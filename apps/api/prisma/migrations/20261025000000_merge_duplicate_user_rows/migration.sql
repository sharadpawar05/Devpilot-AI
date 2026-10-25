-- One person ended up with two local users: their Supabase sub changed, so
-- resolveLocalUserId provisioned a second row while the older one still held
-- their email and 67 AI-history sessions. Fold the older row into the one the
-- current sub points at, so profile healing has a single row to own.
--
-- Guarded: every step no-ops when either row is missing, so this is safe to
-- replay and safe on environments that never had the duplicate.

DO $$
DECLARE
    old_id     CONSTANT uuid := '2956dbc3-4f3b-454e-af08-82ff21fe731f';
    new_id     CONSTANT uuid := 'ef1b8dde-a6a9-4187-86d5-29d510e92515';
    old_email  text;
    old_name   text;
    old_avatar text;
BEGIN
    SELECT email, "fullName", "avatarUrl"
      INTO old_email, old_name, old_avatar
      FROM users
     WHERE id = old_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = new_id) THEN
        RETURN;
    END IF;

    -- Children with no cross-user unique key: repoint outright.
    UPDATE ai_history_sessions   SET "userId" = new_id WHERE "userId" = old_id;
    UPDATE ai_usage_events       SET "userId" = new_id WHERE "userId" = old_id;
    UPDATE repository_indexes    SET "userId" = new_id WHERE "userId" = old_id;
    UPDATE repo_health_snapshots SET "userId" = new_id WHERE "userId" = old_id;
    UPDATE audit_logs            SET "userId" = new_id WHERE "userId" = old_id;
    UPDATE notifications         SET "userId" = new_id WHERE "userId" = old_id;
    UPDATE ai_reports            SET "createdBy" = new_id WHERE "createdBy" = old_id;

    -- user_usage is unique on (userId, periodStart): take every period the
    -- surviving row does not already have, then add the shared period's
    -- counters together instead of dropping one.
    UPDATE user_usage
       SET "userId" = new_id
     WHERE "userId" = old_id
       AND NOT EXISTS (
            SELECT 1
              FROM user_usage other
             WHERE other."userId" = new_id
               AND other."periodStart" = user_usage."periodStart"
       );

    UPDATE user_usage survivor
       SET "aiCreditsUsed"    = survivor."aiCreditsUsed" + owner."aiCreditsUsed",
           "healthScansUsed"  = survivor."healthScansUsed" + owner."healthScansUsed",
           "aiReportsUsed"    = survivor."aiReportsUsed" + owner."aiReportsUsed",
           "chatMessagesUsed" = survivor."chatMessagesUsed" + owner."chatMessagesUsed"
      FROM user_usage owner
     WHERE owner."userId" = old_id
       AND survivor."userId" = new_id
       AND survivor."periodStart" = owner."periodStart";

    DELETE FROM user_usage WHERE "userId" = old_id;

    -- user_settings is unique on userId: adopt the older row's only when the
    -- surviving row has none yet, otherwise keep the current one.
    UPDATE user_settings
       SET "userId" = new_id
     WHERE "userId" = old_id
       AND NOT EXISTS (SELECT 1 FROM user_settings s WHERE s."userId" = new_id);
    DELETE FROM user_settings WHERE "userId" = old_id;

    DELETE FROM users WHERE id = old_id;

    -- The address is free again: fill in what the surviving row is missing.
    UPDATE users
       SET email = CASE
                     WHEN email LIKE '%@placeholder.local'
                      AND old_email IS NOT NULL AND old_email <> ''
                     THEN old_email
                     ELSE email
                   END,
           "fullName" = CASE
                          WHEN "fullName" = 'User'
                           AND old_name IS NOT NULL AND old_name <> ''
                          THEN old_name
                          ELSE "fullName"
                        END,
           "avatarUrl" = CASE
                           WHEN ("avatarUrl" IS NULL OR "avatarUrl" = '')
                            AND old_avatar IS NOT NULL AND old_avatar <> ''
                           THEN old_avatar
                           ELSE "avatarUrl"
                         END
     WHERE id = new_id;
END $$;
