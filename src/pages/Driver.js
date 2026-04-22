import { Link } from 'react-router-dom';

function Driver() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-16">
        <p className="mb-4 inline-flex rounded-full border border-sky-400/40 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-300">
          Driver
        </p>
        <h1 className="text-4xl font-black tracking-tight sm:text-6xl">Driver</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
          This page can hold the driver-facing tracking experience.
        </p>

        <Link
          to="/"
          className="mt-10 inline-flex w-fit rounded-xl bg-sky-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-sky-400"
        >
          Back to home
        </Link>
      </main>
    </div>
  );
}

export default Driver;