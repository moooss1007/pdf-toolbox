import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { errorMessage } from "@/client/lib/format";
import { runTask } from "@/serverFunctions/tasks";
import type { RunTaskInput } from "@/server/tasks";

/** Runs a tool, then opens its result; a problem stays on the page as `error`. */
export function useRunTask() {
  const navigate = useNavigate();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(input: RunTaskInput) {
    setRunning(true);
    setError(null);
    try {
      const result = await runTask({ data: input });
      if (result.taskId) {
        await navigate({ to: "/tasks/$id", params: { id: result.taskId } });
      } else {
        setError(result.error);
      }
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setRunning(false);
    }
  }

  return { run, running, error, setError };
}
