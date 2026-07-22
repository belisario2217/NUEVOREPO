import { Router } from "express";
import { logActivity, requirePermission, type AuthenticatedRequest } from "../auth.js";
import { all, get, run } from "../db.js";
import { ApiError, asId, cleanText, optionalText } from "../utils.js";

export const messagesRouter = Router();

function validTargetType(value: unknown): "all" | "group" | "student" {
  const text = cleanText(value || "all", 20);
  if (text === "all" || text === "group" || text === "student") return text;
  throw new ApiError(400, "El alcance del mensaje no es valido.");
}

function validPriority(value: unknown): "info" | "warning" | "urgent" {
  const text = cleanText(value || "info", 20);
  if (text === "info" || text === "warning" || text === "urgent") return text;
  throw new ApiError(400, "La prioridad del mensaje no es valida.");
}

function validDateOrNull(value: unknown) {
  const text = optionalText(value, 10);
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new ApiError(400, "La fecha debe tener formato AAAA-MM-DD.");
  return text;
}

function messageBody(body: any) {
  const targetType = validTargetType(body.targetType);
  const targetId = targetType === "all" ? null : asId(body.targetId, targetType === "group" ? "Grupo" : "Alumno");
  const title = cleanText(body.title, 120);
  const message = cleanText(body.body, 2000);
  if (!title || !message) throw new ApiError(400, "El titulo y mensaje son obligatorios.");
  return {
    targetType,
    targetId,
    title,
    body: message,
    priority: validPriority(body.priority),
    startsAt: validDateOrNull(body.startsAt),
    endsAt: validDateOrNull(body.endsAt),
    isActive: body.isActive === false ? 0 : 1
  };
}

messagesRouter.get("/", requirePermission("messages.view"), (_req, res) => {
  res.json({
    records: all(
      `SELECT m.*, g.name AS group_name, st.student_number,
       TRIM(st.first_name || ' ' || st.last_name || ' ' || COALESCE(st.second_last_name, '')) AS student_name
       FROM portal_messages m
       LEFT JOIN groups g ON g.id = m.target_id AND m.target_type = 'group'
       LEFT JOIN students st ON st.id = m.target_id AND m.target_type = 'student'
       ORDER BY m.is_active DESC, m.created_at DESC`
    )
  });
});

messagesRouter.post("/", requirePermission("messages.manage"), (req: AuthenticatedRequest, res) => {
  const body = messageBody(req.body);
  const inserted = run(
    `INSERT INTO portal_messages(target_type, target_id, title, body, priority, starts_at, ends_at,
     is_active, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    body.targetType,
    body.targetId,
    body.title,
    body.body,
    body.priority,
    body.startsAt,
    body.endsAt,
    body.isActive,
    req.user!.id,
    req.user!.id
  );
  const id = Number(inserted.lastInsertRowid);
  logActivity(req, "create", "portal_messages", id, body);
  res.status(201).json({ id });
});

messagesRouter.patch("/:id", requirePermission("messages.manage"), (req: AuthenticatedRequest, res) => {
  const id = asId(req.params.id, "Mensaje");
  if (!get("SELECT id FROM portal_messages WHERE id = ?", id)) throw new ApiError(404, "No se encontro el mensaje.");
  const body = messageBody(req.body);
  run(
    `UPDATE portal_messages SET target_type = ?, target_id = ?, title = ?, body = ?, priority = ?,
     starts_at = ?, ends_at = ?, is_active = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    body.targetType,
    body.targetId,
    body.title,
    body.body,
    body.priority,
    body.startsAt,
    body.endsAt,
    body.isActive,
    req.user!.id,
    id
  );
  logActivity(req, "update", "portal_messages", id, body);
  res.json({ id });
});

messagesRouter.delete("/:id", requirePermission("messages.manage"), (req: AuthenticatedRequest, res) => {
  const id = asId(req.params.id, "Mensaje");
  run("DELETE FROM portal_messages WHERE id = ?", id);
  logActivity(req, "delete", "portal_messages", id, {});
  res.status(204).end();
});
