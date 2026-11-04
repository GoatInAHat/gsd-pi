import { describe, expect, it } from "vitest";
import {
  IDLE_TIMEOUT_MS,
  NEW_MILESTONE_IDLE_TIMEOUT_MS,
  TASK_IDLE_TIMEOUT_MS,
  TASK_IDLE_TIMEOUT_ENV,
  resolveTaskIdleTimeoutMs,
  shouldArmHeadlessIdleTimeout,
} from "../headless-events.js";

describe("headless idle timeout selection", () => {
  it("keeps the short fallback for extension-layer commands only", () => {
    expect(IDLE_TIMEOUT_MS).toBe(15_000);
    expect(NEW_MILESTONE_IDLE_TIMEOUT_MS).toBe(120_000);
    expect(TASK_IDLE_TIMEOUT_MS).toBeGreaterThan(IDLE_TIMEOUT_MS);
  });

  it("uses the task timeout for model-driven runs", () => {
    expect(resolveTaskIdleTimeoutMs({})).toBe(TASK_IDLE_TIMEOUT_MS);
    expect(resolveTaskIdleTimeoutMs({ [TASK_IDLE_TIMEOUT_ENV]: "300000" })).toBe(300_000);
  });

  it("ignores unusable overrides instead of disabling completion detection", () => {
    for (const value of ["", "abc", "0", "-5", "1.5"]) {
      expect(resolveTaskIdleTimeoutMs({ [TASK_IDLE_TIMEOUT_ENV]: value })).toBe(TASK_IDLE_TIMEOUT_MS);
    }
  });

  it("arms idle completion only after the model has produced a tool call", () => {
    expect(shouldArmHeadlessIdleTimeout(0, 0, true)).toBe(true);
    expect(shouldArmHeadlessIdleTimeout(0, 0, false)).toBe(false);
    expect(shouldArmHeadlessIdleTimeout(2, 0, false)).toBe(true);
    expect(shouldArmHeadlessIdleTimeout(2, 1, false)).toBe(false);
  });
});
