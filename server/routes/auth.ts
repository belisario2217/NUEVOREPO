import { Router } from "express";
import bcrypt from "bcryptjs";
import { rateLimit } from "express-rate-limit";
import { get, run } from "../db.js";
import { authenticate, loadUser, logActivity, signToken, type AuthenticatedRequest } from "../auth.js";
import { ApiError, cleanText } from "../utils.js";

export const authRouter = Router();

authRouter.post(
  "/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false }
  }),
  async (req, res) => {
    const email = cleanText(req.body.email, 180).toLowerCase();
    const password = String(req.body.password ?? "");
    const account = get<{ id: number; password_hash: string; is_active: number }>(
      "SELECT id, password_hash, is_active FROM users WHERE email = ? AND deleted_at IS NULL",
      email
    );
    if (!account || !account.is_active || !(await bcrypt.compare(password, account.password_hash))) {
      return res.status(401).json({ message: "Correo o contraseña incorrectos." });
    }
    const user = loadUser(account.id)!;
    run("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", account.id);
    return res.json({ token: signToken(user), user });
  }
);

authRouter.get("/me", authenticate, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

authRouter.post("/change-password", authenticate, async (req: AuthenticatedRequest, res) => {
  const currentPassword = String(req.body.currentPassword ?? "");
  const newPassword = String(req.body.newPassword ?? "");
  const confirmPassword = String(req.body.confirmPassword ?? "");
  if (!currentPassword || newPassword.length < 8) {
    throw new ApiError(400, "Ingresa tu contraseña actual y una nueva contraseña de al menos 8 caracteres.");
  }
  if (newPassword !== confirmPassword) throw new ApiError(400, "La confirmación de la nueva contraseña no coincide.");
  if (newPassword === currentPassword) throw new ApiError(400, "La nueva contraseña debe ser diferente a la actual.");

  const account = get<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = ?", req.user!.id);
  if (!account || !(await bcrypt.compare(currentPassword, account.password_hash))) {
    throw new ApiError(400, "La contraseña actual es incorrecta.");
  }
  run(
    `UPDATE users SET password_hash = ?, password_must_change = 0, temporary_password_name = NULL,
     updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    await bcrypt.hash(newPassword, 12),
    req.user!.id
  );
  logActivity(req, "change-password", "users", req.user!.id);
  res.json({ message: "Contraseña actualizada correctamente." });
});
