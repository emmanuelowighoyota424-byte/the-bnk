-- Provision a default USD checking account for existing customers who do not have one.
-- Account numbers are generated server-side and protected by the existing unique index.
DO $$
DECLARE
  customer RECORD;
  generated_number TEXT;
  inserted BOOLEAN;
BEGIN
  FOR customer IN
    SELECT u.id
    FROM "users" u
    WHERE NOT EXISTS (
      SELECT 1 FROM "accounts" a WHERE a.user_id = u.id AND a.status <> 'closed'
    )
  LOOP
    inserted := FALSE;
    WHILE NOT inserted LOOP
      generated_number := LPAD(FLOOR(random() * 1000000000000)::BIGINT::TEXT, 12, '0');
      BEGIN
        INSERT INTO "accounts" (
          "id", "user_id", "account_type", "account_number", "routing_number",
          "balance", "available_balance", "currency", "status", "opened_at"
        ) VALUES (
          md5(random()::TEXT || clock_timestamp()::TEXT || customer.id),
          customer.id,
          'checking',
          generated_number,
          '021000021',
          0,
          0,
          'USD',
          'active',
          CURRENT_TIMESTAMP
        );
        inserted := TRUE;
      EXCEPTION WHEN unique_violation THEN
        -- Retry if the generated account number collides with an existing number.
        inserted := FALSE;
      END;
    END LOOP;
  END LOOP;
END $$;
