"use client";

// biome-ignore lint/style/noRestrictedImports: This helper is the single allowed mount-only effect escape hatch.
import { type EffectCallback, useEffect } from "react";

export function useMountEffect(effect: EffectCallback) {
	// biome-ignore lint/correctness/useExhaustiveDependencies: Mount-only by design; re-running on a new effect identity would defeat the helper.
	useEffect(effect, []);
}
