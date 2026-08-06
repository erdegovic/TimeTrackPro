import type { Request } from "express";
import { pool } from "./db";

export async function revokeUserSessions(userId: number, exceptSessionId?: string) {
  if (exceptSessionId) {
    await pool.query(
      `DELETE FROM express_sessions
       WHERE sess->>'userId' = $1 AND sid <> $2`,
      [String(userId), exceptSessionId],
    );
    return;
  }

  await pool.query(
    `DELETE FROM express_sessions WHERE sess->>'userId' = $1`,
    [String(userId)],
  );
}

export async function establishAuthenticatedSession(
  req: Request,
  userId: number,
  authMethod: "password" | "google",
) {
  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((error) => error ? reject(error) : resolve());
  });

  req.session.userId = userId;
  req.session.authMethod = authMethod;
  req.session.authenticatedAt = Date.now();
  delete req.session.adminReauthenticatedAt;

  await new Promise<void>((resolve, reject) => {
    req.session.save((error) => error ? reject(error) : resolve());
  });
}
