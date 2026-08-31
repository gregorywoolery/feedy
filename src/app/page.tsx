import { listFeedback, getFeedbackSummary, listFeedbackVersions } from "@/data-access/feedback/feedback-repository";
import { listProjectOptions } from "@/data-access/projects/project-repository";
import { FeedbackDashboard } from "@/features/feedback/components/feedback-dashboard";
import { parseFeedbackQuery } from "@/lib/validation/feedback";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseFeedbackQuery(await searchParams);
  const [page, summary, projects, versions] = await Promise.all([
    listFeedback(query),
    getFeedbackSummary(),
    listProjectOptions(),
    listFeedbackVersions(query.project || undefined)
  ]);

  return (
    <FeedbackDashboard
      key={JSON.stringify(query)}
      page={page}
      projects={projects}
      query={query}
      summary={summary}
      versions={versions}
    />
  );
}
