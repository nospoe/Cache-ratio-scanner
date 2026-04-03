import { query } from "../client";

export async function auditLog(params: {
  event: string;
  scanId?: string;
  actor?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await query(
    `INSERT INTO audit_log (event, scan_id, actor, details) VALUES ($1, $2, $3, $4)`,
    [
      params.event,
      params.scanId ?? null,
      params.actor ?? "system",
      JSON.stringify(params.details ?? {}),
    ]
  );
}
