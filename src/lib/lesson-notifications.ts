import { createClient as createServiceClient } from "@supabase/supabase-js";

// Não importe este módulo em componentes cliente. Nenhuma credencial NEXT_PUBLIC.
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role não configurada");
  return createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

type Delivery = {
  id: string; booking_id: string; event_type: string;
  recipient_role: "student" | "teacher" | "admin";
  channel: "email" | "whatsapp";
  attempts: number;
};

type Booking = {
  id: string; student_id: string; teacher_id: string;
  student_name: string; student_phone: string;
  subject: string; grade_level: string | null;
  starts_at: string; ends_at: string; status: string;
};

function messageFor(booking: Booking, event: string) {
  const when = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full", timeStyle: "short", timeZone: "America/Sao_Paulo",
  }).format(new Date(booking.starts_at));
  const status = event === "scheduled" ? "Nova aula agendada" :
    event === "rescheduled" ? "Aula remarcada" :
    event === "cancelled" ? "Aula cancelada" :
    event === "completed" ? "Aula realizada" :
    event === "no_show" ? "Aluno ausente" :
    event === "teacher_no_show" ? "Professor ausente" : "Atualização da aula";
  return { status, when,
    text: `Escola Conecta — ${status}. Aluno: ${booking.student_name}. ${booking.subject}${booking.grade_level ? ` (${booking.grade_level})` : ""}. ${when}. Consulte a plataforma para mais detalhes.`,
  };
}

async function sendEmail(to: string, subject: string, body: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATION_FROM_EMAIL;
  if (!key || !from) throw new Error("Configure RESEND_API_KEY e NOTIFICATION_FROM_EMAIL");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, text: body }),
  });
  if (!response.ok) throw new Error(`Resend HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
}

function normalizeBrazilPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 || digits.length === 10) return `55${digits}`;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return digits;
  throw new Error("Telefone com DDD inválido");
}

async function sendWhatsApp(to: string, booking: Booking, event: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const template = process.env.WHATSAPP_TEMPLATE_NAME;
  const version = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
  if (!token || !phoneId || !template) throw new Error("Credenciais ou template WhatsApp não configurados");
  // Template aprovado na Meta, idioma pt_BR, 4 placeholders no corpo:
  // {{1}} evento; {{2}} aluno; {{3}} disciplina; {{4}} data/hora.
  const { status, when } = messageFor(booking, event);
  const response = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: normalizeBrazilPhone(to), type: "template",
      template: { name: template, language: { code: "pt_BR" }, components: [{ type: "body",
        parameters: [status, booking.student_name, booking.subject, when].map(text => ({ type: "text", text })) }] } }),
  });
  if (!response.ok) throw new Error(`WhatsApp HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
}

/** Processa fila persistida; erros ficam registrados e não desfazem a reserva. */
export async function processLessonNotifications(max = 18) {
  const db = adminClient();
  const { data, error } = await db.from("lesson_notification_deliveries")
    .select("id,booking_id,event_type,recipient_role,channel,attempts")
    .eq("status", "pending").lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at").limit(Math.min(max, 50));
  if (error) throw error;
  let sent = 0; let failed = 0;
  for (const delivery of (data || []) as Delivery[]) {
    // Reivindica a tarefa para evitar duas execuções concorrentes dispararem a mesma mensagem.
    const claimed = await db.from("lesson_notification_deliveries")
      .update({ status: "processing" }).eq("id", delivery.id).eq("status", "pending")
      .select("id").maybeSingle();
    if (claimed.error || !claimed.data) continue;
    try {
      const { data: booking, error: bookingError } = await db.from("lesson_bookings")
        .select("id,student_id,teacher_id,student_name,student_phone,subject,grade_level,starts_at,ends_at,status")
        .eq("id", delivery.booking_id).single();
      if (bookingError || !booking) throw new Error("Agendamento não encontrado");
      const lesson = booking as Booking;
      let email = ""; let phone = "";
      if (delivery.recipient_role === "admin") {
        email = process.env.ADMIN_NOTIFICATION_EMAIL || "";
        phone = process.env.ADMIN_NOTIFICATION_PHONE || "";
      } else if (delivery.recipient_role === "student") {
        const { data: profile } = await db.from("profiles").select("email,notification_phone")
          .eq("id", lesson.student_id).single();
        email = profile?.email || "";
        phone = lesson.student_phone;
      } else {
        const { data: profile } = await db.from("profiles").select("email,notification_phone")
          .eq("id", lesson.teacher_id).single();
        email = profile?.email || "";
        phone = profile?.notification_phone || "";
      }
      const { status, text } = messageFor(lesson, delivery.event_type);
      if (delivery.channel === "email") {
        if (!email) throw new Error("E-mail do destinatário não cadastrado");
        await sendEmail(email, `Escola Conecta | ${status}`, text);
      } else {
        if (!phone) throw new Error("WhatsApp do destinatário não cadastrado");
        await sendWhatsApp(phone, lesson, delivery.event_type);
      }
      await db.from("lesson_notification_deliveries").update({ status: "sent", sent_at: new Date().toISOString(), error_message: null })
        .eq("id", delivery.id);
      sent++;
    } catch (err) {
      const attempts = delivery.attempts + 1;
      const minutes = Math.min(60, 2 ** attempts);
      await db.from("lesson_notification_deliveries")
        .update({ status: attempts >= 5 ? "failed" : "pending", attempts,
          next_attempt_at: new Date(Date.now() + minutes * 60_000).toISOString(),
          error_message: String(err).slice(0, 500) }).eq("id", delivery.id);
      failed++;
    }
  }
  return { processed: sent + failed, sent, failed };
}
