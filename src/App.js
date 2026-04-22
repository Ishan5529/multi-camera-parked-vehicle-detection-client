function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
        <p className="mb-3 rounded-full border border-sky-400/40 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-300">
          Tailwind + React App
        </p>
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
          Tailwind CSS is now configured
        </h1>
        <p className="mt-4 max-w-xl text-slate-300">
          Update <code className="rounded bg-slate-800 px-1 py-0.5">src/App.js</code> and start building your UI with utility classes.
        </p>
        <button className="mt-8 rounded-xl bg-sky-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-sky-400">
          Ready to build
        </button>
      </main>
    </div>
  );
}

export default App;
