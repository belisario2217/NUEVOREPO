import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const uploadsDir = process.env.UPLOADS_PATH
  ? path.resolve(process.env.UPLOADS_PATH)
  : path.join(projectRoot, "uploads");
const defaultLogoPath = path.join(projectRoot, "public", "assets", "campus-frontera.jpg");
export const defaultInstitutionLogoUrl = "/assets/campus-frontera.jpg";
const supportedExtensions = new Set([".png", ".jpg", ".jpeg", ".webp"]);

function configuredLogoFile(logoPath: string | null) {
  if (!logoPath || !supportedExtensions.has(path.extname(logoPath).toLowerCase())) return null;
  if (logoPath.startsWith("/uploads/")) {
    const filename = path.basename(logoPath);
    return path.join(uploadsDir, filename);
  }
  if (logoPath.startsWith("/assets/")) {
    return path.join(projectRoot, "public", "assets", path.basename(logoPath));
  }
  if (path.isAbsolute(logoPath)) return logoPath;
  return path.resolve(projectRoot, logoPath);
}

export function institutionLogoFile(logoPath: string | null) {
  const configured = configuredLogoFile(logoPath);
  if (configured && fs.existsSync(configured)) return configured;
  return fs.existsSync(defaultLogoPath) ? defaultLogoPath : null;
}

export function institutionLogoPublicUrl(logoPath: string | null) {
  const configured = configuredLogoFile(logoPath);
  return configured && fs.existsSync(configured) ? logoPath || defaultInstitutionLogoUrl : defaultInstitutionLogoUrl;
}
