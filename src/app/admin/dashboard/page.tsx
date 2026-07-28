import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { Trip } from "@/models/Trip";
import { Ride } from "@/models/Ride";
import { Availability } from "@/models/Availability";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import MatchRideForm from "@/components/admin/MatchRideForm";
import { ShieldCheck, Users, Route, CalendarClock, ArrowUpRight, Car } from "lucide-react";

export default async function AdminDashboardPage() {
  const session = await getSession();
  if (!session) redirect("/admin/signup");
  if (session.role !== "admin") redirect("/admin/signup");

  await connectDB();
  const [userCount, tripCount, rideCount, availabilityCount] = await Promise.all([
    User.countDocuments(),
    Trip.countDocuments(),
    Ride.countDocuments(),
    Availability.countDocuments(),
  ]);

  const cards = [
    { title: "Users", value: userCount, icon: Users, accent: "#00C2A8", accentDeep: "#00877A", href: "/admin/users" },
    { title: "Rides", value: rideCount, icon: Car, accent: "#00877A", accentDeep: "#00877A", href: "/admin/rides" },
    { title: "Trips", value: tripCount, icon: Route, accent: "#0B1E3D", accentDeep: "#0B1E3D", href: "/admin/trips" },
    { title: "Availability", value: availabilityCount, icon: CalendarClock, accent: "#E8A33D", accentDeep: "#B4790C", href: "/admin/availability" },
  ];

  const [availabilities, drivers, trips] = await Promise.all([
    Availability.find({ status: { $in: ["open", "matched"] } })
      .select("_id date startTime endTime")
      .sort({ date: 1, startTime: 1 })
      .lean(),
    User.find({ role: "driver" })
      .select("_id name phone email")
      .sort({ name: 1 })
      .lean(),
    Trip.find({ status: { $in: ["submitted", "pending_payment", "matched"] }, paymentStatus: "paid" })
      .select("_id tripNumber date pickupTime arrivalTime pickup dropoff vehicleType rideType priceEgp numberOfPassengers userId")
      .sort({ date: 1, pickupTime: 1 })
      .lean(),
  ]);

  const tools = [
    { label: "Manage rides", href: "/admin/rides" },
    { label: "Manage trips", href: "/admin/trips" },
    { label: "Manage users", href: "/admin/users" },
    { label: "Manage availability", href: "/admin/availability" },
  ];

  const now = new Date();
  const stamp = now.toLocaleString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <main className="admin-board">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600&display=swap');

        .admin-board {
          --ink: #0B1E3D;
          --teal: #00C2A8;
          --teal-deep: #00877A;
          --amber: #E8A33D;
          --amber-deep: #B4790C;
          --slate: #5A6A7A;
          --line: #E6EAEC;
          --canvas: #F6F8F7;
          font-family: 'Inter', system-ui, sans-serif;
          min-height: 100dvh;
          background:
            radial-gradient(1200px 480px at 100% -10%, rgba(0,194,168,0.07), transparent 60%),
            var(--canvas);
          padding: 32px 20px 80px;
        }
        .admin-board * { box-sizing: border-box; }
        .admin-board .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
        .admin-board .display { font-family: 'Space Grotesk', system-ui, sans-serif; }
        .admin-board a:focus-visible,
        .admin-board button:focus-visible {
          outline: 2px solid var(--teal-deep);
          outline-offset: 2px;
          border-radius: 6px;
        }

        /* Route-dash rule: a dispatch-board motif -- a dashed line evokes the
           routes this platform matches, used once as the page's signature. */
        .route-rule {
          height: 1px;
          margin: 22px 0 26px;
          background-image: repeating-linear-gradient(
            to right,
            var(--teal) 0 10px,
            transparent 10px 18px
          );
          opacity: 0.55;
        }

        .live-pill {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--teal-deep);
          background: rgba(0,194,168,0.09);
          border: 1px solid rgba(0,194,168,0.25);
          padding: 5px 10px 5px 8px;
          border-radius: 999px;
        }
        .live-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--teal);
          box-shadow: 0 0 0 0 rgba(0,194,168,0.5);
          animation: pulse 2.4s ease-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .live-dot { animation: none; }
        }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(0,194,168,0.45); }
          70% { box-shadow: 0 0 0 7px rgba(0,194,168,0); }
          100% { box-shadow: 0 0 0 0 rgba(0,194,168,0); }
        }

        .stat-card {
          position: relative;
          background: #ffffff;
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: 22px 24px;
          box-shadow: 0 10px 35px rgba(11,30,61,0.05);
          overflow: hidden;
          text-decoration: none;
          display: block;
          transition: transform 0.14s ease, box-shadow 0.14s ease;
        }
        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 40px rgba(11,30,61,0.09);
        }
        @media (prefers-reduced-motion: reduce) {
          .stat-card, .stat-card .go { transition: none; }
          .stat-card:hover { transform: none; }
        }
        .stat-card .rail {
          position: absolute; top: 0; left: 0; right: 0; height: 3px;
        }
        .stat-card .go {
          position: absolute; top: 20px; right: 20px;
          color: var(--line);
          transition: color 0.14s ease, transform 0.14s ease;
        }
        .stat-card:hover .go { color: var(--teal-deep); transform: translate(2px, -2px); }
        .stat-card .foot {
          margin: 14px 0 0;
          font-size: 12.5px;
          color: var(--slate);
        }

        .tool-link {
          text-decoration: none;
          color: var(--ink);
          font-weight: 600;
          font-size: 14px;
          padding: 11px 16px;
          border-radius: 10px;
          background: var(--canvas);
          border: 1px solid var(--line);
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: border-color 0.12s ease, background 0.12s ease;
        }
        .tool-link:hover { border-color: var(--teal); background: rgba(0,194,168,0.06); }

        .top-link {
          text-decoration: none;
          padding: 11px 18px;
          border-radius: 10px;
          color: #ffffff;
          font-weight: 600;
          font-size: 14px;
          background: var(--ink);
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: opacity 0.12s ease;
        }
        .top-link:hover { opacity: 0.85; }
      `}</style>

      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
              <p className="mono" style={{ margin: 0, fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#00877A" }}>
                Admin · Overview
              </p>
              <span className="live-pill"><span className="live-dot" />Live</span>
            </div>
            <h1 className="display" style={{ margin: 0, fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 700, color: "#0B1E3D" }}>
              Dashboard
            </h1>
            <p className="mono" style={{ margin: "6px 0 0", fontSize: 12.5, color: "#5A6A7A" }}>{stamp}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <a href="/admin/users" className="top-link">
              View users <ArrowUpRight size={15} />
            </a>
            <AdminLogoutButton />
          </div>
        </div>

        <div className="route-rule" aria-hidden="true" />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18 }}>
          {cards.map(({ title, value, icon: Icon, accent, accentDeep, href }) => (
            <a key={title} href={href} className="stat-card">
              <span className="rail" style={{ background: accent }} />
              <ArrowUpRight size={16} className="go" />
              <div style={{ width: 46, height: 46, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: `${accent}1F`, marginBottom: 18 }}>
                <Icon size={22} style={{ color: accentDeep }} />
              </div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#5A6A7A", textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</p>
              <h2 className="mono" style={{ margin: "8px 0 0", fontSize: 32, fontWeight: 600, color: "#0B1E3D" }}>{value}</h2>
              <p className="foot">Tap to manage {title.toLowerCase()}</p>
            </a>
          ))}
        </div>

        <div style={{ background: "#ffffff", border: "1px solid #E6EAEC", borderRadius: 18, boxShadow: "0 10px 35px rgba(11,30,61,0.05)", padding: 24, marginTop: 20, borderTop: "3px solid #00C2A8" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <ShieldCheck size={20} style={{ color: "#00877A" }} />
            <h2 className="display" style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0B1E3D" }}>Admin tools</h2>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {tools.map((tool) => (
              <a key={tool.href} href={tool.href} className="tool-link">
                {tool.label}
              </a>
            ))}
          </div>
        </div>

        <MatchRideForm
          initialDate={new Date().toISOString().slice(0, 10)}
          availabilities={availabilities.map((item) => ({
            _id: String(item._id),
            date: item.date,
            startTime: item.startTime,
            endTime: item.endTime,
          }))}
          drivers={drivers.map((driver) => ({
            _id: String(driver._id),
            name: driver.name,
            phone: driver.phone,
            email: driver.email,
          }))}
          trips={trips.map((trip) => ({
            _id: String(trip._id),
            tripNumber: trip.tripNumber,
            date: trip.date,
            pickupTime: trip.pickupTime,
            arrivalTime: trip.arrivalTime,
            pickup: trip.pickup,
            dropoff: trip.dropoff,
            vehicleType: trip.vehicleType,
            rideType: trip.rideType,
            priceEgp: trip.priceEgp,
            numberOfPassengers: trip.numberOfPassengers,
            userId: String(trip.userId),
          }))}
        />
      </div>
    </main>
  );
}