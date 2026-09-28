import { NextRequest, NextResponse } from "next/server";
import { processLessonNotifications } from "@/lib/lesson-notifications";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  try {
    return NextResponse.json(await processLessonNotifications(30));
  } catch (error) {
    console.error("Falha no processamento das notificações", error);
    return NextResponse.json({ error: "Erro ao processar notificações" }, { status: 500 });
  }
}
