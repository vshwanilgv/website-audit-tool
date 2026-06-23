import { promises as fs } from "fs";
import path from "path";
import type { AuditLog } from "./types";

const LOGS_DIR = path.join(process.cwd(), "logs");

export async function writeAuditLog(log: AuditLog): Promise<void> {
  try {
    await fs.mkdir(LOGS_DIR, { recursive: true });
    const filePath = path.join(LOGS_DIR, `${log.audit_id}.json`);
    await fs.writeFile(filePath, JSON.stringify(log, null, 2), "utf-8");
  } catch (err) {
    console.error("[logger] Failed to write audit log:", err);
  }
}

export async function readRecentLogs(limit: number = 10): Promise<AuditLog[]> {
  try {
    await fs.mkdir(LOGS_DIR, { recursive: true });
    const files = await fs.readdir(LOGS_DIR);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    const logs: AuditLog[] = [];
    for (const file of jsonFiles) {
      try {
        const content = await fs.readFile(
          path.join(LOGS_DIR, file),
          "utf-8"
        );
        logs.push(JSON.parse(content) as AuditLog);
      } catch {
        // Skip malformed log files
      }
    }

    logs.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return logs.slice(0, limit);
  } catch {
    return [];
  }
}
