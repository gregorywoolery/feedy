const STORAGE_KEY = "feedy:recent-projects:v1";
const CHANGE_EVENT = "feedy:recent-projects-changed";
const MAX_PROJECTS = 8;

type RecentProject = {
  id: string;
  name: string;
  accessedAt: string;
  pinned: boolean;
};

function isRecentProject(value: unknown): value is RecentProject {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<RecentProject>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.accessedAt === "string" &&
    typeof candidate.pinned === "boolean"
  );
}

export function readProjects() {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "[]",
    ) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isRecentProject) : [];
  } catch {
    return [];
  }
}

export function parseProjectsSnapshot(snapshot: string) {
  try {
    const parsed = JSON.parse(snapshot) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isRecentProject) : [];
  } catch {
    return [];
  }
}

export function subscribeToProjects(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function projectsSnapshot() {
  return window.localStorage.getItem(STORAGE_KEY) ?? "[]";
}

export function sortProjects(projects: RecentProject[]) {
  return projects.toSorted((left, right) => {
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
    return Date.parse(right.accessedAt) - Date.parse(left.accessedAt);
  });
}

export function writeProjects(projects: RecentProject[]) {
  const sorted = sortProjects(projects);
  const pinned = sorted.filter((project) => project.pinned);
  const recent = sorted
    .filter((project) => !project.pinned)
    .slice(0, MAX_PROJECTS);
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([...pinned, ...recent]),
  );
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function rememberProject(project: { id: string; name: string }) {
  const current = readProjects();
  const existing = current.find((item) => item.id === project.id);
  writeProjects([
    ...current.filter((item) => item.id !== project.id),
    {
      id: project.id,
      name: project.name,
      accessedAt: new Date().toISOString(),
      pinned: existing?.pinned ?? false,
    },
  ]);
}

export function forgetProject(projectId: string) {
  writeProjects(readProjects().filter((project) => project.id !== projectId));
}
