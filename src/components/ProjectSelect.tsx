"use client";

import { useT } from "@/lib/i18n/useT";

export type ProjectOption = { id: string; name: string };

/** Селект проекта в шапке списков: при отсутствии проектов — заглушка и disabled */
export function ProjectFilterSelect({
  projects,
  value,
  onChange,
  className = ""
}: {
  projects: ProjectOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const t = useT();
  const empty = projects.length === 0;
  return (
    <select
      className={className}
      value={empty ? "" : value}
      onChange={(e) => onChange(e.target.value)}
      disabled={empty}
      aria-label={t("projects.title")}
    >
      {empty ? (
        <option value="" disabled>
          {t("common.noProjects")}
        </option>
      ) : (
        projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))
      )}
    </select>
  );
}

/** Селект проекта в формах: первая опция «выберите»; при нуле проектов — заглушка */
export function ProjectFormSelect({
  projects,
  value,
  onChange,
  className = "",
  firstOptionKey = "validation.projectRequired"
}: {
  projects: ProjectOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  /** Ключ первой опции (пустое значение), напр. testPlans.selectProject */
  firstOptionKey?: string;
}) {
  const t = useT();
  const empty = projects.length === 0;
  return (
    <select
      className={className}
      value={empty ? "" : value}
      onChange={(e) => onChange(e.target.value)}
      disabled={empty}
    >
      {empty ? (
        <option value="" disabled>
          {t("common.noProjects")}
        </option>
      ) : (
        <>
          <option value="">{t(firstOptionKey)}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </>
      )}
    </select>
  );
}
