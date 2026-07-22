import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { api } from "../lib/api";
import { EmptyState, StatusBadge } from "../components/Ui";

type PortalMessage = {
  id: number;
  title: string;
  body: string;
  priority: "info" | "warning" | "urgent";
  created_at: string;
};

export function StudentMessagesPage() {
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ messages: PortalMessage[] }>("/portal")
      .then((result) => setMessages(result.messages ?? []))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "No fue posible cargar mensajes."));
  }, []);

  if (error) return <EmptyState icon={<Megaphone size={27} />} title="Mensajes no disponibles" text={error} />;

  return (
    <div className="page-stack">
      <section className="table-section">
        <header className="section-heading"><div><span>Portal del alumno</span><h2>Mensajes importantes</h2></div></header>
        <div className="message-list">
          {messages.map((message) => (
            <article key={message.id} className="message-card">
              <header><StatusBadge active={message.priority !== "info"} label={message.priority === "urgent" ? "Urgente" : message.priority === "warning" ? "Importante" : "Aviso"} /><small>{message.created_at.slice(0, 10)}</small></header>
              <h3>{message.title}</h3>
              <p>{message.body}</p>
            </article>
          ))}
        </div>
        {!messages.length && <EmptyState icon={<Megaphone size={25} />} title="Sin mensajes" text="No hay avisos importantes publicados para ti." />}
      </section>
    </div>
  );
}
