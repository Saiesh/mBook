import { createElement } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProjectDatePage from "../page";

// Why: React requires this flag in non-JSDOM harnesses so async state updates flush predictably in tests.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  getPendingMeasurementsMock: vi.fn(),
  getAreaNameSuggestionsMock: vi.fn(),
  syncProjectMeasurementsMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ projectId: "project-1", date: "2026-02-21" }),
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => createElement("a", { href }, children),
}));

vi.mock("@/lib/capture/offline-store", () => ({
  savePendingMeasurement: vi.fn(),
  getPendingMeasurements: mocks.getPendingMeasurementsMock,
  getAreaNameSuggestions: mocks.getAreaNameSuggestionsMock,
}));

vi.mock("@/lib/capture/sync", () => ({
  syncProjectMeasurements: mocks.syncProjectMeasurementsMock,
}));

vi.mock("@/lib/capture/use-online-auto-sync", () => ({
  useOnlineAutoSync: ({ onSync }: { onSync: () => Promise<void> }) => ({
    // Why: this isolates manual sync behavior without online-event timing variability.
    runSync: onSync,
  }),
}));

function jsonResponse(data: unknown, ok = true): Response {
  return {
    ok,
    json: async () => data,
  } as Response;
}

async function waitFor(assertion: () => void, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      assertion();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
  assertion();
}

function getButtonByText(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find((node) =>
    node.textContent?.includes(label)
  );
  if (!button) {
    throw new Error(`Button not found: ${label}`);
  }
  return button as HTMLButtonElement;
}

describe("project date capture page", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("shows syncing transition while manual sync is running", async () => {
    mocks.getPendingMeasurementsMock.mockResolvedValue([]);
    mocks.getAreaNameSuggestionsMock.mockResolvedValue([]);

    // Why: storing the resolver on an object avoids TS narrowing `resolveSync` to `never` after async mock setup.
    const syncControl: {
      resolve: ((value: { synced: number; duplicates: number }) => void) | null;
    } = { resolve: null };
    mocks.syncProjectMeasurementsMock.mockImplementation(
      () =>
        new Promise<{ synced: number; duplicates: number }>((resolve) => {
          syncControl.resolve = resolve;
        })
    );

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/projects/project-1/measurements?date=2026-02-21")) {
        return jsonResponse({ success: true, data: [] });
      }
      if (url.endsWith("/api/projects/project-1/boq/version-1")) {
        return jsonResponse({
          success: true,
          data: {
            sections: [],
          },
        });
      }
      if (url.endsWith("/api/projects/project-1/boq")) {
        return jsonResponse({
          success: true,
          data: [{ id: "version-1", isActive: true }],
        });
      }
      if (url.endsWith("/api/projects/project-1")) {
        return jsonResponse({ success: true, data: { name: "Project One" } });
      }
      throw new Error(`Unhandled fetch URL in test: ${url}`);
    });

    await act(async () => {
      root.render(createElement(ProjectDatePage));
    });

    await waitFor(() => {
      expect(container.textContent).toContain("Sync Now");
    });

    await act(async () => {
      getButtonByText(container, "Sync Now").click();
    });

    // Why: users need immediate visible feedback that a sync attempt has started.
    expect(container.textContent).toContain("Syncing...");
    syncControl.resolve?.({ synced: 2, duplicates: 1 });

    await waitFor(() => {
      expect(container.textContent).toContain("Synced 2 measurement(s), skipped 1 duplicate(s).");
      expect(container.textContent).toContain("Sync Now");
    });
  });
});
