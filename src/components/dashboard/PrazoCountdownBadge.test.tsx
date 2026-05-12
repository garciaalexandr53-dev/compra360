import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PrazoCountdownBadge, { getPrazoTone } from "./PrazoCountdownBadge";

const now = Date.now();
const isoIn = (mins: number) => new Date(now + mins * 60_000).toISOString();

describe("getPrazoTone", () => {
  it("neutral when no prazo", () => {
    expect(getPrazoTone(null, now)).toBe("neutral");
    expect(getPrazoTone(undefined, now)).toBe("neutral");
  });
  it("red when expired", () => {
    expect(getPrazoTone(isoIn(-10), now)).toBe("red");
  });
  it("red when <= 60 min remaining", () => {
    expect(getPrazoTone(isoIn(30), now)).toBe("red");
    expect(getPrazoTone(isoIn(60), now)).toBe("red");
  });
  it("yellow when between 1h and 3h", () => {
    expect(getPrazoTone(isoIn(120), now)).toBe("yellow");
    expect(getPrazoTone(isoIn(180), now)).toBe("yellow");
  });
  it("green when > 3h", () => {
    expect(getPrazoTone(isoIn(240), now)).toBe("green");
  });
});

describe("PrazoCountdownBadge", () => {
  it("shows 'Sem prazo definido' when null", () => {
    render(<PrazoCountdownBadge prazoIso={null} />);
    expect(screen.getByText(/Sem prazo definido/i)).toBeInTheDocument();
  });
  it("shows countdown label when prazo is in the future", () => {
    render(<PrazoCountdownBadge prazoIso={isoIn(150)} />);
    expect(screen.getByText(/Prazo: hoje/i)).toBeInTheDocument();
  });
  it("shows expirado when in the past", () => {
    render(<PrazoCountdownBadge prazoIso={isoIn(-30)} />);
    expect(screen.getByText(/expirado/i)).toBeInTheDocument();
  });
});
