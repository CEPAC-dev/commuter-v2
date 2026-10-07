export default function TripDetailLoading() {
  return (
    <main className="trip-loading" aria-busy="true" aria-label="Loading trip">
      <span className="trip-loading-sr">Loading trip</span>
      <div className="trip-loading-heading" />
      <div className="trip-loading-grid">
        <div className="trip-loading-main">
          <div className="trip-loading-map" />
          <div className="trip-loading-route"><i /><i /><i /><i /></div>
        </div>
        <div className="trip-loading-summary"><i /><i /><i /><i /><i /></div>
      </div>
      <style>{`
        .trip-loading { width: min(100% - 32px, 1200px); margin: 28px auto; }
        .trip-loading-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }
        .trip-loading i, .trip-loading-heading, .trip-loading-map { display: block; background: #E6EDEA; border-radius: 6px; animation: trip-pulse 1.2s ease-in-out infinite alternate; }
        .trip-loading-heading { width: min(320px, 75%); height: 50px; margin-bottom: 20px; }
        .trip-loading-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 18px; }
        .trip-loading-main { display: grid; gap: 14px; }
        .trip-loading-map { height: clamp(220px, 42vw, 380px); }
        .trip-loading-route { display: grid; gap: 8px; padding: 16px; border: 1px solid #DCE6E4; border-radius: 8px; background: #fff; }
        .trip-loading-route i { height: 18px; }
        .trip-loading-summary { display: grid; align-content: start; gap: 12px; padding: 16px; border: 1px solid #DCE6E4; border-radius: 8px; background: #fff; }
        .trip-loading-summary i { height: 18px; }
        @media (min-width: 900px) { .trip-loading-grid { grid-template-columns: minmax(0, 1fr) 340px; } }
        @keyframes trip-pulse { from { opacity: .45; } to { opacity: .9; } }
        @media (prefers-reduced-motion: reduce) { .trip-loading i, .trip-loading-heading, .trip-loading-map { animation: none; } }
      `}</style>
    </main>
  );
}