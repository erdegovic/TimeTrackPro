import { createHash } from "node:crypto";
import type { Request } from "express";
import { pool } from "./db";

type AdminAuditEvent = {
  action: string;
  targetUserId?: number | null;
  outcome?: "success" | "failure";
  details?: Record<string, unknown>;
};

function hashIp(req: Request) {
  const pepper = process.env.SESSION_SECRET || "local-development";
  return createHash("sha256")
    .update(`${pepper}:${req.ip || "unknown"}`)
    .digest("hex");
}

export async function recordAdminAuditEvent(req: Request, event: AdminAuditEvent) {
  const adminUserId = req.session?.userId;
  if (!adminUserId) return;

  try {
    await pool.query(
      `INSERT INTO admin_audit_events
        (admin_user_id, target_user_id, action, outcome, request_id, ip_hash, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        adminUserId,
        event.targetUserId ?? null,
        event.action,
        event.outcome || "success",
        String(req.res?.locals.requestId || ""),
        hashIp(req),
        event.details ? JSON.stringify(event.details) : null,
      ],
    );
  } catch (error) {
    console.error("Admin audit event could not be recorded:", error);
  }
}
