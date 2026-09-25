import RunHistory from "@/components/run-engine/RunHistory";
export const dynamic = "force-dynamic";
export default function Page({ params, searchParams }: { params: { id: string }; searchParams: { page?: string } }) {
 return <RunHistory kind="test_case" id={params.id} page={searchParams.page} />;
}
