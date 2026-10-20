"use client";
import { useState, useEffect } from "react";
import ReportTripModal from "@/components/trips/ReportTripModal";

export default function TripReportButton({
  tripId,
  locale = "en",
}: {
  tripId: string;
  locale?: "en" | "ar";
}) {
  const [hasReport, setHasReport] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkReport = async () => {
      try {
        const res = await fetch(`/api/trips/${tripId}/report`);
        const data = await res.json();
        setHasReport(data.hasReport);
      } catch {
        setHasReport(false);
      } finally {
        setLoading(false);
      }
    };

    checkReport();
  }, [tripId]);

  if (loading) return null;

  return <ReportTripModal tripId={tripId} locale={locale} hasExistingReport={hasReport} />;
}
