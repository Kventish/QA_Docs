import LegacyRun from "@/components/run-engine/LegacyRun";
export const dynamic = "force-dynamic";
export default function Page({ params }: { params: { id: string; runId: string } }) {
 return <LegacyRun id={params.id} runId={params.runId} />;
}
