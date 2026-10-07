export default function MyTripsLoading() {
  return (
    <main className="my-trips-loading" aria-busy="true" aria-label="Loading trips">
      <span className="sr-only">Loading trips</span>
      <div className="loading-heading" />
      <div className="loading-hero">
        <div className="loading-copy">
          <i />
          <i />
          <i />
          <i />
        </div>
        <i className="loading-action" />
      </div>
      <div className="loading-tabs"><i /><i /><i /><i /></div>
      <div className="loading-layout">
        <div className="loading-list">
          <i /><i /><i />
        </div>
        <div className="loading-summary"><i /><i /><i /><i /></div>
      </div>
      <style>{`
        .my-trips-loading { width: min(100% - 32px, 1200px); margin: 24px auto; color: transparent; }
        .my-trips-loading i, .loading-heading { display: block; background: #E6EDEA; border-radius: 5px; animation: trips-skeleton 1.2s ease-in-out infinite alternate; }
        .loading-heading { width: 180px; height: 25px; margin-bottom: 18px; }
        .loading-hero { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; min-height: 190px; padding: 16px; border: 1px solid #DCE6E4; border-radius: 8px; background: #fff; }
        .loading-copy { display: grid; align-content: center; gap: 14px; width: min(100%, 480px); }
        .loading-copy i:nth-child(1) { width: 110px; height: 12px; }
        .loading-copy i:nth-child(2) { width: 220px; height: 22px; }
        .loading-copy i:nth-child(3), .loading-copy i:nth-child(4) { width: 92%; height: 13px; }
        .loading-action { width: 100%; height: 44px; }
        .loading-tabs { display: flex; gap: 16px; margin: 20px 0; padding-bottom: 10px; border-bottom: 1px solid #DCE6E4; }
        .loading-tabs i { width: 88px; height: 30px; }
        .loading-layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: 24px; }
        .loading-list { display: grid; gap: 14px; }
        .loading-list i { height: 156px; border: 1px solid #DCE6E4; background: #fff; }
        .loading-summary { display: grid; align-content: start; gap: 12px; min-height: 120px; padding: 16px; border: 1px solid #DCE6E4; border-radius: 8px; background: #fff; }
        .loading-summary i { height: 16px; }
        @media (min-width: 640px) { .loading-hero { grid-template-columns: minmax(0, 1fr) 150px; align-items: center; padding: 20px; } .loading-action { width: 150px; } }
        @media (min-width: 900px) { .loading-layout { grid-template-columns: minmax(0, 1fr) 280px; } }
        @media (min-width: 1024px) { .loading-layout { grid-template-columns: minmax(0, 1fr) 300px; } }
        @keyframes trips-skeleton { from { opacity: .45; } to { opacity: .9; } }
        @media (prefers-reduced-motion: reduce) { .my-trips-loading i, .loading-heading { animation: none; } }
      `}</style>
    </main>
  );
}