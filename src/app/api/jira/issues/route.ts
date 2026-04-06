import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiRequireRole } from "@/lib/api-auth";
import { canAccessProject } from "@/lib/project-access";
import { getEffectiveJiraProjectKey, getJiraConfig, jiraCreateIssue } from "@/lib/jira";
import { getPublicBaseUrlFromEnv } from "@/lib/public-url";

export const runtime = "nodejs";

const BodySchema = z.object({
  entity: z.enum(["testCase", "testPlan", "checklist"]),
  id: z.string().min(1)
});

function buildAbsolutePath(path: string): string {
  const base = getPublicBaseUrlFromEnv();
  if (!base) return path;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
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

  const { entity, id } = parsed.data;

  if (entity === "testCase") {
    const tc = await prisma.testCase.findUnique({ where: { id } });
    if (!tc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!(await canAccessProject(auth.session, tc.projectId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (tc.jiraIssueKey) {
      return NextResponse.json({ error: "Уже связано с Jira", issueKey: tc.jiraIssueKey }, { status: 409 });
    }
    const project = await prisma.project.findUnique({ where: { id: tc.projectId } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 400 });
    const projectKey = getEffectiveJiraProjectKey(project);
    if (!projectKey) {
      return NextResponse.json(
        { error: "Не задан ключ Jira-проекта: укажите JIRA_PROJECT_KEY в .env или jiraProjectKey у проекта qa-docs" },
        { status: 400 }
      );
    }
    const lines = [
      `Источник: qa-docs · тест-кейс`,
      `Ссылка: ${buildAbsolutePath(`/test-cases/${tc.id}`)}`,
      "",
      tc.preconditions ? `Предусловия:\n${tc.preconditions}` : "",
      tc.postconditions ? `Постусловия:\n${tc.postconditions}` : "",
      tc.description ? `Описание:\n${tc.description}` : ""
    ].filter(Boolean);
    const created = await jiraCreateIssue({
      projectKey,
      summary: `[qa-docs] ${tc.title}`.slice(0, 255),
      descriptionPlain: lines.join("\n\n"),
      epicKey: project.jiraEpicKey
    });
    if (!created.ok) {
      return NextResponse.json({ error: created.error }, { status: created.status >= 400 ? created.status : 502 });
    }
    const updated = await prisma.testCase.update({
      where: { id: tc.id },
      data: { jiraIssueKey: created.issueKey }
    });
    return NextResponse.json({ testCase: updated, issueKey: created.issueKey });
  }

  if (entity === "testPlan") {
    const plan = await prisma.testPlan.findUnique({ where: { id } });
    if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!(await canAccessProject(auth.session, plan.projectId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (plan.jiraIssueKey) {
      return NextResponse.json({ error: "Уже связано с Jira", issueKey: plan.jiraIssueKey }, { status: 409 });
    }
    const project = await prisma.project.findUnique({ where: { id: plan.projectId } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 400 });
    const projectKey = getEffectiveJiraProjectKey(project);
    if (!projectKey) {
      return NextResponse.json(
        { error: "Не задан ключ Jira-проекта: укажите JIRA_PROJECT_KEY в .env или jiraProjectKey у проекта qa-docs" },
        { status: 400 }
      );
    }
    const lines = [
      `Источник: qa-docs · тест-план`,
      `Ссылка: ${buildAbsolutePath(`/test-plans/${plan.id}`)}`,
      "",
      plan.objective ? `Цель:\n${plan.objective}` : "",
      plan.scope ? `Область:\n${plan.scope}` : ""
    ].filter(Boolean);
    const created = await jiraCreateIssue({
      projectKey,
      summary: `[qa-docs] ${plan.title}`.slice(0, 255),
      descriptionPlain: lines.join("\n\n") || plan.title,
      epicKey: project.jiraEpicKey
    });
    if (!created.ok) {
      return NextResponse.json({ error: created.error }, { status: created.status >= 400 ? created.status : 502 });
    }
    const updated = await prisma.testPlan.update({
      where: { id: plan.id },
      data: { jiraIssueKey: created.issueKey }
    });
    return NextResponse.json({ testPlan: updated, issueKey: created.issueKey });
  }

  const checklist = await prisma.checklist.findUnique({ where: { id } });
  if (!checklist) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessProject(auth.session, checklist.projectId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (checklist.jiraIssueKey) {
    return NextResponse.json({ error: "Уже связано с Jira", issueKey: checklist.jiraIssueKey }, { status: 409 });
  }
  const project = await prisma.project.findUnique({ where: { id: checklist.projectId } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 400 });
  const projectKey = getEffectiveJiraProjectKey(project);
  if (!projectKey) {
    return NextResponse.json(
      { error: "Не задан ключ Jira-проекта: укажите JIRA_PROJECT_KEY в .env или jiraProjectKey у проекта qa-docs" },
      { status: 400 }
    );
  }
  let itemCount = 0;
  try {
    const items = checklist.itemsJson as unknown;
    if (Array.isArray(items)) itemCount = items.length;
  } catch {
    /* ignore */
  }
  const lines = [
    `Источник: qa-docs · чек-лист`,
    `Ссылка: ${buildAbsolutePath(`/checklists/${checklist.id}`)}`,
    "",
    `Пунктов: ${itemCount}`
  ];
  const created = await jiraCreateIssue({
    projectKey,
    summary: `[qa-docs] ${checklist.title}`.slice(0, 255),
    descriptionPlain: lines.join("\n"),
    epicKey: project.jiraEpicKey
  });
  if (!created.ok) {
    return NextResponse.json({ error: created.error }, { status: created.status >= 400 ? created.status : 502 });
  }
  const updated = await prisma.checklist.update({
    where: { id: checklist.id },
    data: { jiraIssueKey: created.issueKey }
  });
  return NextResponse.json({ checklist: updated, issueKey: created.issueKey });
}
