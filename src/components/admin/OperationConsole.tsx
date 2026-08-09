"use client";

import { useState, type FormEvent } from "react";

type AvailabilitySummary = {
  totalCount?: number;
  records?: Array<Record<string, unknown>>;
};

export default function OperationConsole() {
  const [matchDate, setMatchDate] = useState("");
  const [availabilityDate, setAvailabilityDate] = useState("");
  const [loadingMatchData, setLoadingMatchData] = useState(false);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [loadingImport, setLoadingImport] = useState(false);
  const [availabilitySummary, setAvailabilitySummary] =
    useState<AvailabilitySummary | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(
    null,
  );
  const [matchDataMessage, setMatchDataMessage] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [shiftFromDate, setShiftFromDate] = useState("");
  const [shiftToDate, setShiftToDate] = useState("");
  const [loadingShiftDates, setLoadingShiftDates] = useState(false);
  const [shiftDatesMessage, setShiftDatesMessage] = useState<string | null>(null);

  async function handleInspectAvailability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadingAvailability(true);
    setAvailabilityError(null);

    try {
      const params = new URLSearchParams({ limit: "5" });
      if (availabilityDate.trim()) {
        params.set("date", availabilityDate.trim());
      }

      const response = await fetch(
        `/api/admin/availability?${params.toString()}`,
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to load availability data.");
      }

      setAvailabilitySummary({
        totalCount: payload?.totalCount ?? 0,
        records: Array.isArray(payload?.records) ? payload.records : [],
      });
    } catch (error) {
      setAvailabilitySummary(null);
      setAvailabilityError(
        error instanceof Error
          ? error.message
          : "Unable to load availability data.",
      );
    } finally {
      setLoadingAvailability(false);
    }
  }

  async function handleDownloadMatchData(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadingMatchData(true);
    setMatchDataMessage(null);

    try {
      const target = new URL("/api/admin/getMatchData", window.location.origin);
      if (matchDate.trim()) {
        target.searchParams.set("date", matchDate.trim());
      }

      const response = await fetch(target.toString());
      if (!response.ok) {
        const payload = await response.text();
        throw new Error(payload || "Unable to download match data.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `match-data-${matchDate.trim() || "archive"}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setMatchDataMessage("Archive downloaded successfully.");
    } catch (error) {
      setMatchDataMessage(
        error instanceof Error
          ? error.message
          : "Unable to download match data.",
      );
    } finally {
      setLoadingMatchData(false);
    }
  }

  async function handleShiftDates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadingShiftDates(true);
    setShiftDatesMessage(null);

    if (!shiftFromDate.trim() || !shiftToDate.trim()) {
      setShiftDatesMessage("Both fromDate and toDate are required.");
      setLoadingShiftDates(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/shiftDates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fromDate: shiftFromDate.trim(),
          toDate: shiftToDate.trim(),
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to shift dates.");
      }

      setShiftDatesMessage(
        `Shifted ${payload?.availabilityCount ?? 0} availability record(s) and ${payload?.tripCount ?? 0} trip record(s).`,
      );
    } catch (error) {
      setShiftDatesMessage(
        error instanceof Error ? error.message : "Unable to shift dates.",
      );
    } finally {
      setLoadingShiftDates(false);
    }
  }

  async function handleUploadMatchedData(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setImportMessage("Please choose an Excel file first.");
      return;
    }

    setLoadingImport(true);
    setImportMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/admin/addMatchedData", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to import matched data.");
      }

      setImportMessage(
        `Imported ${payload?.updatedCount ?? 0} trip(s) successfully.`,
      );
      const form = event.currentTarget;
      if (form instanceof HTMLFormElement) {
        form.reset();
      }
      setSelectedFile(null);
    } catch (error) {
      setImportMessage(
        error instanceof Error ? error.message : "Unable to import matched data.",
      );
    } finally {
      setLoadingImport(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section
        style={{
          background: "#ffffff",
          border: "1px solid #E6EAEC",
          borderRadius: 18,
          padding: 20,
          boxShadow: "0 10px 30px rgba(11,30,61,0.05)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: "#0B1E3D",
              }}
            >
              Export match data
            </h2>
            <p style={{ margin: "6px 0 0", color: "#5A6A7A", fontSize: 14 }}>
              Create the compressed match-data bundle for a chosen date. Leave
              the date blank to use the default next day.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleDownloadMatchData}
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              minWidth: 220,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: "#0B1E3D" }}>
              Date (optional)
            </span>
            <input
              value={matchDate}
              onChange={(event) => setMatchDate(event.target.value)}
              type="date"
              style={{
                border: "1px solid #D8E0E4",
                borderRadius: 10,
                padding: "10px 12px",
                fontSize: 14,
              }}
            />
          </label>
          <button
            type="submit"
            disabled={loadingMatchData}
            style={{
              border: "none",
              borderRadius: 10,
              background: loadingMatchData ? "#7BD7CB" : "#00C2A8",
              color: "#ffffff",
              fontWeight: 700,
              padding: "10px 16px",
              cursor: loadingMatchData ? "wait" : "pointer",
              opacity: loadingMatchData ? 0.9 : 1,
              alignSelf: "flex-end",
            }}
          >
            {loadingMatchData ? "Preparing archive..." : "Download archive"}
          </button>
        </form>
        {matchDataMessage ? (
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 14,
              color: matchDataMessage.includes("success")
                ? "#00877A"
                : "#B94A48",
            }}
          >
            {matchDataMessage}
          </p>
        ) : null}

        <form
          onSubmit={handleShiftDates}
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
            marginTop: 16,
          }}
        >
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              minWidth: 220,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: "#0B1E3D" }}>
              From date
            </span>
            <input
              value={shiftFromDate}
              onChange={(event) => setShiftFromDate(event.target.value)}
              type="date"
              style={{
                border: "1px solid #D8E0E4",
                borderRadius: 10,
                padding: "10px 12px",
                fontSize: 14,
              }}
            />
          </label>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              minWidth: 220,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: "#0B1E3D" }}>
              To date
            </span>
            <input
              value={shiftToDate}
              onChange={(event) => setShiftToDate(event.target.value)}
              type="date"
              style={{
                border: "1px solid #D8E0E4",
                borderRadius: 10,
                padding: "10px 12px",
                fontSize: 14,
              }}
            />
          </label>
          <button
            type="submit"
            disabled={loadingShiftDates}
            style={{
              border: "none",
              borderRadius: 10,
              background: loadingShiftDates ? "#7BD7CB" : "#0B1E3D",
              color: "#ffffff",
              fontWeight: 700,
              padding: "10px 16px",
              cursor: loadingShiftDates ? "wait" : "pointer",
              alignSelf: "flex-end",
            }}
          >
            {loadingShiftDates ? "Shifting dates..." : "Shift dates"}
          </button>
        </form>
        {shiftDatesMessage ? (
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 14,
              color: shiftDatesMessage.includes("Shifted")
                ? "#00877A"
                : "#B94A48",
            }}
          >
            {shiftDatesMessage}
          </p>
        ) : null}

        <form
          onSubmit={handleUploadMatchedData}
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
            marginTop: 16,
          }}
        >
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              minWidth: 260,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: "#0B1E3D" }}>
              Import workbook
            </span>
            <input
              type="file"
              accept=".xlsx,.xlsm,.xls"
              onChange={(event) =>
                setSelectedFile(event.target.files?.[0] ?? null)
              }
              style={{
                border: "1px solid #D8E0E4",
                borderRadius: 10,
                padding: "10px 12px",
                fontSize: 14,
                background: "#ffffff",
              }}
            />
          </label>
          <button
            type="submit"
            disabled={loadingImport}
            style={{
              border: "none",
              borderRadius: 10,
              background: loadingImport ? "#7BD7CB" : "#0B1E3D",
              color: "#ffffff",
              fontWeight: 700,
              padding: "10px 16px",
              cursor: loadingImport ? "wait" : "pointer",
              alignSelf: "flex-end",
            }}
          >
            {loadingImport ? "Importing..." : "Import workbook"}
          </button>
        </form>
        {importMessage ? (
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 14,
              color: importMessage.includes("success")
                ? "#00877A"
                : "#B94A48",
            }}
          >
            {importMessage}
          </p>
        ) : null}
      </section>

      <section
        style={{
          background: "#ffffff",
          border: "1px solid #E6EAEC",
          borderRadius: 18,
          padding: 20,
          boxShadow: "0 10px 30px rgba(11,30,61,0.05)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: "#0B1E3D",
              }}
            >
              Inspect availability
            </h2>
            <p style={{ margin: "6px 0 0", color: "#5A6A7A", fontSize: 14 }}>
              Query the admin availability API to preview the next available
              records.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleInspectAvailability}
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              minWidth: 220,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: "#0B1E3D" }}>
              Date (optional)
            </span>
            <input
              value={availabilityDate}
              onChange={(event) => setAvailabilityDate(event.target.value)}
              type="date"
              style={{
                border: "1px solid #D8E0E4",
                borderRadius: 10,
                padding: "10px 12px",
                fontSize: 14,
              }}
            />
          </label>
          <button
            type="submit"
            style={{
              border: "none",
              borderRadius: 10,
              background: "#0B1E3D",
              color: "#ffffff",
              fontWeight: 700,
              padding: "10px 16px",
              cursor: "pointer",
              alignSelf: "flex-end",
            }}
          >
            {loadingAvailability ? "Loading..." : "Inspect"}
          </button>
        </form>

        {availabilityError ? (
          <p style={{ margin: 0, color: "#B94A48", fontSize: 14 }}>
            {availabilityError}
          </p>
        ) : null}

        {availabilitySummary ? (
          <div
            style={{
              background: "#F8FAFB",
              border: "1px solid #E6EAEC",
              borderRadius: 12,
              padding: 12,
            }}
          >
            <p style={{ margin: "0 0 8px", color: "#0B1E3D", fontWeight: 700 }}>
              Found {availabilitySummary.totalCount ?? 0} record(s)
            </p>
            {availabilitySummary.records?.length ? (
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  color: "#5A6A7A",
                  display: "grid",
                  gap: 6,
                }}
              >
                {availabilitySummary.records
                  .slice(0, 5)
                  .map((record, index) => (
                    <li key={index} style={{ fontSize: 13 }}>
                      {record.date
                        ? `Date: ${String(record.date)}`
                        : "Availability entry"}
                      {record.startTime ? ` · ${String(record.startTime)}` : ""}
                      {record.endTime ? ` → ${String(record.endTime)}` : ""}
                    </li>
                  ))}
              </ul>
            ) : (
              <p style={{ margin: 0, color: "#5A6A7A", fontSize: 13 }}>
                No records available for this filter.
              </p>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}
