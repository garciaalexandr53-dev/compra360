import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useState } from "react";
import SearchInputComScanner from "./SearchInputComScanner";

const startMock = vi.fn();
const stopMock = vi.fn().mockResolvedValue(undefined);
const clearMock = vi.fn();

vi.mock("html5-qrcode", () => ({
  Html5Qrcode: class {
    start = (...args: unknown[]) => startMock(...args);
    stop = () => stopMock();
    clear = () => clearMock();
  },
  Html5QrcodeSupportedFormats: { EAN_13: 1, EAN_8: 2, UPC_A: 3, UPC_E: 4 },
}));

/** Wrapper com estado, igual ao uso em ProdutosPage (value/onChange). */
const Harness = ({ onValue }: { onValue: (v: string) => void }) => {
  const [search, setSearch] = useState("");
  return (
    <SearchInputComScanner
      value={search}
      onChange={(v) => {
        setSearch(v);
        onValue(v);
      }}
      placeholder="Buscar por nome ou código de barras"
    />
  );
};

describe("SearchInputComScanner — leitura por câmera", () => {
  beforeEach(() => {
    startMock.mockReset();
    stopMock.mockClear();
    clearMock.mockClear();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn() },
    });
  });

  it("preenche o campo, fecha o modal e propaga o termo para a busca", async () => {
    let emitir: ((code: string) => void) | null = null;
    startMock.mockImplementation((_cfg, _opts, onSuccess: (c: string) => void) => {
      emitir = onSuccess;
      return Promise.resolve();
    });

    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);

    fireEvent.click(screen.getByLabelText("Escanear código de barras"));
    await waitFor(() => expect(startMock).toHaveBeenCalled());

    emitir!("7898002570217");

    // campo preenchido com o código lido
    await waitFor(() =>
      expect(
        (screen.getByPlaceholderText("Buscar por nome ou código de barras") as HTMLInputElement)
          .value,
      ).toBe("7898002570217"),
    );
    // busca disparada via onChange (mesmo fluxo de digitação)
    expect(onValue).toHaveBeenCalledWith("7898002570217");
    // modal fechado e câmera liberada
    await waitFor(() => expect(screen.queryByLabelText("Fechar scanner")).toBeNull());
    await waitFor(() => expect(stopMock).toHaveBeenCalled());
  });

  it("mantém apenas dígitos do código lido", async () => {
    let emitir: ((code: string) => void) | null = null;
    startMock.mockImplementation((_cfg, _opts, onSuccess: (c: string) => void) => {
      emitir = onSuccess;
      return Promise.resolve();
    });

    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    fireEvent.click(screen.getByLabelText("Escanear código de barras"));
    await waitFor(() => expect(startMock).toHaveBeenCalled());

    emitir!(" 789-800 2570217 ");
    await waitFor(() => expect(onValue).toHaveBeenCalledWith("7898002570217"));
  });
});
