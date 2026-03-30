/**
 * Fun, randomized text for the UI — changes on every refresh.
 * Each array is picked from randomly at module load time.
 */

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Chat Header ──────────────────────────────────────────
export const CHAT_TITLES = [
  "Analytical Chat",
  "Data Whisperer",
  "Query Headquarters",
  "The Insight Factory",
  "Chart & Chill",
  "SQL & Vibes",
  "Number Cruncher 3000",
  "Data Talk Show",
  "The Pivot Table",
  "Ask Me Anything (about data)",
  "Spreadsheet Therapy",
  "The Data Bar",
];

// ── Empty State Headings ─────────────────────────────────
export const EMPTY_HEADINGS = [
  "What do you want to explore?",
  "Ready to crunch some numbers?",
  "Your data has secrets. Let's find them.",
  "What's hiding in your spreadsheet?",
  "Let's turn rows into revelations.",
  "Drop some data and let's party.",
  "Ask me anything. I won't judge your CSVs.",
  "Data goes in, insights come out.",
  "What story does your data tell?",
  "I eat datasets for breakfast.",
  "Time to make your spreadsheets useful.",
  "Let's give your data the attention it deserves.",
];

// ── Empty State Subtext ──────────────────────────────────
export const EMPTY_SUBTEXTS = [
  "Upload a dataset, then ask anything — charts, summaries, SQL, Python.",
  "Drag in a CSV and start asking questions. Charts included, no extra charge.",
  "Feed me a spreadsheet and I'll feed you insights. Fair trade.",
  "Upload data, ask questions, get charts. It's like magic but with SQL.",
  "Drop a file, ask a question, get a chart. Rinse and repeat.",
  "Your CSV is safe with me. I only judge the data, not the formatting.",
  "I speak fluent CSV, Excel, and Parquet. Upload and let's chat.",
  "Think of me as your data therapist. The first session is free.",
];

// ── Input Placeholder ────────────────────────────────────
export const INPUT_PLACEHOLDERS = [
  "Ask about your data...",
  "What do the numbers say?",
  "Type a question, any question...",
  "Show me the insights...",
  "Query me like one of your French databases...",
  "What shall we investigate?",
  "Drop a question here...",
  "Speak, and the data shall answer...",
  "What's on your data mind?",
  "Hit me with a question...",
  "SQL me softly...",
  "Chart me up, Scotty...",
];

// ── Input Helper Text ────────────────────────────────────
export const INPUT_HELPERS = [
  "Enter to send, Shift+Enter for new line",
  "Press Enter to unleash the analysis",
  "Enter = go, Shift+Enter = breathe",
  "Smash Enter to send, hold Shift for a new line",
  "Enter to fire, Shift+Enter to reload",
];

// ── Suggestion Pills ─────────────────────────────────────
export const SUGGESTION_SETS = [
  [
    { icon: "functions", text: "Show basic statistics of GDP growth" },
    { icon: "show_chart", text: "Plot a line chart of inflation over time" },
    { icon: "table_chart", text: "Show first 10 rows as a table" },
    { icon: "account_tree", text: "Draw a mermaid diagram of GDP → Inflation → Fed Rate" },
  ],
  [
    { icon: "functions", text: "What's the mean and std of inflation rate?" },
    { icon: "bar_chart", text: "Create a bar chart of avg GDP growth by year" },
    { icon: "table_chart", text: "Show the latest 5 quarters in a table" },
    { icon: "account_tree", text: "Mermaid flowchart: Fed raises rate → inflation drops → GDP slows" },
  ],
  [
    { icon: "analytics", text: "Quick stats on unemployment rate" },
    { icon: "trending_up", text: "Plot GDP growth trend over time" },
    { icon: "data_table", text: "Table of quarters where inflation > 5%" },
    { icon: "account_tree", text: "Diagram the causal chain: Money Supply → Inflation → Interest Rates" },
  ],
  [
    { icon: "functions", text: "Describe the fed funds rate distribution" },
    { icon: "show_chart", text: "Chart comparing GDP growth vs inflation" },
    { icon: "table_chart", text: "Top 10 quarters by GDP growth" },
    { icon: "account_tree", text: "Mermaid diagram of macro relationships" },
  ],
];

// ── App Title / Branding ─────────────────────────────────
export const APP_TITLES = [
  "Jay's Analyst",
  "Jay's Data Butler",
  "Jay's Insight Engine",
  "Jay's Number Whisperer",
  "Jay's Chart Factory",
  "Jay's Query Lab",
];

// ── Taglines ─────────────────────────────────────────────
export const TAGLINES = [
  "Powered by LangGraph",
  "Fueled by curiosity & SQL",
  "Making spreadsheets jealous",
  "Where data meets destiny",
  "Crunching numbers since today",
  "Your friendly data nerd",
  "Charts on demand",
];

// ── File Upload ──────────────────────────────────────────
export const UPLOAD_TEXTS = [
  "Drop CSV, Excel, Parquet",
  "Drag your data here",
  "Feed me your spreadsheets",
  "Drop files like it's hot",
  "Toss your data this way",
  "CSV? Excel? Parquet? Yes please.",
];

export const UPLOAD_SUBTEXTS = [
  "or click to browse",
  "or click to pick a file",
  "or tap to select",
  "or browse your files",
  "or go old-school and click",
];

export const UPLOADING_TEXTS = [
  "Uploading...",
  "Crunching bytes...",
  "Ingesting your data...",
  "Om nom nom...",
  "Feeding the database...",
  "Loading the goods...",
];

// ── New Chat Button ──────────────────────────────────────
export const NEW_CHAT_LABELS = [
  "New",
  "Fresh start",
  "Reset",
  "Clean slate",
  "New chat",
];

// ── Empty States ─────────────────────────────────────────
export const PROGRESS_EMPTY = [
  "Agent steps will appear here",
  "Waiting for the magic to happen...",
  "The progress bar is on standby",
  "Nothing cooking yet...",
  "Steps? What steps? We haven't started!",
  "Your agent is stretching before the run",
];

export const ARTIFACTS_EMPTY = [
  "Artifacts will appear here",
  "Charts and tables live here once created",
  "The gallery awaits its first masterpiece",
  "No artifacts yet. Ask something cool!",
  "This space reserved for beautiful data art",
  "Empty canvas. Let's paint with data!",
];

export const WORKSPACE_EMPTY = [
  "The agent will build a dashboard here as it works",
  "Dashboard components will materialize here",
  "Your live dashboard is waiting to be born",
  "The workspace is ready. The data is not.",
  "This is where dashboards come to life",
  "Reserved for KPI cards and data magic",
];

export const TRACE_EMPTY = [
  "Trace events will appear here",
  "Event log is empty. Ask something!",
  "The trace timeline awaits action",
  "Debug log: nothing to debug yet",
  "No events recorded. Boredom detected.",
  "Trace: *cricket sounds*",
];

export const NO_DATASETS = [
  "No datasets yet",
  "Upload something!",
  "Feed me data!",
  "The database is lonely",
  "No tables. Very sad.",
  "Empty. Upload a CSV to get started!",
];

// ── Pre-picked values (stable for the session) ──────────
export const funText = {
  chatTitle: pick(CHAT_TITLES),
  emptyHeading: pick(EMPTY_HEADINGS),
  emptySubtext: pick(EMPTY_SUBTEXTS),
  inputPlaceholder: pick(INPUT_PLACEHOLDERS),
  inputHelper: pick(INPUT_HELPERS),
  suggestions: pick(SUGGESTION_SETS),
  appTitle: pick(APP_TITLES),
  tagline: pick(TAGLINES),
  uploadText: pick(UPLOAD_TEXTS),
  uploadSubtext: pick(UPLOAD_SUBTEXTS),
  uploadingText: pick(UPLOADING_TEXTS),
  newChatLabel: pick(NEW_CHAT_LABELS),
  progressEmpty: pick(PROGRESS_EMPTY),
  artifactsEmpty: pick(ARTIFACTS_EMPTY),
  workspaceEmpty: pick(WORKSPACE_EMPTY),
  traceEmpty: pick(TRACE_EMPTY),
  noDatasets: pick(NO_DATASETS),
};
