/** Owns the public operation only; no claim about inaccessible SDK finalizers. */
export function createLifecycle(
  run: () => Promise<unknown>,
  cancel: () => Promise<unknown>,
  unmount: () => void | Promise<void>,
) {
  let status: 'idle' | 'pending' | 'fulfilled' | 'rejected' = 'idle';
  let original: Promise<unknown> | null = null;
  let failure: string | null = null;
  let closed = false;
  let disposal: Promise<void> | null = null;
  const rejected = (error: unknown) => {
    status = 'rejected';
    failure = String(error instanceof Error ? error.message : error).slice(0, 4096);
  };
  return {
    operation: () => ({kind: 'original-run-promise' as const, status}),
    error: () => failure,
    start() {
      if (closed) throw new Error('Run admission closed');
      if (status !== 'idle') throw new Error('Run admission is once-only');
      status = 'pending';
      try {
        original = run();
        // Observe the original rejection without replacing the original promise.
        void original.then(() => { status = 'fulfilled'; }, rejected);
      } catch (error) {
        rejected(error);
        original = Promise.reject(error);
        void original.catch(() => {});
        throw error;
      }
    },
    async waitForRun() {
      if (!original) throw new Error('Run not started');
      await original;
    },
    dispose(): Promise<void> {
      if (disposal) return disposal;
      closed = true;
      disposal = (async () => {
        const errors: unknown[] = [];
        try { await cancel(); } catch (error) { errors.push(error); }
        // Run failure is preserved by waitForRun/read; it is not cleanup failure.
        if (original) await Promise.allSettled([original]);
        try { await unmount(); } catch (error) { errors.push(error); }
        if (errors.length) throw new AggregateError(errors, 'Public cleanup failed');
      })();
      return disposal;
    },
  };
}
