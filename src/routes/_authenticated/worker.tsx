import { createFileRoute } from "@tanstack/react-router";
import { WorkerOverview } from "./labour/$id";
import { useSession } from "@/lib/auth/session";

export const Route = createFileRoute("/_authenticated/worker")({
  component: WorkerHome,
});

function WorkerHome() {
  // The worker's own row comes from their signed-in session (see lib/auth/session.tsx);
  // the database only ever lets them read their own attendance and payments.
  const { me } = useSession();
  if (!me?.workerId) {
    return <p className="text-center py-10 text-destructive">Worker account is not linked.</p>;
  }
  return <WorkerOverview id={me.workerId} readOnly />;
}
