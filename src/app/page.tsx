import { getDashboard } from "@/server/application";
import { FeedbackDashboard } from "@/features/feedback/components/feedback-dashboard";
import { parseFeedbackQuery } from "@/lib/validation/feedback";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseFeedbackQuery(await searchParams);
  const { page, summary, projects, versions } = await getDashboard(query);

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
