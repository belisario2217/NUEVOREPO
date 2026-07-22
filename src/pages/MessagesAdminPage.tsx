import { useEffect, useState } from "react";
import { Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { useToast } from "../components/Toast";
import { Modal } from "../components/Modal";
import { Button, EmptyState, Field, Select, StatusBadge } from "../components/Ui";

type Message = {
  id: number;
  target_type: "all" | "group" | "student";
  target_id: number | null;
  title: string;
  body: string;
  priority: "info" | "warning" | "urgent";
  starts_at: string | null;
  ends_at: string | null;
  is_active: number;
  group_name: string | null;
  student_number: string | null;
  student_name: string | null;
};

type Group = { id: number; name: string; is_active: number };
type Student = { id: number; name: string; student_number: string };

const emptyForm = {
  targetType: "all",
  targetId: "",
  title: "",
  body: "",
  priority: "info",
  startsAt: "",
  endsAt: "",
  isActive: true
};

export function MessagesAdminPage() {
  const toast = useToast();
  const [records, setRecords] = useState<Message[]>([]);
  const [groups, setGroups] = useState<Array<{ id: number; name: string }>>([]);
  const [students, setStudents] = useState<Array<{ id: number; name: string }>>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Message | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  async function loadMessages() {
    const result = await api<{ records: Message[] }>("/messages");
    setRecords(result.records);
  }

  useEffect(() => {
    loadMessages().catch(() => undefined);
    api<{ records: Group[] }>("/catalogs/groups").then((result) => setGroups(result.records.filter((group) => group.is_active))).catch(() => undefined);
    api<{ records: Student[] }>("/payments/students?search=").then((result) => setStudents(result.records.map((student) => ({ id: student.id, name: `${student.student_number} - ${student.name}` })))).catch(() => undefined);
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(message: Message) {
    setEditing(message);
    setForm({
      targetType: message.target_type,
      targetId: message.target_id ? String(message.target_id) : "",
      title: message.title,
      body: message.body,
      priority: message.priority,
      startsAt: message.starts_at ?? "",
      endsAt: message.ends_at ?? "",
      isActive: Boolean(message.is_active)
    });
    setOpen(true);
  }

  async function saveMessage(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const payload = { ...form, targetId: form.targetType === "all" ? null : Number(form.targetId) };
      await api(editing ? `/messages/${editing.id}` : "/messages", { method: editing ? "PATCH" : "POST", body: payload });
      toast.success(editing ? "Mensaje actualizado." : "Mensaje publicado.");
      setOpen(false);
      await loadMessages();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible guardar el mensaje.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteMessage(message: Message) {
    if (!window.confirm(`Eliminar el mensaje "${message.title}"?`)) return;
    await api(`/messages/${message.id}`, { method: "DELETE" });
    toast.success("Mensaje eliminado.");
    await loadMessages();
  }

  return (
    <div className="page-stack">
      <section className="toolbar">
        <div className="toolbar-primary"><h2>Mensajes importantes</h2></div>
        <div className="toolbar-actions"><Button type="button" icon={<Plus size={17} />} onClick={openCreate}>Nuevo mensaje</Button></div>
      </section>

      <section className="table-section">
        <header className="section-heading"><div><span>Portal del alumno</span><h2>Avisos publicados</h2></div></header>
        <div className="table-wrap"><table><thead><tr><th>Estado</th><th>Alcance</th><th>Titulo</th><th>Prioridad</th><th>Vigencia</th><th></th></tr></thead><tbody>
          {records.map((message) => (
            <tr key={message.id}>
              <td><StatusBadge active={Boolean(message.is_active)} label={message.is_active ? "Activo" : "Inactivo"} /></td>
              <td>{message.target_type === "all" ? "Todos" : message.target_type === "group" ? message.group_name : `${message.student_number} - ${message.student_name}`}</td>
              <td><strong className="table-main">{message.title}</strong><span className="table-sub">{message.body}</span></td>
              <td>{message.priority}</td>
              <td>{message.starts_at ?? "Ahora"} - {message.ends_at ?? "Sin fin"}</td>
              <td className="action-cell"><div className="inline-actions"><button className="icon-button" onClick={() => openEdit(message)} title="Editar"><Pencil size={16} /></button><button className="icon-button" onClick={() => deleteMessage(message)} title="Eliminar"><Trash2 size={16} /></button></div></td>
            </tr>
          ))}
        </tbody></table></div>
        {!records.length && <EmptyState icon={<Megaphone size={25} />} title="Sin mensajes" text="Publica un aviso para todos, un grupo o un alumno." />}
      </section>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Editar mensaje" : "Nuevo mensaje"} size="large">
        <form onSubmit={saveMessage}>
          <div className="form-grid two">
            <Field label="Alcance"><Select value={form.targetType} onChange={(event) => setForm({ ...form, targetType: event.target.value, targetId: "" })} options={[{ id: "all", name: "Todos" }, { id: "group", name: "Grupo" }, { id: "student", name: "Alumno" }]} /></Field>
            {form.targetType === "group" && <Field label="Grupo" required><Select value={form.targetId} onChange={(event) => setForm({ ...form, targetId: event.target.value })} options={groups} required /></Field>}
            {form.targetType === "student" && <Field label="Alumno" required><Select value={form.targetId} onChange={(event) => setForm({ ...form, targetId: event.target.value })} options={students} required /></Field>}
            <Field label="Prioridad"><Select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} options={[{ id: "info", name: "Informativo" }, { id: "warning", name: "Importante" }, { id: "urgent", name: "Urgente" }]} /></Field>
            <Field label="Inicio"><input type="date" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /></Field>
            <Field label="Fin"><input type="date" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} /></Field>
          </div>
          <Field label="Titulo" required><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></Field>
          <Field label="Mensaje" required><textarea value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} required /></Field>
          <label className="checkbox-line"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Activo</label>
          <div className="modal-actions"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" busy={busy}>Guardar</Button></div>
        </form>
      </Modal>
    </div>
  );
}
