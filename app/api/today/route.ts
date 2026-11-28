import { NextResponse } from "next/server";
import { todoist } from "@/lib/todoist";
import { listExpiry, openTodos, pageQuietness } from "@/lib/notion";
import { googleConfigured, mailFollowUps, moneyChecks, refreshTokens } from "@/lib/google";
import { AREAS, AREA_ORDER, PROJECT_AREA, type AreaId } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const errors: string[] = [];
  const google = googleConfigured();
  const [tasksR, projectsR, expiryR, pagesR, todosR, mailR, moneyR] = await Promise.allSettled([todoist.tasks(), todoist.projects(), listExpiry(), pageQuietness(), openTodos(), google ? mailFollowUps() : Promise.resolve({ rows: [], errors: [] }), google ? moneyChecks() : Promise.resolve([])]);
  const projects = projectsR.status === "fulfilled" ? projectsR.value : [];
  if (tasksR.status === "rejected") errors.push("Todoist: " + String(tasksR.reason?.message || tasksR.reason));
  if (expiryR.status === "rejected") errors.push("Notion Expiry Dates: " + String(expiryR.reason?.message || expiryR.reason));
  if (pagesR.status === "rejected") errors.push("Notion pages: " + String(pagesR.reason?.message || pagesR.reason));
  if (mailR.status === "rejected") errors.push("Gmail: " + String(mailR.reason?.message || mailR.reason));
  if (mailR.status === "fulfilled") errors.push(...mailR.value.errors);
  if (moneyR.status === "rejected") errors.push("Money sheet: " + String(moneyR.reason?.message || moneyR.reason));
  if (todosR.status === "rejected") errors.push("Notion to-dos: " + String(todosR.reason?.message || todosR.reason));

  const projName = new Map(projects.map((p) => [p.id, p.name]));
  const areaLabels = new Map(AREA_ORDER.map((a) => [AREAS[a].label, a]));
  const tasks = (tasksR.status === "fulfilled" ? tasksR.value : []).map((t) => {
    const name = projName.get(t.project_id) || "";
    let area: AreaId = "brain";
    const byLabel = t.labels.map((l) => areaLabels.get(l.toLowerCase())).find(Boolean);
    if (byLabel) area = byLabel;
    else {
      const byProject = PROJECT_AREA.find((m) => m.match.test(name));
      if (byProject) area = byProject.area;
    }
    return {
      id: t.id,
      content: t.content,
      description: t.description,
      due: t.due ? { date: t.due.datetime || t.due.date, recurring: !!t.due.is_recurring, string: t.due.string || "" } : null,
      labels: t.labels,
      area,
      project: name,
      addedAt: t.added_at || null,
      url: `https://app.todoist.com/app/task/${t.id}`,
    };
  });

  return NextResponse.json({
    tasks,
    expiry: expiryR.status === "fulfilled" ? expiryR.value : [],
    pages: pagesR.status === "fulfilled" ? pagesR.value : [],
    todos: todosR.status === "fulfilled" ? todosR.value.todos : [],
    mail: mailR.status === "fulfilled" ? mailR.value.rows : [],
    money: moneyR.status === "fulfilled" ? moneyR.value : [],
    google,
    googleAccounts: refreshTokens().length,
    todosPartial: todosR.status === "fulfilled" ? todosR.value.partial : false,
    errors,
    fetchedAt: new Date().toISOString(),
  });
}
