import { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  defineAbilityFor,
  type AppAbility,
  type PolicyAction,
  type PolicySubject,
  type PolicyRule,
} from "@/lib/policy-engine";

export function usePolicy(): AppAbility {
  const { user } = useAuth();
  return useMemo(() => defineAbilityFor(user), [user]);
}

export type { AppAbility, PolicyAction, PolicySubject, PolicyRule };
