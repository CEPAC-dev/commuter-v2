"use client";

import { useState, type FormEvent } from "react";
import { AdminCard } from "@/components/admin/layout";

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

function currentLocalDateTime() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
}

export default function OperationConsole() {
  const [matchDate, setMatchDate] = useState("");
  const [matrixProvider, setMatrixProvider] = useState("osrm");
  const [valhallaCosting, setValhallaCosting] = useState("auto");
  const [valhallaDateTimeType, setValhallaDateTimeType] = useState("current");
  const [valhallaDateTime, setValhallaDateTime] = useState("");
  const [travelTimeTransportation, setTravelTimeTransportation] =
    useState("driving");
  const [travelTimeDepartureTime, setTravelTimeDepartureTime] =
    useState(currentLocalDateTime);
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
  const [shiftDatesMessage, setShiftDatesMessage] = useState<string | null>(
    null,
  );
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
  const [stationsMatrixProvider, setStationsMatrixProvider] = useState("osrm");
  const [stationsValhallaCosting, setStationsValhallaCosting] =
    useState("auto");
  const [stationsValhallaDateTimeType, setStationsValhallaDateTimeType] =
    useState("current");
  const [stationsValhallaDateTime, setStationsValhallaDateTime] = useState("");
  const [
    stationsTravelTimeTransportation,
    setStationsTravelTimeTransportation,
  ] = useState("driving");
  const [stationsTravelTimeDepartureTime, setStationsTravelTimeDepartureTime] =
    useState(currentLocalDateTime);
  const [stationsMatrixLoading, setStationsMatrixLoading] = useState(false);
  const [stationsMatrixMessage, setStationsMatrixMessage] = useState<
    string | null
  >(null);
  const [ridesDatePurge, setRidesDatePurge] = useState("");
  const [ridesPurgeLoading, setRidesPurgeLoading] = useState(false);
  const [ridesPurgeTodayLoading, setRidesPurgeTodayLoading] = useState(false);
  const [ridesPurgeMessage, setRidesPurgeMessage] = useState<string | null>(
    null,
  );
  const [availabilityBackupLoading, setAvailabilityBackupLoading] =
    useState(false);
  const [availabilityRestoreLoading, setAvailabilityRestoreLoading] =
    useState(false);
  const [availabilityImportFile, setAvailabilityImportFile] =
    useState<File | null>(null);
  const [availabilityActionMessage, setAvailabilityActionMessage] = useState<
    string | null
  >(null);

  async function handleInspectAvailability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadingAvailability(true);
    setAvailabilityError(null);
    setAvailabilityActionMessage(null);

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

  async function handleDownloadAvailabilityBackup() {
    setAvailabilityBackupLoading(true);
    setAvailabilityActionMessage(null);

    try {
      const response = await fetch("/api/admin/availability/export");

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(
          payload?.error || "Unable to export availability backup.",
        );
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "availabilities-backup.json";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setAvailabilityActionMessage(
        "Availability backup downloaded successfully.",
      );
    } catch (error) {
      setAvailabilityActionMessage(
        error instanceof Error
          ? error.message
          : "Unable to export availability backup.",
      );
    } finally {
      setAvailabilityBackupLoading(false);
    }
  }

  async function handleRestoreAvailability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAvailabilityRestoreLoading(true);
    setAvailabilityActionMessage(null);

    if (!availabilityImportFile) {
      setAvailabilityActionMessage(
        "Please choose a JSON backup file to restore.",
      );
      setAvailabilityRestoreLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", availabilityImportFile);

      const response = await fetch("/api/admin/availability/restore", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          payload?.error || "Unable to restore availability records.",
        );
      }

      setAvailabilityActionMessage(
        `Restored ${payload?.createdCount ?? 0} new and ${payload?.updatedCount ?? 0} updated availability record(s).`,
      );
      const form = event.currentTarget;
      if (form instanceof HTMLFormElement) {
        form.reset();
      }
      setAvailabilityImportFile(null);
    } catch (error) {
      setAvailabilityActionMessage(
        error instanceof Error
          ? error.message
          : "Unable to restore availability records.",
      );
    } finally {
      setAvailabilityRestoreLoading(false);
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
      target.searchParams.set("matrixProvider", matrixProvider);
      if (matrixProvider === "valhalla") {
        target.searchParams.set("valhallaCosting", valhallaCosting);
        target.searchParams.set("valhallaDateTimeType", valhallaDateTimeType);
        if (valhallaDateTimeType !== "current" && valhallaDateTime) {
          target.searchParams.set("valhallaDateTime", valhallaDateTime);
        }
      }
      if (matrixProvider === "traveltime") {
        target.searchParams.set(
          "travelTimeTransportation",
          travelTimeTransportation,
        );
        target.searchParams.set(
          "travelTimeDepartureTime",
          new Date(travelTimeDepartureTime).toISOString(),
        );
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
        error instanceof Error
          ? error.message
          : "Unable to import matched data.",
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

  async function handleGenerateStationsMatrix(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setStationsMatrixLoading(true);
    setStationsMatrixMessage(null);

    try {
      const target = new URL(
        "/api/admin/stations/matrix",
        window.location.origin,
      );
      target.searchParams.set("matrixProvider", stationsMatrixProvider);
      if (stationsMatrixProvider === "valhalla") {
        target.searchParams.set("valhallaCosting", stationsValhallaCosting);
        target.searchParams.set(
          "valhallaDateTimeType",
          stationsValhallaDateTimeType,
        );
        if (
          stationsValhallaDateTimeType !== "current" &&
          stationsValhallaDateTime
        ) {
          target.searchParams.set("valhallaDateTime", stationsValhallaDateTime);
        }
      }
      if (stationsMatrixProvider === "traveltime") {
        target.searchParams.set(
          "travelTimeTransportation",
          stationsTravelTimeTransportation,
        );
        target.searchParams.set(
          "travelTimeDepartureTime",
          new Date(stationsTravelTimeDepartureTime).toISOString(),
        );
      }

      const response = await fetch(target.toString());
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Unable to generate station matrix.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "stations-matrix.xlsx";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setStationsMatrixMessage("Station matrix downloaded successfully.");
    } catch (error) {
      setStationsMatrixMessage(
        error instanceof Error
          ? error.message
          : "Unable to generate station matrix.",
      );
    } finally {
      setStationsMatrixLoading(false);
    }
  }

  async function handleCreateStation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStationsCreateLoading(true);
    setStationsMessage(null);

    const lat = Number(stationFormLat);
    const lng = Number(stationFormLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setStationsMessage(
        "Latitude and longitude are required and must be valid numbers.",
      );
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
    if (stationFormDirection.trim())
      payload.direction = stationFormDirection.trim();
    if (stationFormType.trim()) payload.stationType = stationFormType.trim();
    if (stationFormLandmark.trim())
      payload.landmark = stationFormLandmark.trim();
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
          const filtered = current.filter(
            (station) => station.id !== updated.id,
          );
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

      setStationsMessage(
        `Imported ${payload?.count ?? 0} station(s) successfully.`,
      );
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

  async function requestAdminDelete(
    actionLabel: string,
    url: string,
    options: RequestInit,
  ) {
    const password = window.prompt(
      `Enter ADMIN_PASSWORD to confirm ${actionLabel}.`,
    );

    if (password === null) {
      return { canceled: true as const };
    }

    const headers = new Headers(options.headers ?? {});
    headers.set("x-admin-password", password);

    const response = await fetch(url, {
      ...options,
      headers,
    });
    const payload = await response.json().catch(() => null);

    return { canceled: false as const, response, payload };
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

      const result = await requestAdminDelete(
        ridesDatePurge.trim() ? "ride deletion by date" : "full ride deletion",
        target.toString(),
        { method: "DELETE" },
      );

      if (result.canceled) {
        return;
      }

      const { response, payload } = result;
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
      const result = await requestAdminDelete(
        "today ride deletion",
        "/api/admin/rides/purge-today",
        { method: "DELETE" },
      );

      if (result.canceled) {
        return;
      }

      const { response, payload } = result;
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to purge today's rides.");
      }

      setRidesPurgeMessage(
        `Deleted ${payload?.deletedCount ?? 0} ride(s) for today (${payload?.date ?? "unknown"}).`,
      );
    } catch (error) {
      setRidesPurgeMessage(
        error instanceof Error
          ? error.message
          : "Unable to purge today's rides.",
      );
    } finally {
      setRidesPurgeTodayLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <AdminCard padding={20}>
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
                color: "var(--color-primary)",
              }}
            >
              Export match data
            </h2>
            <p style={{ margin: "6px 0 0", color: "var(--color-muted)", fontSize: 14 }}>
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
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)" }}>
              Date (optional)
            </span>
            <input
              value={matchDate}
              onChange={(event) => setMatchDate(event.target.value)}
              type="date"
              style={{
                border: "1px solid var(--color-border)",
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
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)" }}>
              Matrix API calculator
            </span>
            <select
              value={matrixProvider}
              onChange={(event) => setMatrixProvider(event.target.value)}
              style={{
                border: "1px solid var(--color-border)",
                borderRadius: 10,
                padding: "10px 12px",
                fontSize: 14,
                background: "var(--color-panel)",
              }}
            >
              <option value="osrm">OSRM</option>
              <option value="openrouteservice">OpenRouteService</option>
              <option value="valhalla">Valhalla</option>
              <option value="graphhopper">GraphHopper</option>
              <option value="traveltime">TravelTime</option>
            </select>
          </label>
          {matrixProvider === "valhalla" ? (
            <>
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  minWidth: 160,
                }}
              >
                <span
                  style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)" }}
                >
                  Valhalla costing
                </span>
                <select
                  value={valhallaCosting}
                  onChange={(event) => setValhallaCosting(event.target.value)}
                  style={{
                    border: "1px solid var(--color-border)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    fontSize: 14,
                    background: "var(--color-panel)",
                  }}
                >
                  <option value="auto">Auto</option>
                  <option value="taxi">Taxi</option>
                  <option value="bus">Bus</option>
                </select>
              </label>
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  minWidth: 160,
                }}
              >
                <span
                  style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)" }}
                >
                  Traffic time
                </span>
                <select
                  value={valhallaDateTimeType}
                  onChange={(event) =>
                    setValhallaDateTimeType(event.target.value)
                  }
                  style={{
                    border: "1px solid var(--color-border)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    fontSize: 14,
                    background: "var(--color-panel)",
                  }}
                >
                  <option value="current">Current time</option>
                  <option value="depart_at">Depart at</option>
                  <option value="arrive_by">Arrive by</option>
                </select>
              </label>
              {valhallaDateTimeType !== "current" ? (
                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    minWidth: 220,
                  }}
                >
                  <span
                    style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)" }}
                  >
                    Traffic date and time
                  </span>
                  <input
                    value={valhallaDateTime}
                    onChange={(event) =>
                      setValhallaDateTime(event.target.value)
                    }
                    type="datetime-local"
                    required
                    style={{
                      border: "1px solid var(--color-border)",
                      borderRadius: 10,
                      padding: "10px 12px",
                      fontSize: 14,
                    }}
                  />
                </label>
              ) : null}
            </>
          ) : null}
          {matrixProvider === "traveltime" ? (
            <>
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  minWidth: 180,
                }}
              >
                <span
                  style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)" }}
                >
                  Transportation type
                </span>
                <select
                  value={travelTimeTransportation}
                  onChange={(event) =>
                    setTravelTimeTransportation(event.target.value)
                  }
                  style={{
                    border: "1px solid var(--color-border)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    fontSize: 14,
                    background: "var(--color-panel)",
                  }}
                >
                  <option value="driving">Driving</option>
                  <option value="walking">Walking</option>
                  <option value="cycling">Cycling</option>
                </select>
              </label>
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  minWidth: 220,
                }}
              >
                <span
                  style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)" }}
                >
                  Departure time
                </span>
                <input
                  value={travelTimeDepartureTime}
                  onChange={(event) =>
                    setTravelTimeDepartureTime(event.target.value)
                  }
                  type="datetime-local"
                  required
                  style={{
                    border: "1px solid var(--color-border)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    fontSize: 14,
                  }}
                />
              </label>
            </>
          ) : null}
          <button
            type="submit"
            disabled={loadingMatchData}
            style={{
              border: "none",
              borderRadius: 10,
              background: loadingMatchData ? "var(--color-disabled)" : "var(--color-secondary)",
              color: "var(--color-on-primary)",
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
                ? "var(--color-secondary-deep)"
                : "var(--color-danger)",
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
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)" }}>
              From date
            </span>
            <input
              value={shiftFromDate}
              onChange={(event) => setShiftFromDate(event.target.value)}
              type="date"
              style={{
                border: "1px solid var(--color-border)",
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
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)" }}>
              To date
            </span>
            <input
              value={shiftToDate}
              onChange={(event) => setShiftToDate(event.target.value)}
              type="date"
              style={{
                border: "1px solid var(--color-border)",
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
              background: loadingShiftDates ? "var(--color-disabled)" : "var(--color-primary)",
              color: "var(--color-on-primary)",
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
                ? "var(--color-secondary-deep)"
                : "var(--color-danger)",
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
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)" }}>
              Import workbook
            </span>
            <input
              type="file"
              accept=".xlsx,.xlsm,.xls"
              onChange={(event) =>
                setSelectedFile(event.target.files?.[0] ?? null)
              }
              style={{
                border: "1px solid var(--color-border)",
                borderRadius: 10,
                padding: "10px 12px",
                fontSize: 14,
                background: "var(--color-panel)",
              }}
            />
          </label>
          <button
            type="submit"
            disabled={loadingImport}
            style={{
              border: "none",
              borderRadius: 10,
              background: loadingImport ? "var(--color-disabled)" : "var(--color-primary)",
              color: "var(--color-on-primary)",
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
              color: importMessage.includes("success") ? "var(--color-secondary-deep)" : "var(--color-danger)",
            }}
          >
            {importMessage}
          </p>
        ) : null}
      </AdminCard>

      <AdminCard padding={20}>
        <div style={{ marginBottom: 12 }}>
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              color: "var(--color-primary)",
            }}
          >
            Rides cleanup
          </h2>
          <p style={{ margin: "6px 0 0", color: "var(--color-muted)", fontSize: 14 }}>
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
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)" }}>
              Date (optional)
            </span>
            <input
              value={ridesDatePurge}
              onChange={(event) => setRidesDatePurge(event.target.value)}
              type="date"
              style={{
                border: "1px solid var(--color-border)",
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
              background: ridesPurgeLoading ? "var(--color-disabled)" : "var(--color-danger)",
              color: "var(--color-on-primary)",
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
              background: ridesPurgeTodayLoading ? "var(--color-disabled)" : "var(--color-muted)",
              color: "var(--color-on-primary)",
              fontWeight: 700,
              padding: "10px 16px",
              cursor: ridesPurgeTodayLoading ? "wait" : "pointer",
            }}
          >
            {ridesPurgeTodayLoading
              ? "Deleting today rides..."
              : "Delete today's rides"}
          </button>
        </form>

        {ridesPurgeMessage ? (
          <p
            style={{
              margin: "12px 0 0",
              fontSize: 14,
              color: ridesPurgeMessage.includes("Deleted")
                ? "var(--color-secondary-deep)"
                : "var(--color-danger)",
            }}
          >
            {ridesPurgeMessage}
          </p>
        ) : null}
      </AdminCard>

      <AdminCard padding={20}>
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
                color: "var(--color-primary)",
              }}
            >
              Availabilities
            </h2>
            <p style={{ margin: "6px 0 0", color: "var(--color-muted)", fontSize: 14 }}>
              Inspect current records, download a JSON backup, or restore a
              saved availability snapshot.
            </p>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <button
            type="button"
            onClick={handleDownloadAvailabilityBackup}
            disabled={availabilityBackupLoading}
            style={{
              border: "none",
              borderRadius: 10,
              background: availabilityBackupLoading ? "var(--color-disabled)" : "var(--color-secondary)",
              color: "var(--color-on-primary)",
              fontWeight: 700,
              padding: "10px 16px",
              cursor: availabilityBackupLoading ? "wait" : "pointer",
            }}
          >
            {availabilityBackupLoading
              ? "Preparing backup..."
              : "Download JSON backup"}
          </button>
        </div>

        <form
          onSubmit={handleRestoreAvailability}
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
              minWidth: 260,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)" }}>
              Restore JSON backup
            </span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={(event) =>
                setAvailabilityImportFile(event.target.files?.[0] ?? null)
              }
              style={{
                border: "1px solid var(--color-border)",
                borderRadius: 10,
                padding: "10px 12px",
                fontSize: 14,
                background: "var(--color-panel)",
              }}
            />
          </label>
          <button
            type="submit"
            disabled={availabilityRestoreLoading}
            style={{
              border: "none",
              borderRadius: 10,
              background: availabilityRestoreLoading ? "var(--color-disabled)" : "var(--color-primary)",
              color: "var(--color-on-primary)",
              fontWeight: 700,
              padding: "10px 16px",
              cursor: availabilityRestoreLoading ? "wait" : "pointer",
              alignSelf: "flex-end",
            }}
          >
            {availabilityRestoreLoading ? "Restoring..." : "Restore from file"}
          </button>
        </form>

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
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)" }}>
              Date (optional)
            </span>
            <input
              value={availabilityDate}
              onChange={(event) => setAvailabilityDate(event.target.value)}
              type="date"
              style={{
                border: "1px solid var(--color-border)",
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
              background: "var(--color-primary)",
              color: "var(--color-on-primary)",
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
          <p style={{ margin: 0, color: "var(--color-danger)", fontSize: 14 }}>
            {availabilityError}
          </p>
        ) : null}

        {availabilityActionMessage ? (
          <p
            style={{
              margin: "0 0 10px",
              fontSize: 14,
              color:
                availabilityActionMessage.includes("success") ||
                availabilityActionMessage.includes("Restored")
                  ? "var(--color-secondary-deep)"
                  : "var(--color-danger)",
            }}
          >
            {availabilityActionMessage}
          </p>
        ) : null}

        {availabilitySummary ? (
          <div
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 12,
              padding: 12,
            }}
          >
            <p style={{ margin: "0 0 8px", color: "var(--color-primary)", fontWeight: 700 }}>
              Found {availabilitySummary.totalCount ?? 0} record(s)
            </p>
            {availabilitySummary.records?.length ? (
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  color: "var(--color-muted)",
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
              <p style={{ margin: 0, color: "var(--color-muted)", fontSize: 13 }}>
                No records available for this filter.
              </p>
            )}
          </div>
        ) : null}
      </AdminCard>

      <AdminCard padding={20}>
        <div style={{ marginBottom: 12 }}>
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              color: "var(--color-primary)",
            }}
          >
            Stations operations
          </h2>
          <p style={{ margin: "6px 0 0", color: "var(--color-muted)", fontSize: 14 }}>
            Use station APIs to list/search, create, update, delete, and bulk
            import station points.
          </p>
        </div>

        <form
          onSubmit={handleGenerateStationsMatrix}
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: 16,
            paddingBottom: 16,
            borderBottom: "1px solid #E6EAEC",
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
              Matrix API calculator
            </span>
            <select
              value={stationsMatrixProvider}
              onChange={(event) =>
                setStationsMatrixProvider(event.target.value)
              }
              style={{
                border: "1px solid #D8E0E4",
                borderRadius: 10,
                padding: "10px 12px",
                fontSize: 14,
                background: "#ffffff",
              }}
            >
              <option value="osrm">OSRM</option>
              <option value="openrouteservice">OpenRouteService</option>
              <option value="valhalla">Valhalla</option>
              <option value="graphhopper">GraphHopper</option>
              <option value="traveltime">TravelTime</option>
            </select>
          </label>
          {stationsMatrixProvider === "valhalla" ? (
            <>
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  minWidth: 160,
                }}
              >
                <span
                  style={{ fontSize: 13, fontWeight: 600, color: "#0B1E3D" }}
                >
                  Valhalla costing
                </span>
                <select
                  value={stationsValhallaCosting}
                  onChange={(event) =>
                    setStationsValhallaCosting(event.target.value)
                  }
                  style={{
                    border: "1px solid #D8E0E4",
                    borderRadius: 10,
                    padding: "10px 12px",
                    fontSize: 14,
                    background: "#ffffff",
                  }}
                >
                  <option value="auto">Auto</option>
                  <option value="taxi">Taxi</option>
                  <option value="bus">Bus</option>
                </select>
              </label>
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  minWidth: 160,
                }}
              >
                <span
                  style={{ fontSize: 13, fontWeight: 600, color: "#0B1E3D" }}
                >
                  Traffic time
                </span>
                <select
                  value={stationsValhallaDateTimeType}
                  onChange={(event) =>
                    setStationsValhallaDateTimeType(event.target.value)
                  }
                  style={{
                    border: "1px solid #D8E0E4",
                    borderRadius: 10,
                    padding: "10px 12px",
                    fontSize: 14,
                    background: "#ffffff",
                  }}
                >
                  <option value="current">Current time</option>
                  <option value="depart_at">Depart at</option>
                  <option value="arrive_by">Arrive by</option>
                </select>
              </label>
              {stationsValhallaDateTimeType !== "current" ? (
                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    minWidth: 220,
                  }}
                >
                  <span
                    style={{ fontSize: 13, fontWeight: 600, color: "#0B1E3D" }}
                  >
                    Traffic date and time
                  </span>
                  <input
                    value={stationsValhallaDateTime}
                    onChange={(event) =>
                      setStationsValhallaDateTime(event.target.value)
                    }
                    type="datetime-local"
                    required
                    style={{
                      border: "1px solid #D8E0E4",
                      borderRadius: 10,
                      padding: "10px 12px",
                      fontSize: 14,
                    }}
                  />
                </label>
              ) : null}
            </>
          ) : null}
          {stationsMatrixProvider === "traveltime" ? (
            <>
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  minWidth: 180,
                }}
              >
                <span
                  style={{ fontSize: 13, fontWeight: 600, color: "#0B1E3D" }}
                >
                  Transportation type
                </span>
                <select
                  value={stationsTravelTimeTransportation}
                  onChange={(event) =>
                    setStationsTravelTimeTransportation(event.target.value)
                  }
                  style={{
                    border: "1px solid #D8E0E4",
                    borderRadius: 10,
                    padding: "10px 12px",
                    fontSize: 14,
                    background: "#ffffff",
                  }}
                >
                  <option value="driving">Driving</option>
                  <option value="walking">Walking</option>
                  <option value="cycling">Cycling</option>
                </select>
              </label>
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  minWidth: 220,
                }}
              >
                <span
                  style={{ fontSize: 13, fontWeight: 600, color: "#0B1E3D" }}
                >
                  Departure time
                </span>
                <input
                  value={stationsTravelTimeDepartureTime}
                  onChange={(event) =>
                    setStationsTravelTimeDepartureTime(event.target.value)
                  }
                  type="datetime-local"
                  required
                  style={{
                    border: "1px solid #D8E0E4",
                    borderRadius: 10,
                    padding: "10px 12px",
                    fontSize: 14,
                  }}
                />
              </label>
            </>
          ) : null}
          <button
            type="submit"
            disabled={stationsMatrixLoading}
            style={{
              border: "none",
              borderRadius: 10,
              background: stationsMatrixLoading ? "#7BD7CB" : "#00C2A8",
              color: "#ffffff",
              fontWeight: 700,
              padding: "10px 16px",
              cursor: stationsMatrixLoading ? "wait" : "pointer",
              alignSelf: "flex-end",
            }}
          >
            {stationsMatrixLoading ? "Generating matrix..." : "Generate Matrix"}
          </button>
          {stationsMatrixMessage ? (
            <p
              style={{
                flexBasis: "100%",
                margin: 0,
                fontSize: 14,
                color: stationsMatrixMessage.includes("success")
                  ? "#00877A"
                  : "#B94A48",
              }}
            >
              {stationsMatrixMessage}
            </p>
          ) : null}
        </form>

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
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)" }}>
              Station number (optional)
            </span>
            <input
              value={stationNumberQuery}
              onChange={(event) => setStationNumberQuery(event.target.value)}
              placeholder="e.g. 101"
              style={{
                border: "1px solid var(--color-border)",
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
              background: stationsLoading ? "var(--color-disabled)" : "var(--color-secondary)",
              color: "var(--color-on-primary)",
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
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 14,
            }}
          />
          <input
            value={stationFormDirection}
            onChange={(event) => setStationFormDirection(event.target.value)}
            placeholder="Direction"
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 14,
            }}
          />
          <input
            value={stationFormType}
            onChange={(event) => setStationFormType(event.target.value)}
            placeholder="Station type"
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 14,
            }}
          />
          <input
            value={stationFormLandmark}
            onChange={(event) => setStationFormLandmark(event.target.value)}
            placeholder="Landmark"
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 14,
            }}
          />
          <input
            value={stationFormLat}
            onChange={(event) => setStationFormLat(event.target.value)}
            placeholder="Latitude"
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 14,
            }}
          />
          <input
            value={stationFormLng}
            onChange={(event) => setStationFormLng(event.target.value)}
            placeholder="Longitude"
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 14,
            }}
          />
          <button
            type="submit"
            disabled={stationsCreateLoading}
            style={{
              border: "none",
              borderRadius: 10,
              background: stationsCreateLoading ? "var(--color-disabled)" : "var(--color-primary)",
              color: "var(--color-on-primary)",
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
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 14,
            }}
          />
          <button
            type="submit"
            disabled={stationsPatchLoading}
            style={{
              border: "none",
              borderRadius: 10,
              background: stationsPatchLoading ? "var(--color-muted)" : "var(--color-muted)",
              color: "var(--color-on-primary)",
              fontWeight: 700,
              padding: "10px 16px",
              cursor: stationsPatchLoading ? "wait" : "pointer",
            }}
          >
            {stationsPatchLoading
              ? "Updating..."
              : "Update station (use fields above)"}
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
              border: "1px solid var(--color-border)",
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
              background: stationsDeleteLoading ? "var(--color-disabled)" : "var(--color-danger)",
              color: "var(--color-on-primary)",
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
            onChange={(event) =>
              setStationsFile(event.target.files?.[0] ?? null)
            }
            style={{
              border: "1px solid var(--color-border)",
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
              background: stationsImportLoading ? "var(--color-disabled)" : "var(--color-secondary)",
              color: "var(--color-on-primary)",
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
                stationsMessage.includes("success") ||
                stationsMessage.includes("Loaded")
                  ? "var(--color-secondary-deep)"
                  : "var(--color-danger)",
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
              border: "1px solid var(--color-border)",
              borderRadius: 12,
              background: "var(--color-surface)",
              padding: 12,
            }}
          >
            <p style={{ margin: "0 0 8px", color: "var(--color-primary)", fontWeight: 700 }}>
              Showing {Math.min(stationsData.length, 10)} of{" "}
              {stationsData.length} station(s)
            </p>
            <ul
              style={{
                margin: 0,
                paddingLeft: 18,
                color: "var(--color-muted)",
                display: "grid",
                gap: 6,
              }}
            >
              {stationsData.slice(0, 10).map((station) => (
                <li key={station.id} style={{ fontSize: 13 }}>
                  #{station.id} {station.name || station.direction || "Station"}{" "}
                  ·{` ${station.stationType || "type n/a"}`} ·
                  {` ${station.lat ?? "-"}, ${station.lng ?? "-"}`}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </AdminCard>
    </div>
  );
}
