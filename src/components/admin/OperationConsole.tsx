"use client";

import { useState, type FormEvent } from "react";

type AvailabilitySummary = {
  totalCount?: number;
  records?: Array<Record<string, unknown>>;
};

type StationRecord = {
  id: number;
  name?: string;
  direction?: string;
  stationType?: string;
  lat?: number;
  lng?: number;
  popupInfo?: string;
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
  const [stationNumberQuery, setStationNumberQuery] = useState("");
  const [stationFormName, setStationFormName] = useState("");
  const [stationFormDirection, setStationFormDirection] = useState("");
  const [stationFormType, setStationFormType] = useState("");
  const [stationFormLandmark, setStationFormLandmark] = useState("");
  const [stationFormLat, setStationFormLat] = useState("");
  const [stationFormLng, setStationFormLng] = useState("");
  const [stationPatchId, setStationPatchId] = useState("");
  const [stationDeleteId, setStationDeleteId] = useState("");
  const [stationsFile, setStationsFile] = useState<File | null>(null);
  const [stationsLoading, setStationsLoading] = useState(false);
  const [stationsCreateLoading, setStationsCreateLoading] = useState(false);
  const [stationsPatchLoading, setStationsPatchLoading] = useState(false);
  const [stationsDeleteLoading, setStationsDeleteLoading] = useState(false);
  const [stationsImportLoading, setStationsImportLoading] = useState(false);
  const [stationsMessage, setStationsMessage] = useState<string | null>(null);
  const [stationsData, setStationsData] = useState<StationRecord[]>([]);
  const [ridesDatePurge, setRidesDatePurge] = useState("");
  const [ridesPurgeLoading, setRidesPurgeLoading] = useState(false);
  const [ridesPurgeTodayLoading, setRidesPurgeTodayLoading] = useState(false);
  const [ridesPurgeMessage, setRidesPurgeMessage] = useState<string | null>(null);

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

  async function handleFetchStations(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStationsLoading(true);
    setStationsMessage(null);

    try {
      const target = new URL("/api/stations", window.location.origin);
      if (stationNumberQuery.trim()) {
        target.searchParams.set("stationNumber", stationNumberQuery.trim());
      }

      const response = await fetch(target.toString());
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to fetch stations.");
      }

      if (payload?.station) {
        setStationsData([payload.station as StationRecord]);
        setStationsMessage("Station loaded successfully.");
      } else {
        const records = Array.isArray(payload?.stations)
          ? (payload.stations as StationRecord[])
          : [];
        setStationsData(records);
        setStationsMessage(`Loaded ${records.length} station(s).`);
      }
    } catch (error) {
      setStationsData([]);
      setStationsMessage(
        error instanceof Error ? error.message : "Unable to fetch stations.",
      );
    } finally {
      setStationsLoading(false);
    }
  }

  async function handleCreateStation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStationsCreateLoading(true);
    setStationsMessage(null);

    const lat = Number(stationFormLat);
    const lng = Number(stationFormLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setStationsMessage("Latitude and longitude are required and must be valid numbers.");
      setStationsCreateLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/stations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: stationFormName,
          direction: stationFormDirection,
          stationType: stationFormType,
          landmark: stationFormLandmark,
          lat,
          lng,
          active: true,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to create station.");
      }

      const created = payload?.station as StationRecord | undefined;
      if (created) {
        setStationsData((current) => [created, ...current].slice(0, 20));
      }
      setStationsMessage(
        created
          ? `Station ${created.id} created successfully.`
          : "Station created successfully.",
      );
    } catch (error) {
      setStationsMessage(
        error instanceof Error ? error.message : "Unable to create station.",
      );
    } finally {
      setStationsCreateLoading(false);
    }
  }

  async function handlePatchStation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStationsPatchLoading(true);
    setStationsMessage(null);

    if (!stationPatchId.trim()) {
      setStationsMessage("Station id is required for update.");
      setStationsPatchLoading(false);
      return;
    }

    const payload: Record<string, unknown> = {};
    if (stationFormName.trim()) payload.name = stationFormName.trim();
    if (stationFormDirection.trim()) payload.direction = stationFormDirection.trim();
    if (stationFormType.trim()) payload.stationType = stationFormType.trim();
    if (stationFormLandmark.trim()) payload.landmark = stationFormLandmark.trim();
    if (stationFormLat.trim()) {
      const lat = Number(stationFormLat);
      if (!Number.isFinite(lat)) {
        setStationsMessage("Latitude must be a valid number.");
        setStationsPatchLoading(false);
        return;
      }
      payload.lat = lat;
    }
    if (stationFormLng.trim()) {
      const lng = Number(stationFormLng);
      if (!Number.isFinite(lng)) {
        setStationsMessage("Longitude must be a valid number.");
        setStationsPatchLoading(false);
        return;
      }
      payload.lng = lng;
    }

    if (Object.keys(payload).length === 0) {
      setStationsMessage("Provide at least one field to update.");
      setStationsPatchLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/stations/${stationPatchId.trim()}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error || "Unable to update station.");
      }

      const updated = result?.station as StationRecord | undefined;
      if (updated) {
        setStationsData((current) => {
          const filtered = current.filter((station) => station.id !== updated.id);
          return [updated, ...filtered].slice(0, 20);
        });
      }
      setStationsMessage("Station updated successfully.");
    } catch (error) {
      setStationsMessage(
        error instanceof Error ? error.message : "Unable to update station.",
      );
    } finally {
      setStationsPatchLoading(false);
    }
  }

  async function handleDeleteStation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStationsDeleteLoading(true);
    setStationsMessage(null);

    if (!stationDeleteId.trim()) {
      setStationsMessage("Station id is required for delete.");
      setStationsDeleteLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/stations/${stationDeleteId.trim()}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to delete station.");
      }

      const targetId = Number(stationDeleteId.trim());
      setStationsData((current) =>
        Number.isFinite(targetId)
          ? current.filter((station) => station.id !== targetId)
          : current,
      );
      setStationsMessage("Station deleted successfully.");
    } catch (error) {
      setStationsMessage(
        error instanceof Error ? error.message : "Unable to delete station.",
      );
    } finally {
      setStationsDeleteLoading(false);
    }
  }

  async function handleImportStations(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStationsImportLoading(true);
    setStationsMessage(null);

    if (!stationsFile) {
      setStationsMessage("Please choose a GeoJSON file first.");
      setStationsImportLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", stationsFile);

      const response = await fetch("/api/stations/import", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to import stations.");
      }

      setStationsMessage(`Imported ${payload?.count ?? 0} station(s) successfully.`);
      const form = event.currentTarget;
      if (form instanceof HTMLFormElement) {
        form.reset();
      }
      setStationsFile(null);
      setStationsData([]);
    } catch (error) {
      setStationsMessage(
        error instanceof Error ? error.message : "Unable to import stations.",
      );
    } finally {
      setStationsImportLoading(false);
    }
  }

  async function handlePurgeRides(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRidesPurgeLoading(true);
    setRidesPurgeMessage(null);

    try {
      const target = new URL("/api/admin/rides/purge", window.location.origin);
      if (ridesDatePurge.trim()) {
        target.searchParams.set("date", ridesDatePurge.trim());
      }

      const response = await fetch(target.toString(), {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to purge rides.");
      }

      const count = payload?.deletedCount ?? 0;
      setRidesPurgeMessage(
        ridesDatePurge.trim()
          ? `Deleted ${count} ride(s) for ${ridesDatePurge.trim()}.`
          : `Deleted ${count} ride(s) from all dates.`,
      );
    } catch (error) {
      setRidesPurgeMessage(
        error instanceof Error ? error.message : "Unable to purge rides.",
      );
    } finally {
      setRidesPurgeLoading(false);
    }
  }

  async function handlePurgeTodayRides(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRidesPurgeTodayLoading(true);
    setRidesPurgeMessage(null);

    try {
      const response = await fetch("/api/admin/rides/purge-today", {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to purge today's rides.");
      }

      setRidesPurgeMessage(
        `Deleted ${payload?.deletedCount ?? 0} ride(s) for today (${payload?.date ?? "unknown"}).`,
      );
    } catch (error) {
      setRidesPurgeMessage(
        error instanceof Error ? error.message : "Unable to purge today's rides.",
      );
    } finally {
      setRidesPurgeTodayLoading(false);
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
        <div style={{ marginBottom: 12 }}>
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              color: "#0B1E3D",
            }}
          >
            Rides cleanup
          </h2>
          <p style={{ margin: "6px 0 0", color: "#5A6A7A", fontSize: 14 }}>
            Delete rides by a specific date, clear all rides, or remove only
            rides created for today.
          </p>
        </div>

        <form
          onSubmit={handlePurgeRides}
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
              value={ridesDatePurge}
              onChange={(event) => setRidesDatePurge(event.target.value)}
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
            disabled={ridesPurgeLoading}
            style={{
              border: "none",
              borderRadius: 10,
              background: ridesPurgeLoading ? "#EFA8A8" : "#B94A48",
              color: "#ffffff",
              fontWeight: 700,
              padding: "10px 16px",
              cursor: ridesPurgeLoading ? "wait" : "pointer",
              alignSelf: "flex-end",
            }}
          >
            {ridesPurgeLoading ? "Deleting..." : "Delete by date / all"}
          </button>
        </form>

        <form
          onSubmit={handlePurgeTodayRides}
          style={{
            marginTop: 12,
          }}
        >
          <button
            type="submit"
            disabled={ridesPurgeTodayLoading}
            style={{
              border: "none",
              borderRadius: 10,
              background: ridesPurgeTodayLoading ? "#EFA8A8" : "#5A6A7A",
              color: "#ffffff",
              fontWeight: 700,
              padding: "10px 16px",
              cursor: ridesPurgeTodayLoading ? "wait" : "pointer",
            }}
          >
            {ridesPurgeTodayLoading ? "Deleting today rides..." : "Delete today's rides"}
          </button>
        </form>

        {ridesPurgeMessage ? (
          <p
            style={{
              margin: "12px 0 0",
              fontSize: 14,
              color: ridesPurgeMessage.includes("Deleted") ? "#00877A" : "#B94A48",
            }}
          >
            {ridesPurgeMessage}
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

      <section
        style={{
          background: "#ffffff",
          border: "1px solid #E6EAEC",
          borderRadius: 18,
          padding: 20,
          boxShadow: "0 10px 30px rgba(11,30,61,0.05)",
        }}
      >
        <div style={{ marginBottom: 12 }}>
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              color: "#0B1E3D",
            }}
          >
            Stations operations
          </h2>
          <p style={{ margin: "6px 0 0", color: "#5A6A7A", fontSize: 14 }}>
            Use station APIs to list/search, create, update, delete, and bulk
            import station points.
          </p>
        </div>

        <form
          onSubmit={handleFetchStations}
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
              minWidth: 240,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: "#0B1E3D" }}>
              Station number (optional)
            </span>
            <input
              value={stationNumberQuery}
              onChange={(event) => setStationNumberQuery(event.target.value)}
              placeholder="e.g. 101"
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
            disabled={stationsLoading}
            style={{
              border: "none",
              borderRadius: 10,
              background: stationsLoading ? "#7BD7CB" : "#00C2A8",
              color: "#ffffff",
              fontWeight: 700,
              padding: "10px 16px",
              cursor: stationsLoading ? "wait" : "pointer",
              alignSelf: "flex-end",
            }}
          >
            {stationsLoading ? "Loading stations..." : "Fetch stations"}
          </button>
        </form>

        <form
          onSubmit={handleCreateStation}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 10,
            marginTop: 16,
          }}
        >
          <input
            value={stationFormName}
            onChange={(event) => setStationFormName(event.target.value)}
            placeholder="Name"
            style={{ border: "1px solid #D8E0E4", borderRadius: 10, padding: "10px 12px", fontSize: 14 }}
          />
          <input
            value={stationFormDirection}
            onChange={(event) => setStationFormDirection(event.target.value)}
            placeholder="Direction"
            style={{ border: "1px solid #D8E0E4", borderRadius: 10, padding: "10px 12px", fontSize: 14 }}
          />
          <input
            value={stationFormType}
            onChange={(event) => setStationFormType(event.target.value)}
            placeholder="Station type"
            style={{ border: "1px solid #D8E0E4", borderRadius: 10, padding: "10px 12px", fontSize: 14 }}
          />
          <input
            value={stationFormLandmark}
            onChange={(event) => setStationFormLandmark(event.target.value)}
            placeholder="Landmark"
            style={{ border: "1px solid #D8E0E4", borderRadius: 10, padding: "10px 12px", fontSize: 14 }}
          />
          <input
            value={stationFormLat}
            onChange={(event) => setStationFormLat(event.target.value)}
            placeholder="Latitude"
            style={{ border: "1px solid #D8E0E4", borderRadius: 10, padding: "10px 12px", fontSize: 14 }}
          />
          <input
            value={stationFormLng}
            onChange={(event) => setStationFormLng(event.target.value)}
            placeholder="Longitude"
            style={{ border: "1px solid #D8E0E4", borderRadius: 10, padding: "10px 12px", fontSize: 14 }}
          />
          <button
            type="submit"
            disabled={stationsCreateLoading}
            style={{
              border: "none",
              borderRadius: 10,
              background: stationsCreateLoading ? "#7BD7CB" : "#0B1E3D",
              color: "#ffffff",
              fontWeight: 700,
              padding: "10px 16px",
              cursor: stationsCreateLoading ? "wait" : "pointer",
            }}
          >
            {stationsCreateLoading ? "Creating..." : "Create station"}
          </button>
        </form>

        <form
          onSubmit={handlePatchStation}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 10,
            marginTop: 16,
          }}
        >
          <input
            value={stationPatchId}
            onChange={(event) => setStationPatchId(event.target.value)}
            placeholder="Station id for update"
            style={{ border: "1px solid #D8E0E4", borderRadius: 10, padding: "10px 12px", fontSize: 14 }}
          />
          <button
            type="submit"
            disabled={stationsPatchLoading}
            style={{
              border: "none",
              borderRadius: 10,
              background: stationsPatchLoading ? "#9AA8B6" : "#5A6A7A",
              color: "#ffffff",
              fontWeight: 700,
              padding: "10px 16px",
              cursor: stationsPatchLoading ? "wait" : "pointer",
            }}
          >
            {stationsPatchLoading ? "Updating..." : "Update station (use fields above)"}
          </button>
        </form>

        <form
          onSubmit={handleDeleteStation}
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
            marginTop: 16,
          }}
        >
          <input
            value={stationDeleteId}
            onChange={(event) => setStationDeleteId(event.target.value)}
            placeholder="Station id for delete"
            style={{
              border: "1px solid #D8E0E4",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 14,
              minWidth: 240,
            }}
          />
          <button
            type="submit"
            disabled={stationsDeleteLoading}
            style={{
              border: "none",
              borderRadius: 10,
              background: stationsDeleteLoading ? "#EFA8A8" : "#B94A48",
              color: "#ffffff",
              fontWeight: 700,
              padding: "10px 16px",
              cursor: stationsDeleteLoading ? "wait" : "pointer",
            }}
          >
            {stationsDeleteLoading ? "Deleting..." : "Delete station"}
          </button>
        </form>

        <form
          onSubmit={handleImportStations}
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
            marginTop: 16,
          }}
        >
          <input
            type="file"
            accept=".json,.geojson"
            onChange={(event) => setStationsFile(event.target.files?.[0] ?? null)}
            style={{
              border: "1px solid #D8E0E4",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 14,
              minWidth: 260,
            }}
          />
          <button
            type="submit"
            disabled={stationsImportLoading}
            style={{
              border: "none",
              borderRadius: 10,
              background: stationsImportLoading ? "#7BD7CB" : "#00C2A8",
              color: "#ffffff",
              fontWeight: 700,
              padding: "10px 16px",
              cursor: stationsImportLoading ? "wait" : "pointer",
            }}
          >
            {stationsImportLoading ? "Importing..." : "Import station file"}
          </button>
        </form>

        {stationsMessage ? (
          <p
            style={{
              margin: "12px 0 0",
              color:
                stationsMessage.includes("success") || stationsMessage.includes("Loaded")
                  ? "#00877A"
                  : "#B94A48",
              fontSize: 14,
            }}
          >
            {stationsMessage}
          </p>
        ) : null}

        {stationsData.length ? (
          <div
            style={{
              marginTop: 12,
              border: "1px solid #E6EAEC",
              borderRadius: 12,
              background: "#F8FAFB",
              padding: 12,
            }}
          >
            <p style={{ margin: "0 0 8px", color: "#0B1E3D", fontWeight: 700 }}>
              Showing {Math.min(stationsData.length, 10)} of {stationsData.length} station(s)
            </p>
            <ul
              style={{
                margin: 0,
                paddingLeft: 18,
                color: "#5A6A7A",
                display: "grid",
                gap: 6,
              }}
            >
              {stationsData.slice(0, 10).map((station) => (
                <li key={station.id} style={{ fontSize: 13 }}>
                  #{station.id} {station.name || station.direction || "Station"} ·
                  {` ${station.stationType || "type n/a"}`} ·
                  {` ${station.lat ?? "-"}, ${station.lng ?? "-"}`}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
