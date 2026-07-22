import { useEffect, useState } from "react";
import { ReceiptText, Save, Search } from "lucide-react";
import { api } from "../lib/api";
import { useToast } from "../components/Toast";
import { Button, EmptyState, Field, Select } from "../components/Ui";

type Group = { id: number; name: string; is_active: number };
type GridRow = {
  studentId: number;
  student_number: string;
  student_name: string;
  group_name: string;
  amount: number;
  paid: boolean;
  status: string;
  notes: string;
};

const month = new Date().toISOString().slice(0, 7);

function money(value: unknown) {
  return Number(value ?? 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

export function TuitionGridPage() {
  const toast = useToast();
  const [groups, setGroups] = useState<Array<{ id: number; name: string }>>([]);
  const [groupId, setGroupId] = useState("");
  const [billingMonth, setBillingMonth] = useState(month);
  const [rows, setRows] = useState<GridRow[]>([]);
  const [busy, setBusy] = useState(false);

  async function loadGrid() {
    setBusy(true);
    try {
      const params = new URLSearchParams({ month: billingMonth });
      if (groupId) params.set("groupId", groupId);
      const result = await api<{ records: GridRow[] }>(`/payments/tuition-grid?${params}`);
      setRows(result.records);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible cargar colegiaturas.");
    } finally {
      setBusy(false);
    }
  }

  async function saveGrid() {
    setBusy(true);
    try {
      const result = await api<{ updated: number }>("/payments/tuition-grid", {
        method: "PATCH",
        body: { month: billingMonth, rows }
      });
      toast.success(`Colegiaturas actualizadas: ${result.updated}.`);
      await loadGrid();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible guardar colegiaturas.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    api<{ records: Group[] }>("/catalogs/groups")
      .then((result) => setGroups(result.records.filter((group) => group.is_active)))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    loadGrid().catch(() => undefined);
  }, [billingMonth, groupId]);

  return (
    <div className="page-stack">
      <section className="toolbar">
        <div className="toolbar-primary">
          <Field label="Mes"><input type="month" value={billingMonth} onChange={(event) => setBillingMonth(event.target.value || month)} /></Field>
          <Field label="Grupo"><Select value={groupId} onChange={(event) => setGroupId(event.target.value)} options={groups} placeholder="Todos" /></Field>
        </div>
        <div className="toolbar-actions">
          <Button type="button" variant="secondary" icon={<Search size={17} />} onClick={loadGrid} busy={busy}>Actualizar</Button>
          <Button type="button" icon={<Save size={17} />} onClick={saveGrid} busy={busy}>Guardar cambios</Button>
        </div>
      </section>

      <section className="table-section">
        <header className="section-heading"><div><span>Colegiaturas</span><h2>Control mensual por alumno</h2></div></header>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Pagada</th><th>Matricula</th><th>Alumno</th><th>Grupo</th><th>Monto</th><th>Notas</th></tr></thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.studentId}>
                  <td><input type="checkbox" checked={row.paid} onChange={(event) => setRows((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, paid: event.target.checked } : item))} /></td>
                  <td><strong className="table-main">{row.student_number}</strong></td>
                  <td>{row.student_name}</td>
                  <td>{row.group_name}</td>
                  <td><input type="number" min="0" step="0.01" value={row.amount} onChange={(event) => setRows((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, amount: Number(event.target.value) } : item))} aria-label="Monto" /></td>
                  <td><input value={row.notes ?? ""} onChange={(event) => setRows((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, notes: event.target.value } : item))} aria-label="Notas" placeholder={row.paid ? money(row.amount) : "Pendiente"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <EmptyState icon={<ReceiptText size={25} />} title="Sin alumnos" text="Selecciona otro grupo o mes para capturar colegiaturas." />}
      </section>
    </div>
  );
}
