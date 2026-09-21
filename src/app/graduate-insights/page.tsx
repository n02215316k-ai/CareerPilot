import type { Metadata } from "next";
import GraduateInsights from "@/components/graduate-insights";

export const metadata: Metadata = {
  title: "Graduate Insights | CareerPilot",
  description: "Interactive analysis of the NUST 32nd Graduation Ceremony booklet.",
};

export default function GraduateInsightsPage() {
  return <GraduateInsights />;
}
