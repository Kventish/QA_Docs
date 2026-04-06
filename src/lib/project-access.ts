import { SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getViewerProjectIds(userId: string) {
  const rows = await prisma.userProjectAccess.findMany({
    where: { userId },
    select: { projectId: true }
  });
  return rows.map((row) => row.projectId);
}

export async function canAccessProject(session: SessionUser, projectId: string) {
  if (session.role !== "viewer") return true;
  const ids = await getViewerProjectIds(session.id);
  return ids.includes(projectId);
}

export async function getAccessibleProjectIds(session: SessionUser) {
  if (session.role !== "viewer") return null;
  return getViewerProjectIds(session.id);
}
