/**
 * Canonical FreezeState normalization utilities
 * Provides consistent freeze state handling across the application
 */

import type { Contracts } from "@dstack/shared";

/**
 * Default freeze state when no freeze state exists
 */
export function defaultFreezeState(): Contracts.FreezeState {
  return {
    frozen: false,
    scope: "deploy",
    reason: null,
    actor: null,
    createdAt: null,
    frozenUntil: null,
    pathScope: null
  };
}

/**
 * Normalize raw freeze state data to canonical FreezeState contract
 */
export function normalizeFreezeState(raw: unknown): Contracts.FreezeState {
  // Handle missing/null/undefined raw data
  if (!raw || typeof raw !== 'object' || raw === null) {
    return defaultFreezeState();
  }

  const obj = raw as Record<string, unknown>;
  
  // Check if this is a "null" freeze state (all fields are null and frozen is false)
  const isNullState = obj.frozen === false && 
    (!obj.reason || obj.reason === null) &&
    (!obj.actor || obj.actor === null) &&
    (!obj.frozenAt || obj.frozenAt === null) &&
    (!obj.frozenUntil || obj.frozenUntil === null) &&
    (!obj.pathScope || obj.pathScope === null);
  
  if (isNullState) {
    return defaultFreezeState();
  }
  
  // Extract and validate frozen status
  const frozen = Boolean(obj.frozen ?? false);
  
  // Determine scope with fallback logic
  let scope: Contracts.FreezeState['scope'] = "deploy";
  
  if (typeof obj.scope === 'string' && obj.scope) {
    // Validate scope is a valid freeze scope
    if (obj.scope === 'deploy' || obj.scope === 'production' || obj.scope === 'all' || obj.scope.startsWith('path:')) {
      scope = obj.scope as Contracts.FreezeState['scope'];
    }
  } else if (typeof obj.pathScope === 'string' && obj.pathScope) {
    // Legacy pathScope handling
    scope = `path:${obj.pathScope}` as Contracts.FreezeState['scope'];
  }
  
  // Handle other fields with proper null defaults
  const reason = typeof obj.reason === 'string' ? obj.reason : null;
  const actor = typeof obj.actor === 'string' ? obj.actor : null;
  const createdAt = typeof obj.frozenAt === 'string' ? obj.frozenAt : null;
  const frozenUntil = typeof obj.frozenUntil === 'string' ? obj.frozenUntil : null;
  const pathScope = typeof obj.pathScope === 'string' ? obj.pathScope : null;
  
  return {
    frozen,
    scope,
    reason,
    actor,
    createdAt,
    frozenUntil,
    pathScope
  };
}
