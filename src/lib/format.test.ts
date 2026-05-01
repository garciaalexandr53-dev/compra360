import { describe, it, expect } from "vitest";
import {
  formatTimeRemaining,
  defaultPrazoHoje,
  toTimeInputValue,
  timeInputToTodayIso,
  formatHoraLocal,
} from "./format";

describe("formatTimeRemaining", () => {
  const now = new Date("2026-05-01T12:00:00").getTime();

  it("returns expired when target is in the past", () => {
    const r = formatTimeRemaining(new Date(now - 60_000).toISOString(), now);
    expect(r.expired).toBe(true);
    expect(r.label).toBe("expirado");
  });

  it("returns hours and minutes for >1h", () => {
    const r = formatTimeRemaining(new Date(now + (2 * 60 + 30) * 60_000).toISOString(), now);
    expect(r.expired).toBe(false);
    expect(r.label).toBe("2h 30min");
  });

  it("returns only minutes when <1h", () => {
    const r = formatTimeRemaining(new Date(now + 45 * 60_000).toISOString(), now);
    expect(r.label).toBe("45min");
  });

  it("returns 'menos de 1min' when seconds left", () => {
    const r = formatTimeRemaining(new Date(now + 30_000).toISOString(), now);
    expect(r.expired).toBe(false);
    expect(r.label).toBe("menos de 1min");
  });

  it("returns empty for null", () => {
    expect(formatTimeRemaining(null).label).toBe("");
  });
});

describe("time input helpers", () => {
  it("defaultPrazoHoje returns ISO at given hour", () => {
    const iso = defaultPrazoHoje(18, 0);
    const d = new Date(iso);
    expect(d.getHours()).toBe(18);
    expect(d.getMinutes()).toBe(0);
  });

  it("toTimeInputValue ↔ timeInputToTodayIso roundtrip", () => {
    const iso = timeInputToTodayIso("15:30");
    expect(toTimeInputValue(iso)).toBe("15:30");
  });

  it("formatHoraLocal returns HH:mm", () => {
    const iso = timeInputToTodayIso("09:05");
    expect(formatHoraLocal(iso)).toMatch(/^09:05$/);
  });
});
