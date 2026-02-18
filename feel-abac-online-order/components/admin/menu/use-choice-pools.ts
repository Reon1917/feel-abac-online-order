"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import type {
  ChoicePoolOption,
  ChoicePoolWithOptions,
} from "@/lib/menu/pool-types";
import {
  createPool,
  createPoolOption,
  deletePool,
  duplicatePool,
  deletePoolOption,
  updatePool,
  updatePoolOption,
  type CreatePoolPayload,
  type CreatePoolOptionPayload,
  type DuplicatePoolPayload,
  type UpdatePoolPayload,
  type UpdatePoolOptionPayload,
} from "./pool-api-client";

type UseChoicePoolsResult = {
  pools: ChoicePoolWithOptions[];
  isSubmitting: boolean;
  createPool: (data: CreatePoolPayload) => Promise<void>;
  duplicatePool: (poolId: string, data?: DuplicatePoolPayload) => Promise<void>;
  updatePool: (poolId: string, data: UpdatePoolPayload) => Promise<void>;
  deletePool: (poolId: string) => Promise<void>;
  createOption: (
    poolId: string,
    data: CreatePoolOptionPayload
  ) => Promise<void>;
  updateOption: (
    poolId: string,
    optionId: string,
    data: UpdatePoolOptionPayload
  ) => Promise<void>;
  deleteOption: (poolId: string, optionId: string) => Promise<void>;
};

export function useChoicePools(
  initialPools: ChoicePoolWithOptions[]
): UseChoicePoolsResult {
  const [pools, setPools] = useState<ChoicePoolWithOptions[]>(initialPools);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const withSubmitting = useCallback(
    async (fn: () => Promise<void>) => {
      setIsSubmitting(true);
      try {
        await fn();
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  const handleError = useCallback((error: unknown, fallback: string) => {
    const message =
      error instanceof Error ? error.message : fallback || "An error occurred";
    toast.error(message);
  }, []);

  const handleCreatePool = useCallback(
    async (data: CreatePoolPayload) => {
      await withSubmitting(async () => {
        try {
          const pool = await createPool(data);
          setPools((prev) => [...prev, { ...pool, options: [] }]);
          toast.success("Pool created");
        } catch (error) {
          handleError(error, "Failed to create pool");
          throw error;
        }
      });
    },
    [handleError, withSubmitting]
  );

  const handleUpdatePool = useCallback(
    async (poolId: string, data: UpdatePoolPayload) => {
      await withSubmitting(async () => {
        try {
          const updated = await updatePool(poolId, data);
          setPools((prev) =>
            prev.map((pool) =>
              pool.id === updated.id
                ? { ...updated, options: pool.options }
                : pool
            )
          );
          toast.success("Pool updated");
        } catch (error) {
          handleError(error, "Failed to update pool");
          throw error;
        }
      });
    },
    [handleError, withSubmitting]
  );

  const handleDeletePool = useCallback(
    async (poolId: string) => {
      await withSubmitting(async () => {
        try {
          await deletePool(poolId);
          setPools((prev) => prev.filter((pool) => pool.id !== poolId));
          toast.success("Pool deleted");
        } catch (error) {
          handleError(error, "Failed to delete pool");
          throw error;
        }
      });
    },
    [handleError, withSubmitting]
  );

  const handleDuplicatePool = useCallback(
    async (poolId: string, data: DuplicatePoolPayload = {}) => {
      await withSubmitting(async () => {
        try {
          const duplicated = await duplicatePool(poolId, data);
          setPools((prev) => [...prev, duplicated]);
          toast.success("Pool duplicated");
        } catch (error) {
          handleError(error, "Failed to duplicate pool");
          throw error;
        }
      });
    },
    [handleError, withSubmitting]
  );

  const handleCreateOption = useCallback(
    async (poolId: string, data: CreatePoolOptionPayload) => {
      await withSubmitting(async () => {
        try {
          const option = await createPoolOption(poolId, data);
          setPools((prev) =>
            prev.map((pool) =>
              pool.id === poolId
                ? { ...pool, options: [...pool.options, option] }
                : pool
            )
          );
          toast.success("Option created");
        } catch (error) {
          handleError(error, "Failed to create option");
          throw error;
        }
      });
    },
    [handleError, withSubmitting]
  );

  const handleUpdateOption = useCallback(
    async (poolId: string, optionId: string, data: UpdatePoolOptionPayload) => {
      await withSubmitting(async () => {
        try {
          const option = await updatePoolOption(poolId, optionId, data);
          setPools((prev) =>
            prev.map((pool) =>
              pool.id === poolId
                ? {
                    ...pool,
                    options: pool.options.map((existing: ChoicePoolOption) =>
                      existing.id === option.id ? option : existing
                    ),
                  }
                : pool
            )
          );
          toast.success("Option updated");
        } catch (error) {
          handleError(error, "Failed to update option");
          throw error;
        }
      });
    },
    [handleError, withSubmitting]
  );

  const handleDeleteOption = useCallback(
    async (poolId: string, optionId: string) => {
      await withSubmitting(async () => {
        try {
          await deletePoolOption(poolId, optionId);
          setPools((prev) =>
            prev.map((pool) =>
              pool.id === poolId
                ? {
                    ...pool,
                    options: pool.options.filter(
                      (option: ChoicePoolOption) => option.id !== optionId
                    ),
                  }
                : pool
            )
          );
          toast.success("Option deleted");
        } catch (error) {
          handleError(error, "Failed to delete option");
          throw error;
        }
      });
    },
    [handleError, withSubmitting]
  );

  return {
    pools,
    isSubmitting,
    createPool: handleCreatePool,
    duplicatePool: handleDuplicatePool,
    updatePool: handleUpdatePool,
    deletePool: handleDeletePool,
    createOption: handleCreateOption,
    updateOption: handleUpdateOption,
    deleteOption: handleDeleteOption,
  };
}
