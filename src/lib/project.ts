import { prisma } from "@/lib/prisma";
import { SessionUser } from "@/lib/auth";
import { getViewerProjectIds } from "@/lib/project-access";

export async function getDefaultProjectId() {
  const project = await prisma.project.findUnique({ where: { slug: "default" } });
  if (!project) throw new Error("Default project missing. Run db:seed.");
  return project.id;
}

export async function getDefaultProjectIdForSession(session: SessionUser) {
  if (session.role !== "viewer") return getDefaultProjectId();
  const ids = await getViewerProjectIds(session.id);
  if (ids.length === 0) return null;
  return ids[0];
}

