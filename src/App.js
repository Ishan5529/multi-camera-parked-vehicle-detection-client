import { Link, Route, Routes } from 'react-router-dom';
import Driver from './pages/Driver';
import ParkingSetup from './pages/ParkingSetup';

function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
        <div className="max-w-2xl">
          <p className="mb-4 inline-flex rounded-full border border-sky-400/40 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-300">
            Multi-camera vehicle tracker
          </p>
          <h1 className="text-4xl font-black tracking-tight sm:text-6xl">
            Choose the workflow you want to open.
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-300">
            Start with the driver view or move into parking setup to configure the site.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <Link
            to="/driver"
            className="rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:-translate-y-1 hover:border-sky-400/50 hover:bg-sky-500/10"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-300">Page 1</p>
            <h2 className="mt-3 text-2xl font-bold">Driver</h2>
            <p className="mt-3 text-slate-300">
              Open the driver page for driver-focused flows and tracking views.
            </p>
          </Link>

          <Link
            to="/parking-setup"
            className="rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:-translate-y-1 hover:border-emerald-400/50 hover:bg-emerald-500/10"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Page 2</p>
            <h2 className="mt-3 text-2xl font-bold">Parking Setup</h2>
            <p className="mt-3 text-slate-300">
              Open the parking setup page to configure parking zones and system settings.
            </p>
          </Link>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/driver" element={<Driver />} />
      <Route path="/parking-setup" element={<ParkingSetup />} />
    </Routes>
  );
}

export default App;
