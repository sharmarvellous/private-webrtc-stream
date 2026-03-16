import { useState } from "react";

export function useAsyncTask() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function run(task) {
    setIsLoading(true);
    setError("");

    try {
      return await task();
    } catch (taskError) {
      setError(taskError.message ?? "Unexpected error");
      throw taskError;
    } finally {
      setIsLoading(false);
    }
  }

  function clearError() {
    setError("");
  }

  return { isLoading, error, run, clearError };
}
