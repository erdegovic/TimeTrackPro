-- Personal API tokens for external agents (Atlas). Plaintext is never stored.
CREATE TABLE IF NOT EXISTS api_tokens (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  prefix text NOT NULL,
  scopes text NOT NULL DEFAULT '*',
  last_used_at timestamp,
  expires_at timestamp,
  revoked_at timestamp,
  created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS api_tokens_user_idx ON api_tokens(user_id);
