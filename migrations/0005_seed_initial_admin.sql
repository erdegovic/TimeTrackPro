UPDATE "users"
SET "role" = 'admin',
    "status" = 'active',
    "updated_at" = NOW()
WHERE "email" = 'erdegovic@gmail.com';
