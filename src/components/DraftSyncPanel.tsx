import React, { useEffect, useMemo, useState } from "react";
import type { DraftSyncPayload } from "../utils/draftSync";
import {
  DRAFT_SYNC_STORAGE_KEY,
  type DraftSyncRequest,
  loadDraftSyncRequest,
  safeJsonParse,
} from "../utils/draftSyncProviders";

type SyncSummary = {
  sourceLabel: string;
  receivedCount: number;
  importedCount: number;
  unmatchedCount: number;
  unmatchedExamples?: string[];
};

type DraftSyncPanelProps = {
  onApplySync: (payload: DraftSyncPayload) => Promise<SyncSummary> | SyncSummary;
  onSyncSuccess?: (request: DraftSyncRequest) => void;
};

function getLocalStorageState() {
  return safeJsonParse<{
    sleeper?: DraftSyncRequest["config"];
  }>(
    typeof window === "undefined" ? null : window.localStorage.getItem(DRAFT_SYNC_STORAGE_KEY),
    {}
  );
}

export default function DraftSyncPanel(props: DraftSyncPanelProps) {
  const { onApplySync, onSyncSuccess } = props;
  const stored = useMemo(() => getLocalStorageState(), []);

  const [sleeperConfig, setSleeperConfig] = useState<DraftSyncRequest["config"]>(stored.sleeper ?? { identifier: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      DRAFT_SYNC_STORAGE_KEY,
      JSON.stringify({
        provider: "sleeper",
        sleeper: sleeperConfig,
      })
    );
  }, [sleeperConfig]);

  async function handleSync() {
    setIsLoading(true);
    setMessage("");
    setError("");

    try {
      const request: DraftSyncRequest = {
        provider: "sleeper",
        config: sleeperConfig,
      };

      const payload = await loadDraftSyncRequest(request);
      const summary = await onApplySync(payload);

      if (summary.importedCount === 0) {
        setError(
          summary.unmatchedCount > 0
            ? `No players were matched from ${summary.sourceLabel}. Received ${summary.receivedCount} picks. Unmatched examples: ${(summary.unmatchedExamples ?? []).slice(0, 5).join(", ")}`
            : `No picks were imported from ${summary.sourceLabel}.`
        );
        return;
      }

      setMessage(
        summary.unmatchedCount > 0
          ? `Imported ${summary.importedCount} of ${summary.receivedCount} picks from ${summary.sourceLabel}. ${summary.unmatchedCount} picks still need manual matching.`
          : `Imported ${summary.importedCount} picks from ${summary.sourceLabel}.`
      );
      onSyncSuccess?.(request);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setIsLoading(false);
    }
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "var(--text-0)",
    padding: "8px 10px",
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.1)",
        background: "rgba(255,255,255,0.04)",
        minWidth: 0,
      }}
    >
      <div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "var(--text-0)" }}>Sleeper Sync</div>
        <div style={{ fontSize: 17, color: "rgba(255,255,255,0.68)", marginTop: 6, lineHeight: 1.35 }}>
          Import live picks from a Sleeper draft or league.
        </div>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <input
          value={sleeperConfig.identifier}
          onChange={(event) => setSleeperConfig({ identifier: event.target.value })}
          placeholder="Sleeper draft ID, league ID, or URL"
          style={{
            ...fieldStyle,
            fontSize: 22,
            padding: "14px 16px",
          }}
        />
        <div style={{ fontSize: 17, color: "rgba(255,255,255,0.62)", lineHeight: 1.35 }}>
          Works with a draft URL, a draft ID, or a league ID.
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 18, color: error ? "rgb(248,113,113)" : "rgba(255,255,255,0.68)", minHeight: 28, lineHeight: 1.4 }}>
          {error || message || "Sync replaces the current drafted state with the imported picks."}
        </div>
        <button
          type="button"
          onClick={handleSync}
          disabled={isLoading}
          style={{
            padding: "13px 18px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.14)",
            background: isLoading ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.14)",
            color: "var(--text-0)",
            fontWeight: 800,
            fontSize: 18,
            cursor: isLoading ? "progress" : "pointer",
          }}
        >
          {isLoading ? "Syncing..." : "Sync Draft"}
        </button>
      </div>
    </div>
  );
}
