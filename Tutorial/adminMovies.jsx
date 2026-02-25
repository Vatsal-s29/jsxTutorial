// ============================================================================
// MoviesPage.jsx
// ----------------------------------------------------------------------------
// Admin page for managing movie schedules.
//
// PAGE LAYOUT:
//   - Sticky header with "Add Movie Schedule" button
//   - Two tabs:
//       • Upcoming  → scheduled movies whose date/slot hasn't passed yet
//       • Screened  → scheduled movies whose date/slot has already passed
//
// ADD MOVIE FLOW:
//   1. Admin clicks "Add Movie Schedule"
//   2. Modal opens — fetches all movies from movie-service for the dropdown
//   3. Admin types/selects a movie → full details fetched by movie id
//   4. Admin fills in date, time slot, format
//   5. Conflict check ensures no two movies share the same date + slot
//   6. Admin saves → new schedule appears in the Upcoming tab
//
// API (movie-service on port 4567):
//   GET /movies      → array of all movies (lightweight, for dropdown)
//   GET /movie/:id   → single movie full details (on selection)
//
// COMPONENTS:
//   MoviesPage        → root, owns all schedule state
//   ScheduledTabs     → renders Upcoming / Screened tabs + their content
//   ScheduleList      → renders a grouped + sorted list of schedule cards
//   ScheduleCard      → a single scheduled movie card
//   AddMovieModal     → the form modal for scheduling a new movie
//   Detail            → tiny "Label: Value" display helper
// ============================================================================

import { useState, useEffect, useRef } from "react";

// ── CONSTANTS ─────────────────────────────────────────────────────────────────

// The three allowed time slots per day. One movie per slot per day max.
const TIME_SLOTS = [
    { id: "morning", label: "Morning", time: "10:00 AM" },
    { id: "afternoon", label: "Afternoon", time: "2:00 PM" },
    { id: "evening", label: "Evening", time: "6:00 PM" },
];

// Base URL of the movie-service backend.
const API_BASE = "http://localhost:4567";

// ── API HELPERS ───────────────────────────────────────────────────────────────

/**
 * fetchAllMovies
 * --------------
 * Fetches the full list of available movies from the movie-service.
 * Used to populate the dropdown inside AddMovieModal.
 * Returns an array of lightweight movie objects:
 *   { id, title, year, image: { url }, runningTimeInMinutes, ... }
 */
async function fetchAllMovies() {
    const res = await fetch(`${API_BASE}/movies`);
    if (!res.ok) throw new Error("Failed to fetch movies");
    return res.json();
}

/**
 * fetchMovieById
 * --------------
 * Fetches full details for a single movie by its IMDb-style id (e.g. "tt6702810").
 * Called when the admin selects a movie from the dropdown.
 * Returns a single movie object (same shape as above — extend if your
 * movie-service adds more fields like director, cast, etc. in the future).
 */
async function fetchMovieById(id) {
    const res = await fetch(`${API_BASE}/movie/${id}`);
    if (!res.ok) throw new Error("Failed to fetch movie details");
    return res.json();
}

// ── UTILITY ───────────────────────────────────────────────────────────────────

/**
 * hasConflict
 * -----------
 * Returns true if the given (date + slotId) combination is already taken
 * in the existing schedules array.
 *
 * Rule: only one movie per time slot per day.
 * The same movie CAN be scheduled on different days or different slots freely.
 *
 * @param {Array}  schedules - All saved schedule objects.
 * @param {string} date      - "YYYY-MM-DD" string.
 * @param {string} slotId    - "morning" | "afternoon" | "evening".
 * @returns {boolean}
 */
function hasConflict(schedules, date, slotId) {
    return schedules.some((s) => s.date === date && s.slot === slotId);
}

/**
 * isScreened
 * ----------
 * Determines whether a scheduled movie has already been screened.
 * A schedule is considered screened if its screening start time is in the past.
 *
 * We map each slot id to its start hour, build a Date object for that
 * screening, and compare it against the current time.
 *
 * @param {Object} schedule - A schedule object with `date` and `slot`.
 * @returns {boolean}
 */
function isScreened(schedule) {
    const now = new Date();
    const slotHours = { morning: 10, afternoon: 14, evening: 18 };
    const [year, month, day] = schedule.date.split("-").map(Number);
    // month - 1 because JS Date months are 0-indexed
    const screeningTime = new Date(
        year,
        month - 1,
        day,
        slotHours[schedule.slot],
    );
    return screeningTime < now;
}

// ============================================================================
// ROOT COMPONENT: MoviesPage
// ============================================================================
export default function MoviesPage() {
    // Master list of all scheduled movies (both upcoming and screened).
    // Shape of each schedule object:
    // {
    //   id:     number       (Date.now() assigned on save)
    //   movie:  object       (movie object from movie-service)
    //   date:   string       ("YYYY-MM-DD")
    //   slot:   string       ("morning" | "afternoon" | "evening")
    //   format: string       ("2D" | "3D")
    // }
    const [schedules, setSchedules] = useState([]);

    // Controls whether the Add Movie modal is open.
    const [showForm, setShowForm] = useState(false);

    /**
     * handleSave
     * ----------
     * Receives a new schedule from AddMovieModal and appends it to the list.
     * Assigns a unique id using Date.now() and closes the modal.
     */
    function handleSave(schedule) {
        setSchedules((prev) => [...prev, { ...schedule, id: Date.now() }]);
        setShowForm(false);
    }

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white font-['Sora',sans-serif]">
            {/* Load Google Fonts — Sora for UI, Playfair Display for modal heading */}
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&family=Playfair+Display:ital,wght@0,700;1,700&display=swap');`}</style>

            {/* ── STICKY HEADER ────────────────────────────────────────────────────── */}
            <header className="border-b border-white/10 px-8 py-5 flex items-center justify-between sticky top-0 z-40 bg-[#0a0a0f]/90 backdrop-blur">
                {/* Brand mark */}
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-black font-black text-sm">
                        M
                    </div>
                    <span className="font-bold tracking-widest text-xs uppercase text-white/60">
                        CineAdmin
                    </span>
                </div>

                {/* Opens the Add Movie modal */}
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-black font-bold text-sm px-5 py-2.5 rounded-full transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg shadow-amber-400/20"
                >
                    <span className="text-lg leading-none">+</span> Add Movie
                    Schedule
                </button>
            </header>

            {/* ── MAIN CONTENT ─────────────────────────────────────────────────────── */}
            <main className="px-8 py-8">
                <ScheduledTabs schedules={schedules} />
            </main>

            {/* ── ADD MOVIE MODAL ───────────────────────────────────────────────────
          Only mounted when showForm is true.
          Passes the full schedules array so the modal can check for conflicts. */}
            {showForm && (
                <AddMovieModal
                    schedules={schedules}
                    onSave={handleSave}
                    onClose={() => setShowForm(false)}
                />
            )}
        </div>
    );
}

// ============================================================================
// COMPONENT: ScheduledTabs
// ----------------------------------------------------------------------------
// Renders the Upcoming and Screened tabs.
// Splits the schedules array into two buckets using isScreened(),
// then renders the appropriate list under the active tab.
// ============================================================================
function ScheduledTabs({ schedules }) {
    const [activeTab, setActiveTab] = useState("upcoming");

    // Split into upcoming (not yet screened) and screened (already past).
    const upcoming = schedules.filter((s) => !isScreened(s));
    const screened = schedules.filter((s) => isScreened(s));

    const tabs = [
        { id: "upcoming", label: "Upcoming", data: upcoming },
        { id: "screened", label: "Screened", data: screened },
    ];

    const activeData = tabs.find((t) => t.id === activeTab).data;

    return (
        <div>
            {/* Tab bar */}
            <div className="flex gap-6 border-b border-white/10 mb-8">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all ${
                            activeTab === tab.id
                                ? "border-amber-400 text-amber-400"
                                : "border-transparent text-white/40 hover:text-white/70"
                        }`}
                    >
                        {tab.label}
                        {/* Count badge */}
                        <span
                            className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                                activeTab === tab.id
                                    ? "bg-amber-400/20 text-amber-400"
                                    : "bg-white/10 text-white/40"
                            }`}
                        >
                            {tab.data.length}
                        </span>
                    </button>
                ))}
            </div>

            {/* Render the list for the active tab */}
            <ScheduleList schedules={activeData} type={activeTab} />
        </div>
    );
}

// ============================================================================
// COMPONENT: ScheduleList
// ----------------------------------------------------------------------------
// Renders schedule cards grouped by date.
// Upcoming dates sorted ascending (soonest first).
// Screened dates sorted descending (most recent first).
// Shows an empty state when the list is empty.
// ============================================================================
function ScheduleList({ schedules, type }) {
    if (schedules.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-white/30">
                <div className="text-6xl mb-4">
                    {type === "upcoming" ? "🎬" : "🎞️"}
                </div>
                <p className="text-lg font-semibold">
                    {type === "upcoming"
                        ? "No upcoming movies scheduled"
                        : "No screened movies yet"}
                </p>
                {type === "upcoming" && (
                    <p className="text-sm mt-1">
                        Hit "Add Movie Schedule" to get started
                    </p>
                )}
            </div>
        );
    }

    // Group by date string: { "2025-08-10": [s, s], "2025-08-11": [s] }
    const grouped = schedules.reduce((acc, s) => {
        if (!acc[s.date]) acc[s.date] = [];
        acc[s.date].push(s);
        return acc;
    }, {});

    // Sort dates — upcoming ascending, screened descending
    const sortedDates = Object.keys(grouped).sort((a, b) =>
        type === "upcoming" ? a.localeCompare(b) : b.localeCompare(a),
    );

    return (
        <div className="space-y-8">
            {sortedDates.map((date) => (
                <div key={date}>
                    {/* Date heading — T00:00:00 prevents timezone-shift on date-only strings */}
                    <h2 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-4">
                        {new Date(date + "T00:00:00").toLocaleDateString(
                            "en-US",
                            {
                                weekday: "long",
                                month: "long",
                                day: "numeric",
                            },
                        )}
                    </h2>

                    {/* Cards — sorted by slot order within each day */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {grouped[date]
                            .sort(
                                (a, b) =>
                                    TIME_SLOTS.findIndex(
                                        (t) => t.id === a.slot,
                                    ) -
                                    TIME_SLOTS.findIndex(
                                        (t) => t.id === b.slot,
                                    ),
                            )
                            .map((s) => (
                                <ScheduleCard key={s.id} schedule={s} />
                            ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ============================================================================
// COMPONENT: ScheduleCard
// ----------------------------------------------------------------------------
// A single scheduled movie card showing poster, title, format, year,
// runtime, and the time slot it's scheduled for.
// ============================================================================
function ScheduleCard({ schedule }) {
    const { movie, slot, format } = schedule;
    const slotObj = TIME_SLOTS.find((t) => t.id === slot);

    return (
        <div className="flex gap-4 bg-white/5 hover:bg-white/8 border border-white/10 hover:border-amber-400/30 rounded-2xl p-4 transition-all duration-200">
            {/* Poster — from movie.image.url */}
            {movie.image?.url ? (
                <img
                    src={movie.image.url}
                    alt={movie.title}
                    className="w-16 h-24 object-cover rounded-lg flex-shrink-0"
                    onError={(e) => (e.target.style.display = "none")}
                />
            ) : (
                <div className="w-16 h-24 bg-white/10 rounded-lg flex-shrink-0 flex items-center justify-center text-white/20 text-xs text-center px-1">
                    No Poster
                </div>
            )}

            <div className="flex-1 min-w-0">
                {/* Title + format badge */}
                <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-sm leading-tight line-clamp-2">
                        {movie.title}
                    </h3>
                    <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-400 border border-amber-400/30">
                        {format}
                    </span>
                </div>

                {/* Year */}
                <p className="text-white/40 text-xs mt-1">{movie.year}</p>

                {/* Slot time + runtime */}
                <div className="mt-3 flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-amber-400 font-semibold">
                        🕐 {slotObj?.time}
                    </span>
                    {movie.runningTimeInMinutes && (
                        <>
                            <span className="text-white/30">·</span>
                            <span className="text-white/50">
                                {movie.runningTimeInMinutes} min
                            </span>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// COMPONENT: AddMovieModal
// ----------------------------------------------------------------------------
// Full-screen overlay modal for scheduling a new movie.
//
// On mount    → fetches all movies from GET /movies for the dropdown
// On select   → fetches full details from GET /movie/:id
//
// Form fields:
//   1. Movie selector  — type to filter, or scroll all available movies
//   2. Movie details   — auto-filled after selection
//   3. Date picker     — today or future only
//   4. Time slot       — 3 buttons; already-booked slots are disabled
//   5. Format          — 2D or 3D
//   6. Save button     — enabled only when all fields valid + no conflict
// ============================================================================
function AddMovieModal({ schedules, onSave, onClose }) {
    // All movies from GET /movies — used to populate the dropdown
    const [allMovies, setAllMovies] = useState([]);
    const [moviesLoading, setMoviesLoading] = useState(true);
    const [moviesError, setMoviesError] = useState(null);

    // Search input value
    const [search, setSearch] = useState("");

    // Movie chosen from dropdown (lightweight object from GET /movies)
    const [selectedMovie, setSelectedMovie] = useState(null);

    // Full details from GET /movie/:id
    const [movieDetails, setMovieDetails] = useState(null);
    const [detailsLoading, setDetailsLoading] = useState(false);

    // Dropdown visibility
    const [showDropdown, setShowDropdown] = useState(false);

    // Form fields
    const [date, setDate] = useState("");
    const [slot, setSlot] = useState("");
    const [format, setFormat] = useState("2D");

    // Conflict flag — true when selected date+slot is already booked
    const [conflict, setConflict] = useState(false);

    const inputRef = useRef();

    // ── Fetch all movies on mount ─────────────────────────────────────────────
    useEffect(() => {
        async function loadMovies() {
            try {
                const data = await fetchAllMovies();
                setAllMovies(data);
            } catch {
                setMoviesError("Could not load movies from server.");
            } finally {
                setMoviesLoading(false);
            }
        }
        loadMovies();
    }, []);

    // ── Filter movies as admin types ──────────────────────────────────────────
    // Empty string matches all movies, so the full list shows when input is blank.
    const filteredMovies = allMovies.filter((m) =>
        m.title.toLowerCase().includes(search.toLowerCase()),
    );

    // ── Movie selection ───────────────────────────────────────────────────────
    async function selectMovie(movie) {
        setSelectedMovie(movie); // immediately store the lightweight object
        setSearch(movie.title); // fill the input
        setShowDropdown(false); // close dropdown
        setDetailsLoading(true); // show spinner
        setMovieDetails(null); // clear previous details

        try {
            const details = await fetchMovieById(movie.id);
            setMovieDetails(details);
        } catch {
            // API failed — fall back to the lightweight object we already have
            setMovieDetails(movie);
        } finally {
            setDetailsLoading(false);
        }
    }

    // ── Conflict detection — runs when date or slot changes ───────────────────
    useEffect(() => {
        if (date && slot) {
            setConflict(hasConflict(schedules, date, slot));
        } else {
            setConflict(false);
        }
    }, [date, slot, schedules]);

    // Prefer the full details object; fall back to lightweight if details not yet loaded
    const displayMovie = movieDetails || selectedMovie;

    // Save is only allowed when all four conditions are met
    const canSave = selectedMovie && date && slot && !conflict;

    function handleSave() {
        if (!canSave) return;
        onSave({ movie: displayMovie, date, slot, format });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-[#111118] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                {/* Modal header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
                    <h2 className="font-['Playfair_Display',serif] italic text-xl font-bold">
                        Add Movie Schedule
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-white/40 hover:text-white text-2xl leading-none transition-colors"
                    >
                        ×
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* ── FIELD 1: Movie Selector ──────────────────────────────────────── */}
                    <div className="relative">
                        <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">
                            Movie Name
                        </label>
                        <input
                            ref={inputRef}
                            type="text"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setShowDropdown(true);
                                // Reset selection when input is cleared
                                if (!e.target.value) {
                                    setSelectedMovie(null);
                                    setMovieDetails(null);
                                }
                            }}
                            onFocus={() => setShowDropdown(true)}
                            placeholder="Search or select a movie..."
                            className="w-full bg-white/5 border border-white/10 focus:border-amber-400/60 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none transition-colors"
                        />

                        {/* Dropdown */}
                        {showDropdown && (
                            <div className="absolute z-50 mt-1 w-full bg-[#1a1a24] border border-white/10 rounded-xl overflow-hidden shadow-2xl max-h-56 overflow-y-auto">
                                {/* Loading */}
                                {moviesLoading && (
                                    <div className="px-4 py-3 text-sm text-white/30 flex items-center gap-2">
                                        <div className="w-3 h-3 border-2 border-amber-400/40 border-t-amber-400 rounded-full animate-spin"></div>
                                        Loading movies...
                                    </div>
                                )}

                                {/* Error */}
                                {moviesError && (
                                    <div className="px-4 py-3 text-sm text-red-400">
                                        {moviesError}
                                    </div>
                                )}

                                {/* No results */}
                                {!moviesLoading &&
                                    !moviesError &&
                                    filteredMovies.length === 0 && (
                                        <div className="px-4 py-3 text-sm text-white/30">
                                            No movies found
                                        </div>
                                    )}

                                {/* Movie options */}
                                {/* onMouseDown prevents input onBlur from closing dropdown before click fires */}
                                {!moviesLoading &&
                                    filteredMovies.map((movie) => (
                                        <button
                                            key={movie.id}
                                            onMouseDown={() =>
                                                selectMovie(movie)
                                            }
                                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
                                        >
                                            {movie.image?.url && (
                                                <img
                                                    src={movie.image.url}
                                                    alt=""
                                                    className="w-8 h-10 object-cover rounded flex-shrink-0"
                                                    onError={(e) =>
                                                        (e.target.style.display =
                                                            "none")
                                                    }
                                                />
                                            )}
                                            <div>
                                                <p className="text-sm font-semibold">
                                                    {movie.title}
                                                </p>
                                                <p className="text-xs text-white/40">
                                                    {movie.year}
                                                    {movie.runningTimeInMinutes
                                                        ? ` · ${movie.runningTimeInMinutes} min`
                                                        : ""}
                                                </p>
                                            </div>
                                        </button>
                                    ))}
                            </div>
                        )}
                    </div>

                    {/* ── MOVIE DETAILS CARD ────────────────────────────────────────────── */}
                    {selectedMovie && (
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                            {detailsLoading ? (
                                <div className="flex items-center gap-3 text-white/40 text-sm">
                                    <div className="w-4 h-4 border-2 border-amber-400/40 border-t-amber-400 rounded-full animate-spin"></div>
                                    Fetching movie details...
                                </div>
                            ) : displayMovie ? (
                                <div className="flex gap-4">
                                    {displayMovie.image?.url && (
                                        <img
                                            src={displayMovie.image.url}
                                            alt={displayMovie.title}
                                            className="w-20 h-28 object-cover rounded-lg flex-shrink-0"
                                            onError={(e) =>
                                                (e.target.style.display =
                                                    "none")
                                            }
                                        />
                                    )}
                                    <div className="flex-1 min-w-0 space-y-1">
                                        <h3 className="font-bold text-base">
                                            {displayMovie.title}
                                        </h3>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-2">
                                            <Detail
                                                label="Year"
                                                value={displayMovie.year}
                                            />
                                            <Detail
                                                label="Runtime"
                                                value={
                                                    displayMovie.runningTimeInMinutes
                                                        ? `${displayMovie.runningTimeInMinutes} min`
                                                        : null
                                                }
                                            />
                                            {/* Add more Detail rows here if movie-service exposes more fields */}
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    )}

                    {/* ── FIELD 2: Date Picker ─────────────────────────────────────────── */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">
                            Date
                        </label>
                        <input
                            type="date"
                            value={date}
                            min={new Date().toISOString().split("T")[0]}
                            onChange={(e) => setDate(e.target.value)}
                            className="bg-white/5 border border-white/10 focus:border-amber-400/60 rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-colors w-full"
                        />
                    </div>

                    {/* ── FIELD 3: Time Slot ───────────────────────────────────────────── */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">
                            Time Slot
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            {TIME_SLOTS.map((s) => {
                                // Check if this specific slot is already booked on the selected date
                                const isBooked =
                                    date && hasConflict(schedules, date, s.id);
                                return (
                                    <button
                                        key={s.id}
                                        disabled={isBooked}
                                        onClick={() => setSlot(s.id)}
                                        className={`relative flex flex-col items-center py-3 rounded-xl border text-sm font-semibold transition-all
                      ${
                          isBooked
                              ? "border-white/5 text-white/20 cursor-not-allowed"
                              : slot === s.id
                                ? "border-amber-400 bg-amber-400/10 text-amber-400"
                                : "border-white/10 text-white/60 hover:border-white/30 hover:text-white"
                      }`}
                                    >
                                        <span>{s.label}</span>
                                        <span className="text-xs font-normal mt-0.5 opacity-70">
                                            {s.time}
                                        </span>
                                        {isBooked && (
                                            <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[9px] bg-red-500/80 text-white px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                                Booked
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                        {conflict && (
                            <p className="text-xs text-red-400 mt-2">
                                ⚠ This slot is already booked for the selected
                                date.
                            </p>
                        )}
                    </div>

                    {/* ── FIELD 4: Format ──────────────────────────────────────────────── */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">
                            Format
                        </label>
                        <div className="flex gap-3">
                            {["2D", "3D"].map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setFormat(f)}
                                    className={`px-6 py-2.5 rounded-xl border text-sm font-bold transition-all
                    ${
                        format === f
                            ? "border-amber-400 bg-amber-400/10 text-amber-400"
                            : "border-white/10 text-white/50 hover:border-white/30 hover:text-white"
                    }`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── SAVE BUTTON ──────────────────────────────────────────────────── */}
                    <button
                        onClick={handleSave}
                        disabled={!canSave}
                        className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all
              disabled:opacity-30 disabled:cursor-not-allowed
              enabled:bg-amber-400 enabled:text-black enabled:hover:bg-amber-300 enabled:hover:scale-[1.01] enabled:active:scale-[0.99]"
                    >
                        Save Schedule
                    </button>
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// HELPER COMPONENT: Detail
// ----------------------------------------------------------------------------
// Renders a "Label: Value" row. Returns null if value is falsy so empty
// fields don't render blank rows in the details card.
// `full` prop spans the row across both grid columns.
// ============================================================================
function Detail({ label, value, full }) {
    if (!value) return null;
    return (
        <div className={full ? "col-span-2" : ""}>
            <span className="text-white/30">{label}: </span>
            <span className="text-white/70">{value}</span>
        </div>
    );
}
