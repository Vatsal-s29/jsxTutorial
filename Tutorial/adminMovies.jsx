// ============================================================================
// MoviesPage.jsx
// ----------------------------------------------------------------------------
// This is the main admin page for managing movies and their schedules.
// It is split into several components:
//
//   MoviesPage         → Root component. Owns all schedule state, renders tabs,
//                        header, and the modal.
//   ScheduledSection   → Tab 1: lists upcoming scheduled movies grouped by date.
//   ScheduleCard       → A single card inside ScheduledSection.
//   AllMoviesSection   → Tab 2: browsable grid of every movie in movies.js.
//   MovieCard          → A single poster card inside AllMoviesSection.
//   AddMovieModal      → The full-screen modal form for scheduling a new movie.
//   Detail             → Tiny helper to render a "Label: Value" row.
// ============================================================================

import { useState, useEffect, useRef } from "react";

// Local movie data — an array of movie objects loaded from movies.js.
// This acts as our "database" on the frontend for the search/selector.
import moviesData from "./movies.js";

// ── CONSTANTS ────────────────────────────────────────────────────────────────

// The three allowed screening time slots for each day.
// Each slot has:
//   id    → used as the value stored in schedule objects (string key)
//   label → human-readable name shown in the UI
//   time  → display time shown to the admin
const TIME_SLOTS = [
    { id: "morning", label: "Morning", time: "10:00 AM" },
    { id: "afternoon", label: "Afternoon", time: "2:00 PM" },
    { id: "evening", label: "Evening", time: "6:00 PM" },
];

// Base URL for all API calls. Change this to point at your actual backend.
const API_BASE = "http://localhost:5000/api";

// ── API HELPERS ───────────────────────────────────────────────────────────────

/**
 * fetchMovieByTitle
 * -----------------
 * Calls the backend to retrieve full movie details by title.
 * The title is URI-encoded so spaces and special characters don't break the URL.
 *
 * Endpoint assumed: GET /api/movies/:title
 * Returns: the full movie object (same shape as movies.js entries).
 * Throws: an Error if the server responds with a non-2xx status.
 */
async function fetchMovieByTitle(title) {
    const res = await fetch(`${API_BASE}/movies/${encodeURIComponent(title)}`);
    if (!res.ok) throw new Error("Movie not found");
    return res.json();
}

// ── UTILITY FUNCTIONS ─────────────────────────────────────────────────────────

/**
 * hasConflict
 * -----------
 * Checks whether a given (date + time slot) combination is already booked
 * in the existing schedules array.
 *
 * We use this in two places:
 *   1. In the time slot picker — to disable/mark slots that are already taken.
 *   2. As a final guard before enabling the Save button.
 *
 * The optional `editingId` parameter is for future edit-mode support:
 *   when editing an existing schedule, we skip that schedule's own entry
 *   so it doesn't flag a conflict with itself.
 *
 * @param {Array}  schedules  - All saved schedule objects.
 * @param {string} date       - ISO date string e.g. "2025-08-10".
 * @param {string} slotId     - One of "morning" | "afternoon" | "evening".
 * @param {number} editingId  - ID of the schedule being edited (optional).
 * @returns {boolean}         - true if the slot is already taken.
 */
function hasConflict(schedules, date, slotId, editingId = null) {
    return schedules.some(
        (s) => s.date === date && s.slot === slotId && s.id !== editingId,
    );
}

/**
 * imdbRating
 * ----------
 * Small helper that formats the IMDb rating string.
 * Returns "N/A" if the movie data doesn't have a rating.
 * (Currently used as a utility; can be called anywhere a formatted rating is needed.)
 */
function imdbRating(movie) {
    return movie?.imdbRating ? `${movie.imdbRating}/10` : "N/A";
}

// ============================================================================
// ROOT COMPONENT: MoviesPage
// ----------------------------------------------------------------------------
// This is the top-level component rendered for the /movies admin route.
// It:
//   - Holds the master list of all scheduled movies in state.
//   - Controls whether the "Add Movie" modal is open or closed.
//   - Controls which tab (Scheduled / All Movies) is active.
//   - Passes down handlers so child components can save new schedules.
// ============================================================================
export default function MoviesPage() {
    // `schedules` is the array of all saved movie schedule objects.
    // Each object has the shape:
    //   { id, movie: {...}, date: "YYYY-MM-DD", slot: "morning"|..., format: "2D"|"3D" }
    // In a real app this would be fetched from and saved to the backend.
    const [schedules, setSchedules] = useState([]);

    // Controls whether the "Add Movie Schedule" modal is visible.
    const [showForm, setShowForm] = useState(false);

    // Which tab is currently active: "scheduled" or "all".
    const [activeTab, setActiveTab] = useState("scheduled");

    /**
     * handleSave
     * ----------
     * Called by AddMovieModal when the admin clicks "Save Schedule".
     * Receives the new schedule object (without an id), appends it to the
     * schedules array with a unique id (using Date.now() as a simple id),
     * and closes the modal.
     */
    function handleSave(schedule) {
        setSchedules((prev) => [...prev, { ...schedule, id: Date.now() }]);
        setShowForm(false);
    }

    // Compute today's date in "YYYY-MM-DD" format (ISO, no time component).
    // Used to filter out past schedules — we only show upcoming ones in the
    // Scheduled tab. String comparison works here because ISO dates are
    // lexicographically sortable.
    const today = new Date().toISOString().split("T")[0];
    const upcoming = schedules.filter((s) => s.date >= today);

    return (
        // Full-page dark background with the Sora font loaded via Google Fonts below.
        <div className="min-h-screen bg-[#0a0a0f] text-white font-['Sora',sans-serif]">
            {/* Load Google Fonts — Sora for UI text, Playfair Display for modal heading. */}
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&family=Playfair+Display:ital,wght@0,700;1,700&display=swap');`}</style>

            {/* ── STICKY HEADER ──────────────────────────────────────────────────────
          Stays at the top of the viewport as the user scrolls.
          Contains the brand logo on the left and the "Add Movie Schedule"
          primary action button on the right.
      ─────────────────────────────────────────────────────────────────────── */}
            <header className="border-b border-white/10 px-8 py-5 flex items-center justify-between sticky top-0 z-40 bg-[#0a0a0f]/90 backdrop-blur">
                {/* Brand mark — gradient circle with "M" + app name */}
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-black font-black text-sm">
                        M
                    </div>
                    <span className="font-bold tracking-widest text-xs uppercase text-white/60">
                        CineAdmin
                    </span>
                </div>

                {/* Primary CTA — opens the Add Movie modal */}
                <button
                    onClick={() => setShowForm(true)}
                    className="group flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-black font-bold text-sm px-5 py-2.5 rounded-full transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg shadow-amber-400/20"
                >
                    <span className="text-lg leading-none">+</span> Add Movie
                    Schedule
                </button>
            </header>

            {/* ── TAB BAR ────────────────────────────────────────────────────────────
          Two tabs:
            • "Scheduled" — upcoming scheduled movies (filtered to date >= today)
            • "All Movies" — every movie available in movies.js
          The active tab gets an amber underline + amber text.
          Each tab also shows a count badge.
      ─────────────────────────────────────────────────────────────────────── */}
            <div className="px-8 pt-8 pb-0 flex gap-6 border-b border-white/10">
                {[
                    {
                        id: "scheduled",
                        label: "Scheduled",
                        count: upcoming.length,
                    },
                    {
                        id: "all",
                        label: "All Movies",
                        count: moviesData.length,
                    },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all ${
                            activeTab === tab.id
                                ? "border-amber-400 text-amber-400" // active state
                                : "border-transparent text-white/40 hover:text-white/70" // inactive state
                        }`}
                    >
                        {tab.label}
                        {/* Count badge — highlights with amber when the tab is active */}
                        <span
                            className={`ml-2 text-xs px-2 py-0.5 rounded-full ${activeTab === tab.id ? "bg-amber-400/20 text-amber-400" : "bg-white/10 text-white/40"}`}
                        >
                            {tab.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* ── MAIN CONTENT AREA ──────────────────────────────────────────────────
          Conditionally renders the correct section based on the active tab.
      ─────────────────────────────────────────────────────────────────────── */}
            <main className="px-8 py-8">
                {/* Tab 1: Scheduled upcoming movies */}
                {activeTab === "scheduled" && (
                    <ScheduledSection schedules={upcoming} />
                )}
                {/* Tab 2: All available movies from local data */}
                {activeTab === "all" && (
                    <AllMoviesSection movies={moviesData} />
                )}
            </main>

            {/* ── ADD MOVIE MODAL ─────────────────────────────────────────────────────
          Only rendered when showForm is true (admin clicked the header button).
          We pass:
            schedules → so the modal can check for slot conflicts
            onSave    → callback to append the new schedule to our state
            onClose   → callback to hide the modal
      ─────────────────────────────────────────────────────────────────────── */}
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
// COMPONENT: ScheduledSection
// ----------------------------------------------------------------------------
// Renders the "Scheduled" tab content.
// Shows all upcoming schedules grouped by date, each date sorted
// by time slot (morning → afternoon → evening).
// Shows a friendly empty state when no movies are scheduled yet.
// ============================================================================
function ScheduledSection({ schedules }) {
    // Empty state — shown when the admin hasn't scheduled any movies yet.
    if (schedules.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-white/30">
                <div className="text-6xl mb-4">🎬</div>
                <p className="text-lg font-semibold">No movies scheduled yet</p>
                <p className="text-sm mt-1">
                    Hit "Add Movie Schedule" to get started
                </p>
            </div>
        );
    }

    // Group all schedules by their date string ("YYYY-MM-DD").
    // Result: { "2025-08-10": [schedule, schedule], "2025-08-11": [...], ... }
    // Using reduce to build the object — for each schedule, if the date key
    // doesn't exist yet in the accumulator, create it as an empty array,
    // then push the current schedule into it.
    const grouped = schedules.reduce((acc, s) => {
        if (!acc[s.date]) acc[s.date] = [];
        acc[s.date].push(s);
        return acc;
    }, {});

    return (
        <div className="space-y-8">
            {/* Convert the grouped object to [date, schedulesArray] pairs,
          sort them chronologically (ISO strings sort correctly as strings),
          then render a section for each date. */}
            {Object.entries(grouped)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, daySchedules]) => (
                    <div key={date}>
                        {/* Date heading — formatted as e.g. "Saturday, August 10" */}
                        {/* We append T00:00:00 to avoid timezone-shift issues that
                can occur when parsing date-only ISO strings. */}
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

                        {/* Cards grid — responsive: 1 col on mobile, 2 on md, 3 on xl */}
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {/* Sort this day's schedules by slot order (morning first) using
                  the index of each slot in the TIME_SLOTS constant array. */}
                            {daySchedules
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
// Renders a single scheduled movie as a compact card.
// Shows: poster thumbnail, title, format badge (2D/3D), genre,
//        time slot, runtime, IMDb rating, content rating, and director.
// ============================================================================
function ScheduleCard({ schedule }) {
    // Look up the full slot object (label + display time) from TIME_SLOTS
    // using the slot id stored in the schedule.
    const slot = TIME_SLOTS.find((t) => t.id === schedule.slot);

    return (
        <div className="group relative flex gap-4 bg-white/5 hover:bg-white/8 border border-white/10 hover:border-amber-400/30 rounded-2xl p-4 transition-all duration-200 overflow-hidden">
            {/* Movie poster — falls back to a placeholder if Poster is "N/A" */}
            <img
                src={
                    schedule.movie.Poster !== "N/A"
                        ? schedule.movie.Poster
                        : "https://via.placeholder.com/80x120/1a1a2e/ffffff?text=No+Poster"
                }
                alt={schedule.movie.Title}
                className="w-16 h-24 object-cover rounded-lg flex-shrink-0"
            />

            {/* Text content — flex-1 so it fills remaining space; min-w-0 prevents
          overflow from long titles */}
            <div className="flex-1 min-w-0">
                {/* Title row with the 2D/3D format badge on the right */}
                <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-sm leading-tight line-clamp-2">
                        {schedule.movie.Title}
                    </h3>
                    <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-400 border border-amber-400/30">
                        {schedule.format}
                    </span>
                </div>

                {/* Genre — dimmed, small */}
                <p className="text-white/40 text-xs mt-1">
                    {schedule.movie.Genre}
                </p>

                {/* Meta row: time slot · runtime · IMDb rating */}
                <div className="mt-3 flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-amber-400 font-semibold">
                        <span>🕐</span> {slot?.time}
                    </span>
                    <span className="text-white/30">·</span>
                    <span className="text-white/50">
                        {schedule.movie.Runtime}
                    </span>
                    <span className="text-white/30">·</span>
                    <span className="text-white/50">
                        ⭐ {schedule.movie.imdbRating}
                    </span>
                </div>

                {/* Content rating + director — very dim, smallest text */}
                <p className="text-[10px] text-white/30 mt-1">
                    {schedule.movie.Rated} · {schedule.movie.Director}
                </p>
            </div>
        </div>
    );
}

// ============================================================================
// COMPONENT: AllMoviesSection
// ----------------------------------------------------------------------------
// Renders the "All Movies" tab content.
// Shows every movie from movies.js as a poster grid, with a live
// search bar to filter by title.
// ============================================================================
function AllMoviesSection({ movies }) {
    // Local state for the search input — only used within this tab.
    const [search, setSearch] = useState("");

    // Filter the movies array in real time as the admin types.
    // Case-insensitive match against the Title field.
    const filtered = movies.filter((m) =>
        m.Title.toLowerCase().includes(search.toLowerCase()),
    );

    return (
        <div>
            {/* Search bar — filters the poster grid below in real time */}
            <div className="mb-6">
                <input
                    type="text"
                    placeholder="Search movies..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-amber-400/50 w-full max-w-sm"
                />
            </div>

            {/* Responsive poster grid: 2 cols → 3 → 4 → 5 as screen widens */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                {filtered.map((movie) => (
                    <MovieCard key={movie.imdbID} movie={movie} />
                ))}
            </div>
        </div>
    );
}

// ============================================================================
// COMPONENT: MovieCard
// ----------------------------------------------------------------------------
// A single movie poster card in the All Movies grid.
// Shows: poster image, IMDb rating badge (top-right overlay),
//        content rating badge (top-left overlay), title, year, runtime, genre.
// The poster subtly zooms on hover via a CSS group-hover transform.
// ============================================================================
function MovieCard({ movie }) {
    return (
        <div className="group bg-white/5 hover:bg-white/8 border border-white/10 hover:border-white/20 rounded-2xl overflow-hidden transition-all duration-200">
            {/* Poster wrapper — relative so the badge overlays can be positioned */}
            <div className="relative overflow-hidden">
                <img
                    src={
                        movie.Poster !== "N/A"
                            ? movie.Poster
                            : "https://via.placeholder.com/200x300/1a1a2e/ffffff?text=No+Poster"
                    }
                    alt={movie.Title}
                    // aspect-[2/3] forces a standard movie poster ratio (2:3)
                    // group-hover:scale-105 zooms the image when hovering the card
                    className="w-full aspect-[2/3] object-cover group-hover:scale-105 transition-transform duration-300"
                />

                {/* IMDb rating badge — top-right corner overlay */}
                <div className="absolute top-2 right-2 bg-black/70 text-amber-400 text-xs font-bold px-2 py-0.5 rounded-full">
                    ⭐ {movie.imdbRating}
                </div>

                {/* Content rating badge (PG-13, R, etc.) — top-left corner overlay */}
                <div className="absolute top-2 left-2 bg-black/70 text-white/80 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {movie.Rated}
                </div>
            </div>

            {/* Card text content below the poster */}
            <div className="p-3">
                {/* Title — clamp to 2 lines to keep all cards the same height */}
                <h3 className="font-bold text-xs leading-tight line-clamp-2">
                    {movie.Title}
                </h3>
                <p className="text-white/40 text-[10px] mt-1">
                    {movie.Year} · {movie.Runtime}
                </p>
                {/* Show only the first genre tag to keep it concise */}
                <p className="text-white/30 text-[10px] mt-0.5 line-clamp-1">
                    {movie.Genre}
                </p>
            </div>
        </div>
    );
}

// ============================================================================
// COMPONENT: AddMovieModal
// ----------------------------------------------------------------------------
// Full-screen overlay modal for scheduling a new movie.
//
// Form fields:
//   1. Movie selector — text input with a live-filtering dropdown.
//      Selecting a movie triggers an API call to fetch full details.
//      Falls back to local movies.js data if the API is unavailable.
//   2. Movie details preview card — shows poster + metadata once fetched.
//   3. Date picker — restricted to today and future dates only.
//   4. Time slot picker — 3 buttons (Morning / Afternoon / Evening).
//      Slots already booked on the selected date are disabled + marked "Booked".
//   5. Format toggle — 2D or 3D.
//   6. Save button — disabled until all fields are filled and no conflict exists.
//
// Props:
//   schedules → existing schedules, needed for conflict detection
//   onSave    → called with the new schedule object when Save is clicked
//   onClose   → called when the × button or backdrop is clicked
// ============================================================================
function AddMovieModal({ schedules, onSave, onClose }) {
    // What the admin has typed in the movie search input.
    const [search, setSearch] = useState("");

    // The movie object chosen from the dropdown (from local movies.js data).
    // This is set immediately on selection, before the API responds.
    const [selectedMovie, setSelectedMovie] = useState(null);

    // The movie object returned by the API (may have richer / more up-to-date data).
    // We prefer this over selectedMovie when both are available.
    const [apiMovie, setApiMovie] = useState(null);

    // True while the API fetch is in progress — shows a loading spinner.
    const [apiLoading, setApiLoading] = useState(false);

    // Non-null if the API fetch failed — shows a warning under the details card.
    const [apiError, setApiError] = useState(null);

    // Controls whether the suggestions dropdown is visible.
    const [showDropdown, setShowDropdown] = useState(false);

    // The selected date in "YYYY-MM-DD" format (driven by the date input).
    const [date, setDate] = useState("");

    // The selected time slot id: "morning" | "afternoon" | "evening".
    const [slot, setSlot] = useState("");

    // The selected format: "2D" | "3D". Defaults to 2D.
    const [format, setFormat] = useState("2D");

    // True when the currently selected date+slot combination is already booked.
    const [conflict, setConflict] = useState(false);

    // Ref to the search input — could be used to programmatically focus it.
    const inputRef = useRef();

    // ── Filtered movie list for the dropdown ──────────────────────────────────
    // Re-computed every render based on the current search string.
    // Shows all movies when search is empty (empty string matches everything).
    const filteredMovies = moviesData.filter((m) =>
        m.Title.toLowerCase().includes(search.toLowerCase()),
    );

    // ── Movie selection handler ───────────────────────────────────────────────
    /**
     * selectMovie
     * -----------
     * Called when the admin clicks a movie in the dropdown.
     * 1. Immediately updates the search input text and closes the dropdown.
     * 2. Resets any previous API result / error.
     * 3. Fires an API call to fetch full details.
     *    If the API fails, falls back to the local movie object and shows a warning.
     */
    async function selectMovie(movie) {
        setSelectedMovie(movie); // store the local movie immediately
        setSearch(movie.Title); // fill the input with the movie name
        setShowDropdown(false); // close the dropdown
        setApiError(null); // clear any previous error
        setApiLoading(true); // show loading spinner in the details card

        try {
            const data = await fetchMovieByTitle(movie.Title);
            setApiMovie(data); // store the richer API response
        } catch {
            // API failed — use local data as fallback so the form still works
            setApiMovie(movie);
            setApiError("Using local data (API unavailable)");
        } finally {
            setApiLoading(false); // hide spinner regardless of success or failure
        }
    }

    // ── Conflict detection effect ─────────────────────────────────────────────
    // Runs every time `date` or `slot` changes.
    // Re-checks whether the chosen (date + slot) pair is already booked.
    useEffect(() => {
        if (date && slot) {
            setConflict(hasConflict(schedules, date, slot));
        } else {
            setConflict(false); // can't conflict if date or slot isn't chosen yet
        }
    }, [date, slot, schedules]);

    // ── Which movie object to display ─────────────────────────────────────────
    // Prefer the API-fetched movie (apiMovie) over the local one (selectedMovie)
    // since the API may have more complete or up-to-date information.
    const displayMovie = apiMovie || selectedMovie;

    // ── Save guard ────────────────────────────────────────────────────────────
    // The Save button is only enabled when ALL of these are true:
    //   • A movie has been selected
    //   • A date has been picked
    //   • A time slot has been picked
    //   • No conflict exists for that date + slot
    const canSave = selectedMovie && date && slot && !conflict;

    /**
     * handleSave
     * ----------
     * Builds the schedule object and passes it up to MoviesPage via the onSave prop.
     * The id is NOT set here — MoviesPage assigns it using Date.now().
     */
    function handleSave() {
        if (!canSave) return;
        onSave({ movie: displayMovie, date, slot, format });
    }

    return (
        // ── Modal backdrop ───────────────────────────────────────────────────────
        // Fixed full-screen overlay with a blurred dark background.
        // Clicking the backdrop does NOT close the modal here — only the × does.
        // (You could add an onClick={onClose} to this div if you want backdrop-close.)
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            {/* ── Modal panel ───────────────────────────────────────────────────────
          max-w-2xl keeps it from getting too wide on large screens.
          max-h-[90vh] + overflow-y-auto makes it scrollable on short screens. */}
            <div className="bg-[#111118] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                {/* Modal header: title on the left, close (×) button on the right */}
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

                {/* ── Form body ─────────────────────────────────────────────────────── */}
                <div className="p-6 space-y-6">
                    {/* ── FIELD 1: Movie Selector ──────────────────────────────────────────
              A text input that:
                - Filters the moviesData array as the admin types
                - Shows a dropdown of matching movies
                - Shows ALL movies when the input is empty (or on focus)
                - Clears selectedMovie + apiMovie if the input is cleared
          ──────────────────────────────────────────────────────────────────── */}
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
                                setShowDropdown(true); // show dropdown whenever typing

                                // If the admin clears the input, also clear the selected movie
                                // so the details card and Save button reset.
                                if (!e.target.value) {
                                    setSelectedMovie(null);
                                    setApiMovie(null);
                                }
                            }}
                            onFocus={() => setShowDropdown(true)} // show all options on focus
                            placeholder="Search or select a movie..."
                            className="w-full bg-white/5 border border-white/10 focus:border-amber-400/60 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none transition-colors"
                        />

                        {/* Dropdown — absolutely positioned below the input */}
                        {showDropdown && (
                            <div className="absolute z-50 mt-1 w-full bg-[#1a1a24] border border-white/10 rounded-xl overflow-hidden shadow-2xl max-h-56 overflow-y-auto">
                                {filteredMovies.length === 0 ? (
                                    // No matches found
                                    <div className="px-4 py-3 text-sm text-white/30">
                                        No movies found
                                    </div>
                                ) : (
                                    filteredMovies.map((movie) => (
                                        // NOTE: We use onMouseDown instead of onClick here.
                                        // This is important: if we used onClick, the input's onBlur
                                        // (which would hide the dropdown) fires BEFORE the click,
                                        // causing the dropdown to close before the selection registers.
                                        // onMouseDown fires before onBlur, so the selection goes through.
                                        <button
                                            key={movie.imdbID}
                                            onMouseDown={() =>
                                                selectMovie(movie)
                                            }
                                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
                                        >
                                            {/* Thumbnail poster in the dropdown row */}
                                            <img
                                                src={
                                                    movie.Poster !== "N/A"
                                                        ? movie.Poster
                                                        : ""
                                                }
                                                alt=""
                                                className="w-8 h-10 object-cover rounded"
                                                // Hide the img element entirely if the poster URL fails
                                                onError={(e) =>
                                                    (e.target.style.display =
                                                        "none")
                                                }
                                            />
                                            <div>
                                                <p className="text-sm font-semibold">
                                                    {movie.Title}
                                                </p>
                                                {/* Show year and only the first genre to keep it compact */}
                                                <p className="text-xs text-white/40">
                                                    {movie.Year} ·{" "}
                                                    {movie.Genre?.split(",")[0]}
                                                </p>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── MOVIE DETAILS PREVIEW CARD ────────────────────────────────────────
              Only shown once a movie has been selected.
              Three states:
                1. Loading  → spinner + "Fetching movie details..."
                2. Loaded   → poster + metadata grid
                3. Error    → same as Loaded but with a yellow warning message
          ──────────────────────────────────────────────────────────────────── */}
                    {selectedMovie && (
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                            {apiLoading ? (
                                // State 1: API call is in progress
                                <div className="flex items-center gap-3 text-white/40 text-sm">
                                    <div className="w-4 h-4 border-2 border-amber-400/40 border-t-amber-400 rounded-full animate-spin"></div>
                                    Fetching movie details...
                                </div>
                            ) : displayMovie ? (
                                // State 2 & 3: Movie data is available (from API or fallback)
                                <div className="flex gap-4">
                                    {/* Poster — hidden via onError if URL is broken */}
                                    <img
                                        src={
                                            displayMovie.Poster !== "N/A"
                                                ? displayMovie.Poster
                                                : ""
                                        }
                                        alt={displayMovie.Title}
                                        className="w-20 h-28 object-cover rounded-lg flex-shrink-0"
                                        onError={(e) =>
                                            (e.target.style.display = "none")
                                        }
                                    />

                                    {/* Metadata area */}
                                    <div className="flex-1 min-w-0 space-y-1">
                                        {/* Title + content rating badge */}
                                        <div className="flex items-start gap-2 flex-wrap">
                                            <h3 className="font-bold text-base">
                                                {displayMovie.Title}
                                            </h3>
                                            <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-400/20 text-amber-400 rounded-full border border-amber-400/30">
                                                {displayMovie.Rated}
                                            </span>
                                        </div>

                                        {/* Genre */}
                                        <p className="text-white/40 text-xs">
                                            {displayMovie.Genre}
                                        </p>

                                        {/* 2-column details grid using the Detail helper component */}
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-2">
                                            <Detail
                                                label="Director"
                                                value={displayMovie.Director}
                                            />
                                            <Detail
                                                label="Runtime"
                                                value={displayMovie.Runtime}
                                            />
                                            <Detail
                                                label="IMDb"
                                                value={`⭐ ${displayMovie.imdbRating}/10`}
                                            />
                                            <Detail
                                                label="Released"
                                                value={displayMovie.Released}
                                            />
                                            {/* Cast spans both columns because it can be long */}
                                            <Detail
                                                label="Cast"
                                                value={displayMovie.Actors}
                                                full
                                            />
                                        </div>

                                        {/* API fallback warning — shown only when API call failed */}
                                        {apiError && (
                                            <p className="text-xs text-amber-400/60 mt-1">
                                                {apiError}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    )}

                    {/* ── FIELD 2: Date Picker ───────────────────────────────────────────────
              Native HTML date input.
              `min` is set to today's date so past dates cannot be selected.
              Stored as "YYYY-MM-DD" string (native input value format).
          ──────────────────────────────────────────────────────────────────── */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">
                            Date
                        </label>
                        <input
                            type="date"
                            value={date}
                            min={new Date().toISOString().split("T")[0]} // today, no past dates
                            onChange={(e) => setDate(e.target.value)}
                            className="bg-white/5 border border-white/10 focus:border-amber-400/60 rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-colors w-full"
                        />
                    </div>

                    {/* ── FIELD 3: Time Slot Picker ─────────────────────────────────────────
              Three toggle buttons (Morning / Afternoon / Evening).
              For each slot, we check if that (date + slot) combination is already
              booked. If so:
                • The button is disabled (can't select it)
                • A "Booked" label appears above it
                • The button is visually dimmed
              If not booked:
                • Clicking it selects it (amber highlight)
          ──────────────────────────────────────────────────────────────────── */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">
                            Time Slot
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            {TIME_SLOTS.map((s) => {
                                // Check conflict for THIS specific slot (not the currently selected one).
                                // We only check when a date is selected — no point checking without a date.
                                const isConflicting =
                                    date && hasConflict(schedules, date, s.id);

                                return (
                                    <button
                                        key={s.id}
                                        disabled={isConflicting}
                                        onClick={() => setSlot(s.id)}
                                        className={`relative flex flex-col items-center py-3 rounded-xl border text-sm font-semibold transition-all
                      ${
                          isConflicting
                              ? "border-white/5 text-white/20 cursor-not-allowed bg-white/2" // booked
                              : slot === s.id
                                ? "border-amber-400 bg-amber-400/10 text-amber-400" // selected
                                : "border-white/10 text-white/60 hover:border-white/30 hover:text-white" // available
                      }`}
                                    >
                                        <span>{s.label}</span>
                                        <span className="text-xs font-normal mt-0.5 opacity-70">
                                            {s.time}
                                        </span>

                                        {/* "Booked" pill — absolutely positioned above the button */}
                                        {isConflicting && (
                                            <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[9px] bg-red-500/80 text-white px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                                Booked
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Warning message shown when the currently selected slot has a conflict.
                This can appear if the admin selects a slot then changes the date
                to one where that slot is already taken. */}
                        {conflict && (
                            <p className="text-xs text-red-400 mt-2">
                                ⚠ This slot is already booked for the selected
                                date.
                            </p>
                        )}
                    </div>

                    {/* ── FIELD 4: Format Toggle (2D / 3D) ─────────────────────────────────
              Simple two-option toggle. Active format gets amber highlight.
              Defaults to 2D on mount (set in useState above).
          ──────────────────────────────────────────────────────────────────── */}
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
                            ? "border-amber-400 bg-amber-400/10 text-amber-400" // selected
                            : "border-white/10 text-white/50 hover:border-white/30 hover:text-white" // unselected
                    }`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── SAVE BUTTON ───────────────────────────────────────────────────────
              Disabled (greyed out) until ALL of these are true:
                • Movie selected
                • Date selected
                • Slot selected
                • No conflict
              When enabled: amber background, slight scale on hover/active.
          ──────────────────────────────────────────────────────────────────── */}
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
                {/* end form body */}
            </div>
            {/* end modal panel */}
        </div> /* end backdrop */
    );
}

// ============================================================================
// HELPER COMPONENT: Detail
// ----------------------------------------------------------------------------
// Renders a single "Label: Value" row in the movie details card.
// Props:
//   label → string shown in dim white (e.g. "Director")
//   value → string shown in brighter white (e.g. "Christopher Nolan")
//   full  → boolean; if true, the row spans both columns of the grid
// ============================================================================
function Detail({ label, value, full }) {
    return (
        <div className={full ? "col-span-2" : ""}>
            <span className="text-white/30">{label}: </span>
            <span className="text-white/70">{value || "N/A"}</span>
        </div>
    );
}
