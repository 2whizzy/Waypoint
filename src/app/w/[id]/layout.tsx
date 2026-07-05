import { Shell } from "@/components/workspace/Shell";
import { WorkspaceProvider } from "@/components/workspace/WorkspaceProvider";

export default function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  return (
    <WorkspaceProvider workspaceId={params.id}>
      <Shell>{children}</Shell>
    </WorkspaceProvider>
  );
}
