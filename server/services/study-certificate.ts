import type { Response } from "express";
import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { all, get } from "../db.js";
import { ApiError } from "../utils.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const contentLeft = 48;
const contentWidth = 516;
const footerTop = 718;
const tableWidths = [306, 85, 125];

type CertificateStudent = {
  id: number;
  enrollment_id: number;
  student_number: string;
  student_name: string;
  program_name: string;
  group_name: string;
  modality: string;
  cycle_name: string;
  curricular_period_name: string | null;
  curricular_period_number: number | null;
  plan_name: string | null;
  rvoe: string | null;
};

type CertificateSubject = {
  subject_name: string;
  semester_number: number | null;
  final_score: number | null;
};

type CertificateSettings = {
  institution_name: string;
  logo_path: string | null;
  address: string | null;
  director_name: string | null;
  footer_text: string | null;
};

export type StudyCertificateData = {
  settings: CertificateSettings;
  student: CertificateStudent;
  subjects: CertificateSubject[];
  average: number | null;
};

function logoFile(logoPath: string | null) {
  if (!logoPath) return null;
  const relative = logoPath.startsWith("/assets/") ? path.join("public", logoPath) : logoPath;
  const resolved = path.resolve(projectRoot, `.${relative.startsWith("/") ? relative : `/${relative}`}`);
  return fs.existsSync(resolved) ? resolved : null;
}

function normalizedFilenamePart(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function studyCertificateFilename(studentName: string) {
  return `CE-${normalizedFilenamePart(studentName)}-CONSTANCIA.pdf`;
}

function spanishDate(date = new Date()) {
  const months = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
  return `${date.getDate()} DE ${months[date.getMonth()]} DE ${date.getFullYear()}`;
}

function integerInSpanish(value: number) {
  const words: Record<number, string> = { 0: "cero", 1: "uno", 2: "dos", 3: "tres", 4: "cuatro", 5: "cinco", 6: "seis", 7: "siete", 8: "ocho", 9: "nueve", 10: "diez" };
  return words[value] ?? String(value);
}

export function scoreInSpanish(score: number) {
  const rounded = Number(score.toFixed(1));
  if (Number.isInteger(rounded)) return integerInSpanish(rounded);
  const [whole, decimal] = rounded.toFixed(1).split(".").map(Number);
  return `${integerInSpanish(whole)} punto ${integerInSpanish(decimal)}`;
}

function displayScore(score: number | null) {
  if (score == null) return "-";
  const rounded = Number(score.toFixed(1));
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function sentenceCase(value: string) {
  const normalized = value.trim().toLocaleLowerCase("es-MX");
  return normalized ? normalized[0].toLocaleUpperCase("es-MX") + normalized.slice(1) : value;
}

function modalityLabel(value: string) {
  const labels: Record<string, string> = { escolarizado: "escolarizada", semiescolarizado: "semiescolarizada", complementario: "complementaria" };
  return labels[value] ?? value;
}

export function getStudyCertificateData(studentId: number): StudyCertificateData {
  const settings = get<CertificateSettings>("SELECT * FROM institution_settings WHERE id = 1");
  const student = get<CertificateStudent>(
    `SELECT st.id, e.id AS enrollment_id, st.student_number,
     TRIM(st.first_name || ' ' || st.last_name || ' ' || COALESCE(st.second_last_name, '')) AS student_name,
     p.name AS program_name, g.name AS group_name, COALESCE(g.study_modality, 'escolarizado') AS modality,
     sc.name AS cycle_name, cp.name AS curricular_period_name, cp.sequence AS curricular_period_number,
     ap.name AS plan_name, ap.rvoe
     FROM students st
     JOIN enrollments e ON e.student_id = st.id AND e.is_active = 1
     JOIN programs p ON p.id = e.program_id
     JOIN groups g ON g.id = e.group_id
     JOIN school_cycles sc ON sc.id = e.cycle_id
     LEFT JOIN curricular_periods cp ON cp.id = e.curricular_period_id
     LEFT JOIN academic_plans ap ON ap.id = e.plan_id
     WHERE st.id = ? AND st.is_active = 1
     ORDER BY e.id DESC LIMIT 1`, studentId
  );
  if (!settings) throw new ApiError(500, "No existe la configuración institucional.");
  if (!student) throw new ApiError(404, "No se encontró una inscripción activa para el alumno.");

  const subjects = all<CertificateSubject>(
    `WITH grade_summary AS (
       SELECT a.subject_id, ROUND(AVG(gr.final_score), 1) AS final_score
       FROM grades gr JOIN subject_assignments a ON a.id = gr.assignment_id
       WHERE gr.enrollment_id = ? AND gr.final_score IS NOT NULL GROUP BY a.subject_id
     ), curricular AS (
       SELECT ss.subject_id, s.name AS subject_name, ss.semester_number,
        COALESCE(ss.final_score, gs.final_score) AS final_score
       FROM student_subjects ss JOIN subjects s ON s.id = ss.subject_id
       LEFT JOIN grade_summary gs ON gs.subject_id = ss.subject_id
       WHERE ss.student_id = ?
        AND (ss.status = 'completed' OR ss.final_score IS NOT NULL OR gs.final_score IS NOT NULL)
     ), grade_only AS (
       SELECT s.id AS subject_id, s.name AS subject_name, NULL AS semester_number, gs.final_score
       FROM grade_summary gs JOIN subjects s ON s.id = gs.subject_id
       WHERE NOT EXISTS (SELECT 1 FROM student_subjects ss WHERE ss.student_id = ? AND ss.subject_id = gs.subject_id)
     )
     SELECT subject_name, semester_number, final_score
     FROM (
       SELECT subject_name, semester_number, final_score FROM curricular
       UNION ALL
       SELECT subject_name, semester_number, final_score FROM grade_only
     )
     ORDER BY COALESCE(semester_number, 999), subject_name`,
    student.enrollment_id, studentId, studentId
  );
  const scored = subjects.filter((subject) => subject.final_score != null);
  const average = scored.length ? Number((scored.reduce((sum, subject) => sum + Number(subject.final_score), 0) / scored.length).toFixed(1)) : null;
  return { settings, student, subjects, average };
}

function drawFirstPageHeader(doc: PDFKit.PDFDocument, data: StudyCertificateData) {
  const logo = logoFile(data.settings.logo_path);
  if (logo) doc.image(logo, 271, 20, { fit: [70, 70], align: "center", valign: "center" });
  doc.fillColor("#050505").font("Helvetica-Bold").fontSize(20)
    .text(data.settings.institution_name.toUpperCase(), 62, 96, { width: 488, align: "center" });
  doc.fontSize(10.5).text("CONTROL ESCOLAR IFOP", 310, 154, { width: 252, align: "right" });
  doc.text("ASUNTO: CONSTANCIA DE ESTUDIOS", 280, 169, { width: 282, align: "right" });
  doc.text(`FRONTERA, CENTLA, TABASCO A; ${spanishDate()}`, 224, 184, { width: 338, align: "right" });
  doc.fontSize(11).text("A quien corresponda:", contentLeft, 216, { width: contentWidth });
  doc.font("Helvetica").text(`La que suscribe, responsable de Control Escolar de ${data.settings.institution_name}, hace constar que:`, contentLeft, 252, { width: contentWidth, align: "justify", lineGap: 2 });
  doc.font("Helvetica-Bold").fontSize(16).text(data.student.student_name.toUpperCase(), contentLeft, 305, { width: contentWidth, align: "center" });
  doc.y = 345;
}

function drawEnrollmentText(doc: PDFKit.PDFDocument, data: StudyCertificateData) {
  const period = data.student.curricular_period_name ? sentenceCase(data.student.curricular_period_name) : data.student.curricular_period_number ? `Semestre ${data.student.curricular_period_number}` : "periodo vigente";
  const rvoe = data.student.rvoe?.trim() || "NO REGISTRADO";
  doc.fillColor("#111111").font("Helvetica").fontSize(11).text(
    `Cuenta con inscripción vigente en esta institución y cursa el ${period} del programa ${data.student.program_name}, en modalidad ${modalityLabel(data.student.modality)}, con RVOE: ${rvoe}, matrícula: ${data.student.student_number}, durante el ciclo escolar ${data.student.cycle_name}.`,
    contentLeft, doc.y, { width: contentWidth, align: "justify", lineGap: 3 }
  );
  doc.moveDown(0.6).text("En convenio educativo con la institución denominada “Centro Universitario Tecnológico de Enfermería” (UNITEN), CCT 18PSU0074C.", { width: contentWidth, align: "justify", lineGap: 3 });
  const averageText = data.average == null ? "sin promedio general disponible" : `${displayScore(data.average)} (${sentenceCase(scoreInSpanish(data.average))})`;
  doc.moveDown(0.6).text(`A continuación se detallan las asignaturas cursadas durante su estancia en la institución. Promedio general: ${averageText}.`, { width: contentWidth, align: "justify", lineGap: 3 });
  doc.moveDown(0.8);
}

function drawContinuationHeader(doc: PDFKit.PDFDocument, data: StudyCertificateData) {
  doc.fillColor("#111111").font("Helvetica-Bold").fontSize(10).text(data.settings.institution_name.toUpperCase(), contentLeft, 34, { width: 300 });
  doc.text("CONSTANCIA DE ESTUDIOS", 338, 34, { width: 226, align: "right" });
  doc.moveTo(contentLeft, 56).lineTo(564, 56).lineWidth(1).strokeColor("#222222").stroke();
  doc.fontSize(9).text(`${data.student.student_name.toUpperCase()} · ${data.student.student_number}`, contentLeft, 66, { width: contentWidth, align: "center" });
  doc.y = 92;
}

function drawTableHeader(doc: PDFKit.PDFDocument) {
  const y = doc.y;
  ["Asignatura", "Calificación", "Letra"].forEach((header, index) => {
    const x = contentLeft + tableWidths.slice(0, index).reduce((sum, width) => sum + width, 0);
    doc.rect(x, y, tableWidths[index], 25).lineWidth(1.2).strokeColor("#111111").stroke();
    doc.fillColor("#111111").font("Helvetica-Bold").fontSize(9.5).text(header, x + 4, y + 7, { width: tableWidths[index] - 8, align: "center" });
  });
  doc.y = y + 25;
}

function drawSubjectTable(doc: PDFKit.PDFDocument, data: StudyCertificateData) {
  drawTableHeader(doc);
  const records = data.subjects.length ? data.subjects : [{ subject_name: "Sin asignaturas con calificación final registrada", semester_number: null, final_score: null }];
  records.forEach((subject) => {
    const rowHeight = Math.max(25, doc.heightOfString(subject.subject_name, { width: tableWidths[0] - 10 }) + 12);
    if (doc.y + rowHeight > 694) {
      doc.addPage();
      drawContinuationHeader(doc, data);
      drawTableHeader(doc);
    }
    const y = doc.y;
    const score = displayScore(subject.final_score);
    const cells = [subject.subject_name, score, subject.final_score == null ? "-" : scoreInSpanish(Number(subject.final_score)).toUpperCase()];
    cells.forEach((cell, index) => {
      const x = contentLeft + tableWidths.slice(0, index).reduce((sum, width) => sum + width, 0);
      doc.rect(x, y, tableWidths[index], rowHeight).lineWidth(0.8).strokeColor("#111111").stroke();
      doc.fillColor("#111111").font(index === 2 ? "Helvetica-Bold" : "Helvetica").fontSize(9.5)
        .text(cell, x + 5, y + 7, { width: tableWidths[index] - 10, height: rowHeight - 10, align: index === 0 ? "left" : "center", ellipsis: true });
    });
    doc.y = y + rowHeight;
  });
}

function drawClosingAndSignature(doc: PDFKit.PDFDocument, data: StudyCertificateData) {
  if (doc.y + 150 > 704) {
    doc.addPage();
    drawContinuationHeader(doc, data);
  }
  doc.moveDown(1).fillColor("#111111").font("Helvetica").fontSize(11).text("A solicitud de la parte interesada, se extiende la presente constancia para los fines legales que más le convengan.", contentLeft, doc.y, { width: contentWidth, align: "justify", lineGap: 3 });
  const signatureY = Math.max(doc.y + 70, 630);
  doc.moveTo(188, signatureY).lineTo(424, signatureY).lineWidth(0.8).strokeColor("#111111").stroke();
  doc.fillColor("#111111").font("Helvetica").fontSize(10.5).text(data.settings.director_name || "Responsable de Control Escolar", 158, signatureY + 8, { width: 296, align: "center" });
  doc.font("Helvetica-Bold").text("Control Escolar", 158, signatureY + 24, { width: 296, align: "center" });
}

function drawFooters(doc: PDFKit.PDFDocument, data: StudyCertificateData) {
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    doc.fillColor("#B8B8B8").font("Helvetica").fontSize(7.5).text(data.settings.address || "Frontera, Centla, Tabasco", contentLeft, footerTop, { width: contentWidth, align: "center", lineBreak: false });
    doc.fontSize(8).text(data.settings.footer_text || "¡TU ESFUERZO DE HOY SERÁ EL ÉXITO DEL MAÑANA!", contentLeft, footerTop + 11, { width: contentWidth, align: "center", lineBreak: false });
    if (range.count > 1) doc.fontSize(7).text(`Página ${index - range.start + 1} de ${range.count}`, 500, footerTop + 20, { width: 64, align: "right", lineBreak: false });
  }
}

export function drawStudyCertificate(doc: PDFKit.PDFDocument, data: StudyCertificateData) {
  drawFirstPageHeader(doc, data);
  drawEnrollmentText(doc, data);
  drawSubjectTable(doc, data);
  drawClosingAndSignature(doc, data);
  drawFooters(doc, data);
}

export function sendStudyCertificate(res: Response, studentId: number) {
  const data = getStudyCertificateData(studentId);
  const filename = studyCertificateFilename(data.student.student_name);
  const doc = new PDFDocument({ size: "LETTER", margin: 42, bufferPages: true, info: { Title: `Constancia de estudios - ${data.student.student_name}`, Author: data.settings.institution_name, Subject: "Constancia de estudios" } });
  res.type("application/pdf").setHeader("Content-Disposition", `inline; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
  doc.pipe(res);
  drawStudyCertificate(doc, data);
  doc.end();
}
