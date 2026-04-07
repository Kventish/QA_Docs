import path from "node:path";
import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiRequireRole } from "@/lib/api-auth";
import { canAccessProject } from "@/lib/project-access";
import { getEffectiveJiraProjectKey, getJiraConfig, jiraAddAttachments, jiraCreateIssue } from "@/lib/jira";
import { getPublicBaseUrlFromEnv } from "@/lib/public-url";

export const runtime = "nodejs";

const BodySchema = z.object({
  entity: z.enum(["testCaseRun", "checklistRun", "testPlanRun"]),
  runId: z.string().min(1)
});

function buildAbsolutePath(p: string): string {
  const base = getPublicBaseUrlFromEnv();
  if (!base) return p;
  return `${base}${p.startsWith("/") ? p : `/${p}`}`;
}

const imageExtensions = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;
function looksLikeImage(name: string) {
  return imageExtensions.test(name);
}

function extractUploadFile(url: string): { runId: string; fileName: string } | null {
  // expected: /api/uploads/<runId>/<fileName>
  const prefix = "/api/uploads/";
  if (!url.startsWith(prefix)) return null;
  const rest = url.slice(prefix.length);
  const parts = rest.split("/");
  if (parts.length < 2) return null;
  const runId = parts[0];
  const fileName = decodeURIComponent(parts.slice(1).join("/"));
  return { runId, fileName };
}

async function loadRunAttachments(runId: string, attachmentsJson: unknown) {
  const list = Array.isArray(attachmentsJson) ? (attachmentsJson as Array<any>) : [];
  const out: Array<{ fileName: string; content: Uint8Array; mimeType?: string }> = [];

  for (const a of list) {
    const name = typeof a?.name === "string" ? a.name : "";
    const url = typeof a?.url === "string" ? a.url : "";
    if (!name || !url) continue;
    if (!looksLikeImage(name)) continue; // attach only images for now
    const parsed = extractUploadFile(url);
    if (!parsed || parsed.runId !== runId) continue;

    const filePath = path.join(process.cwd(), "public", "uploads", runId, parsed.fileName);
    try {
      const buf = await fs.readFile(filePath);
      out.push({ fileName: parsed.fileName, content: new Uint8Array(buf) });
    } catch {
      // ignore missing files
    }
  }

  return out;
}

export async function POST(req: Request) {
  const auth = apiRequireRole("editor");
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  if (!getJiraConfig()) {
    return NextResponse.json({ error: "Jira is not configured (JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN)" }, { status: 503 });
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { entity, runId } = parsed.data;

  if (entity === "testCaseRun") {
    const run = await (prisma as any).testCaseRun.findUnique({
      where: { id: runId },
      include: { testCase: true }
    }) as any;
    if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!(await canAccessProject(auth.session, run.testCase.projectId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (run.jiraIssueKey) return NextResponse.json({ issueKey: run.jiraIssueKey, error: "Уже связано с Jira" }, { status: 409 });

    const project = await prisma.project.findUnique({ where: { id: run.testCase.projectId } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 400 });
    const projectKey = getEffectiveJiraProjectKey(project);
    if (!projectKey) {
      return NextResponse.json(
        {
          error:
            "Не задан ключ Jira‑проекта для этого прогона.\n" +
            `Проект: ${project.name} (${project.id})\n` +
            `jiraProjectKey в проекте: ${project.jiraProjectKey ?? "null"}\n` +
            "Укажите JIRA_PROJECT_KEY в .env или сохраните jiraProjectKey в карточке проекта."
        },
        { status: 400 }
      );
    }

    const runUrl = buildAbsolutePath(`/test-cases/${run.testCase.id}/runs/${run.id}`);
    const tcUrl = buildAbsolutePath(`/test-cases/${run.testCase.id}`);
    const lines = [
      `Источник: qa-docs · прогон тест-кейса`,
      `Тест-кейс: ${run.testCase.title}`,
      `Ссылка на прогон: ${runUrl}`,
      `Ссылка на тест-кейс: ${tcUrl}`,
      "",
      `Статус: ${run.status}`,
      run.actualResult ? `Результат:\n${run.actualResult}` : "",
      run.notes ? `Заметки:\n${run.notes}` : ""
    ].filter(Boolean);

    const created = await jiraCreateIssue({
      projectKey,
      summary: `[qa-docs][run] ${run.testCase.title}`.slice(0, 255),
      descriptionPlain: lines.join("\n\n"),
      epicKey: project.jiraEpicKey
    });
    if (!created.ok) return NextResponse.json({ error: created.error }, { status: created.status >= 400 ? created.status : 502 });

    const files = await loadRunAttachments(run.id, run.attachmentsJson);
    const attachResult = await jiraAddAttachments(created.issueKey, files);

    await (prisma as any).testCaseRun.update({ where: { id: run.id }, data: { jiraIssueKey: created.issueKey } });
    return NextResponse.json({
      issueKey: created.issueKey,
      attachmentsUploaded: attachResult.ok ? attachResult.count : 0,
      attachmentError: attachResult.ok ? null : attachResult.error
    });
  }

  if (entity === "checklistRun") {
    const run = await (prisma as any).checklistRun.findUnique({
      where: { id: runId },
      include: { checklist: true }
    }) as any;
    if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!(await canAccessProject(auth.session, run.checklist.projectId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (run.jiraIssueKey) return NextResponse.json({ issueKey: run.jiraIssueKey, error: "Уже связано с Jira" }, { status: 409 });

    const project = await prisma.project.findUnique({ where: { id: run.checklist.projectId } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 400 });
    const projectKey = getEffectiveJiraProjectKey(project);
    if (!projectKey) {
      return NextResponse.json(
        {
          error:
            "Не задан ключ Jira‑проекта для этого прогона.\n" +
            `Проект: ${project.name} (${project.id})\n` +
            `jiraProjectKey в проекте: ${project.jiraProjectKey ?? "null"}\n` +
            "Укажите JIRA_PROJECT_KEY в .env или сохраните jiraProjectKey в карточке проекта."
        },
        { status: 400 }
      );
    }

    const runUrl = buildAbsolutePath(`/checklists/${run.checklist.id}/runs/${run.id}`);
    const clUrl = buildAbsolutePath(`/checklists/${run.checklist.id}`);
    const itemResults = Array.isArray(run.itemResults) ? run.itemResults : [];
    const done = itemResults.filter((x: any) => x?.done).length;
    const total = itemResults.length;
    const lines = [
      `Источник: qa-docs · прогон чек-листа`,
      `Чек-лист: ${run.checklist.title}`,
      `Ссылка на прогон: ${runUrl}`,
      `Ссылка на чек-лист: ${clUrl}`,
      "",
      `Статус: ${run.status}`,
      total ? `Прогресс: ${done} / ${total}` : "",
      run.notes ? `Заметки:\n${run.notes}` : ""
    ].filter(Boolean);

    const created = await jiraCreateIssue({
      projectKey,
      summary: `[qa-docs][run] ${run.checklist.title}`.slice(0, 255),
      descriptionPlain: lines.join("\n\n"),
      epicKey: project.jiraEpicKey
    });
    if (!created.ok) return NextResponse.json({ error: created.error }, { status: created.status >= 400 ? created.status : 502 });

    const files = await loadRunAttachments(run.id, run.attachmentsJson);
    const attachResult = await jiraAddAttachments(created.issueKey, files);
    await (prisma as any).checklistRun.update({ where: { id: run.id }, data: { jiraIssueKey: created.issueKey } });
    return NextResponse.json({
      issueKey: created.issueKey,
      attachmentsUploaded: attachResult.ok ? attachResult.count : 0,
      attachmentError: attachResult.ok ? null : attachResult.error
    });
  }

  // testPlanRun
  const run = await (prisma as any).testPlanRun.findUnique({
    where: { id: runId },
    include: { testPlan: true }
  }) as any;
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessProject(auth.session, run.testPlan.projectId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (run.jiraIssueKey) return NextResponse.json({ issueKey: run.jiraIssueKey, error: "Уже связано с Jira" }, { status: 409 });

  const project = await prisma.project.findUnique({ where: { id: run.testPlan.projectId } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 400 });
  const projectKey = getEffectiveJiraProjectKey(project);
  if (!projectKey) {
    return NextResponse.json(
      {
        error:
          "Не задан ключ Jira‑проекта для этого прогона.\n" +
          `Проект: ${project.name} (${project.id})\n` +
          `jiraProjectKey в проекте: ${project.jiraProjectKey ?? "null"}\n` +
          "Укажите JIRA_PROJECT_KEY в .env или сохраните jiraProjectKey в карточке проекта."
      },
      { status: 400 }
    );
  }

  const runUrl = buildAbsolutePath(`/test-plans/${run.testPlan.id}/runs/${run.id}`);
  const planUrl = buildAbsolutePath(`/test-plans/${run.testPlan.id}`);
  const lines = [
    `Источник: qa-docs · прогон тест-плана`,
    `Тест-план: ${run.testPlan.title}`,
    `Ссылка на прогон: ${runUrl}`,
    `Ссылка на тест-план: ${planUrl}`,
    "",
    `Статус: ${run.status}`,
    run.summary ? `Сводка:\n${run.summary}` : ""
  ].filter(Boolean);

  const created = await jiraCreateIssue({
    projectKey,
    summary: `[qa-docs][run] ${run.testPlan.title}`.slice(0, 255),
    descriptionPlain: lines.join("\n\n") || run.testPlan.title,
    epicKey: project.jiraEpicKey
  });
  if (!created.ok) return NextResponse.json({ error: created.error }, { status: created.status >= 400 ? created.status : 502 });

  const files = await loadRunAttachments(run.id, run.attachmentsJson);
  const attachResult = await jiraAddAttachments(created.issueKey, files);
  await (prisma as any).testPlanRun.update({ where: { id: run.id }, data: { jiraIssueKey: created.issueKey } });
  return NextResponse.json({
    issueKey: created.issueKey,
    attachmentsUploaded: attachResult.ok ? attachResult.count : 0,
    attachmentError: attachResult.ok ? null : attachResult.error
  });
}

