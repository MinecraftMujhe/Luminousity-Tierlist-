"use strict";

// ─── TIER METADATA ───────────────────────────────────────────────────────
const TIER_META = {
  HG:  { label:"High God",    tier:"high", desc:"The absolute elite. Near-unbeatable in any scenario." },
  G:   { label:"God",         tier:"high", desc:"Exceptional mechanics and near-perfect consistency." },
  HT5: { label:"High Tier 5", tier:"high", desc:"Dominant at the highest competitive level." },
  T5:  { label:"Tier 5",      tier:"high", desc:"Strong fundamentals with deep game sense." },
  HT4: { label:"High Tier 4", tier:"high", desc:"Above-average player with solid tactical play." },
  T4:  { label:"Tier 4",      tier:"mid",  desc:"Decent mechanics and room to grow further." },
  HT3: { label:"High Tier 3", tier:"mid",  desc:"Developing competitive awareness and consistency." },
  T3:  { label:"Tier 3",      tier:"mid",  desc:"Entry-level ranked. The competitive journey begins." },
  HT2: { label:"High Tier 2", tier:"mid",  desc:"Showing promise, pushing toward T3." },
  T2:  { label:"Tier 2",      tier:"low",  desc:"Learning the fundamentals. Keep grinding." },
  HT1: { label:"High Tier 1", tier:"low",  desc:"Early signs of mechanical understanding." },
  T1:  { label:"Tier 1",      tier:"low",  desc:"The starting point. Everyone starts somewhere." },
  LT3: { label:"Low Tier 3",  tier:"low",  desc:"Building consistency across game modes." },
  LT2: { label:"Low Tier 2",  tier:"low",  desc:"Basic mechanics starting to establish." },
  LT1: { label:"Low Tier 1",  tier:"low",  desc:"Just beginning competitive play." },
};

const T_ICONS = [
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M16 2l6 6-4 4-6-6"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`,
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>`,
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>`,
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 2v3M14 2v3M8 21h8M12 5c-3.87 0-7 2.69-7 6v6h14v-6c0-3.31-3.13-6-7-6z"/><line x1="5" y1="11" x2="19" y2="11"/></svg>`,
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"/><line x1="7" y1="21" x2="19" y2="9"/></svg>`,
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/><line x1="12" y1="22" x2="12" y2="15.5"/><polyline points="22 8.5 12 15.5 2 8.5"/></svg>`,
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="2" x2="12" y2="16"/><circle cx="12" cy="19" r="3"/><line x1="9" y1="6" x2="12" y2="3"/><line x1="15" y1="6" x2="12" y2="3"/></svg>`,
];

// ─── LIVE PLAYER DATA (loaded from players.json) ──────────────────────────
let PLAYERS = [];

// ─── STATE ───────────────────────────────────────────────────────────────
let currentCat  = "overall";
let currentReg  = "all";
let searchQuery = "";
let showHigh = true, showMid = true, showLow = true;
let lastUpdated = null;

const CAT_TITLES = {
  overall:"Overall", vanilla:"Vanilla", sword:"Sword", pot:"Pot",
  axe:"Axe", uhc:"UHC", smp:"SMP", mace:"Mace",
};

// ─── LOAD players.json FROM SERVER ───────────────────────────────────────
async function loadPlayers() {
  try {
    const res = await fetch('/players.json?t=' + Date.now());
    if (!res.ok) throw new Error('Failed to fetch');
    const data = await res.json();
    // Sort by points descending (highest first)
    PLAYERS = data.sort((a, b) => b.points - a.points);
    lastUpdated = new Date();
    updateLastUpdatedBadge();
    render();
  } catch (err) {
    console.warn('Could not load players.json:', err);
    render();
  }
}

function updateLastUpdatedBadge() {
  const el = document.getElementById('lastUpdated');
  if (!el || !lastUpdated) return;
  const h = lastUpdated.getHours().toString().padStart(2,'0');
  const m = lastUpdated.getMinutes().toString().padStart(2,'0');
  const s = lastUpdated.getSeconds().toString().padStart(2,'0');
  el.textContent = `Updated ${h}:${m}:${s}`;

  // Also update count badges on Home and Discord pages
  const total = PLAYERS.length;
  const hpc = document.getElementById('homePlayerCount');
  if (hpc) hpc.textContent = total;
  const dpc = document.getElementById('discPlayerCount');
  if (dpc) dpc.textContent = total;
}

// ─── BUILD RANK BADGE ──────────────────────────────────────────────────────
function rankBadge(rank) {
  if (rank === 1) return `<div class="rank-badge rb-1"><span class="rb-crown">♛</span>1</div>`;
  if (rank === 2) return `<div class="rank-badge rb-2">2</div>`;
  if (rank === 3) return `<div class="rank-badge rb-3">3</div>`;
  return `<div class="rank-badge rb-n">${rank}</div>`;
}
function rowCls(rank) {
  if (rank === 1) return "row-1";
  if (rank === 2) return "row-2";
  if (rank === 3) return "row-3";
  return "";
}

// ─── BUILD TIER ICON ──────────────────────────────────────────────────────
function tierIcon(tier, idx) {
  const m = TIER_META[tier] || { label: tier, desc: tier };
  return `
    <div class="tier-icon tc-${tier}"
         data-tier="${tier}" data-label="${m.label}" data-desc="${m.desc}">
      <div class="tier-circle">${T_ICONS[idx % T_ICONS.length]}</div>
      <span class="tier-lbl">${tier}</span>
    </div>`;
}

// ─── BUILD PLAYER ROW ─────────────────────────────────────────────────────
function buildRow(p, rank) {
  const tiers = (currentCat === "overall")
    ? (p.tiers || [])
    : Array(8).fill((p.catTiers || {})[currentCat] || "LT3");

  const tiersHtml = tiers.map((t, i) => tierIcon(t, i)).join("");
  const apCmd = `/addpoints ${p.name} ${rank}`;
  const rankCls = p.rankCls || "rc-eli";
  const rankLabel = p.rankLabel || "Player";

  return `
    <div class="player-row ${rowCls(rank)}">
      <div class="rank-cell">${rankBadge(rank)}</div>

      <div class="player-info">
        <div class="mc-avatar">
          <img src="https://mc-heads.net/avatar/${encodeURIComponent(p.name)}/46"
               alt="${p.name}" loading="lazy"
               onerror="this.style.display='none'" />
        </div>
        <div class="player-meta">
          <span class="player-name">${p.name}</span>
          <div class="player-subtitle">
            <span class="rank-gem ${rankCls}" style="background:currentColor;display:inline-block"></span>
            <span class="role-text ${rankCls}">${rankLabel}</span>
            <span class="pts-text">(${p.points} pts)</span>
          </div>
          <div class="player-subtitle" style="margin-top:2px">
            <button class="ap-btn" onclick="copyAP(this,'${p.name}',${rank})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2"/>
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg>
              ${apCmd}
            </button>
          </div>
        </div>
      </div>

      <div class="region-cell">
        <span class="region-badge rg-${p.region || 'AS'}">${p.region || 'AS'}</span>
      </div>

      <div class="tier-cell">${tiersHtml}</div>
    </div>`;
}

// ─── RENDER ──────────────────────────────────────────────────────────────
function render() {
  const list  = document.getElementById("playerList");
  const empty = document.getElementById("emptyState");
  const counter = document.getElementById("playerCount");
  const q = searchQuery.toLowerCase().trim();

  const filtered = PLAYERS.filter(p => {
    if (q && !p.name.toLowerCase().includes(q)) return false;
    if (currentReg !== "all" && p.region !== currentReg) return false;
    const t  = (p.catTiers || {})[currentCat] || "LT3";
    const tc = (TIER_META[t] || {}).tier || "low";
    if (tc === "high" && !showHigh) return false;
    if (tc === "mid"  && !showMid)  return false;
    if (tc === "low"  && !showLow)  return false;
    return true;
  });

  if (counter) counter.textContent = filtered.length + " players";

  if (!filtered.length) {
    list.innerHTML = "";
    empty.classList.remove("hidden");
    empty.classList.add("flex");
    return;
  }
  empty.classList.add("hidden");
  empty.classList.remove("flex");
  list.innerHTML = filtered.map((p, i) => buildRow(p, i + 1)).join("");
  bindTooltips();
}

// ─── TOOLTIP ─────────────────────────────────────────────────────────────
const tooltip = document.getElementById("tooltip");

function bindTooltips() {
  document.querySelectorAll(".tier-icon[data-tier]").forEach(el => {
    el.addEventListener("mouseenter", () => {
      tooltip.innerHTML = `<strong style="font-size:.8rem">${el.dataset.tier} — ${el.dataset.label}</strong><br><span style="color:#475569;font-size:.72rem">${el.dataset.desc}</span>`;
      tooltip.style.opacity = "1";
    });
    el.addEventListener("mousemove", e => {
      tooltip.style.left = Math.min(e.clientX + 14, window.innerWidth  - 215) + "px";
      tooltip.style.top  = Math.min(e.clientY + 14, window.innerHeight - 80)  + "px";
    });
    el.addEventListener("mouseleave", () => { tooltip.style.opacity = "0"; });
  });
}

// ─── COPY /addpoints ─────────────────────────────────────────────────────
window.copyAP = function(btn, name, rank) {
  const cmd = `/addpoints ${name} ${rank}`;
  navigator.clipboard.writeText(cmd).catch(() => {});
  btn.classList.add("copied");
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
  setTimeout(() => {
    btn.classList.remove("copied");
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> /addpoints ${name} ${rank}`;
  }, 1600);
};

// ─── TABS ─────────────────────────────────────────────────────────────────
document.querySelectorAll(".tab-pill").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-pill").forEach(t => t.classList.remove("active"));
    btn.classList.add("active");
    currentCat = btn.dataset.cat;
    document.getElementById("sectionTitle").textContent = CAT_TITLES[currentCat] || "Rankings";
    render();
  });
});

// ─── SIDEBAR CATEGORY ─────────────────────────────────────────────────────
document.querySelectorAll(".sb-item").forEach(item => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".sb-item").forEach(s => s.classList.remove("active"));
    item.classList.add("active");
    const sub = item.dataset.sub;
    if (sub === "all") {
      currentCat = "overall";
      document.querySelectorAll(".tab-pill").forEach(t => t.classList.remove("active"));
      document.querySelector('.tab-pill[data-cat="overall"]').classList.add("active");
    } else {
      currentCat = sub;
      document.querySelectorAll(".tab-pill").forEach(t => t.classList.remove("active"));
      const match = document.querySelector(`.tab-pill[data-cat="${sub}"]`);
      if (match) match.classList.add("active");
    }
    document.getElementById("sectionTitle").textContent = CAT_TITLES[currentCat] || "Rankings";
    render();
  });
});

// ─── REGION FILTER ────────────────────────────────────────────────────────
document.querySelectorAll(".region-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".region-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentReg = btn.dataset.r;
    render();
  });
});

// ─── TIER CHECKBOXES ──────────────────────────────────────────────────────
document.getElementById("chkHigh").addEventListener("change", e => { showHigh = e.target.checked; render(); });
document.getElementById("chkMid" ).addEventListener("change", e => { showMid  = e.target.checked; render(); });
document.getElementById("chkLow" ).addEventListener("change", e => { showLow  = e.target.checked; render(); });

// ─── SEARCH ──────────────────────────────────────────────────────────────
document.getElementById("searchInput").addEventListener("input", e => {
  searchQuery = e.target.value;
  render();
});
document.addEventListener("keydown", e => {
  if (e.key === "/" && document.activeElement.tagName !== "INPUT") {
    e.preventDefault();
    document.getElementById("searchInput").focus();
  }
  if (e.key === "Escape") document.getElementById("searchInput").blur();
});

// ─── PAGE ROUTING ─────────────────────────────────────────────────────────
const PAGES = ["home", "rankings", "discord"];

function showPage(name) {
  if (!PAGES.includes(name)) name = "home";

  PAGES.forEach(p => {
    const el = document.getElementById("page-" + p);
    if (el) el.classList.toggle("hidden", p !== name);
  });

  // Navbar active state
  document.querySelectorAll(".nav-link[data-page]").forEach(link => {
    link.classList.toggle("active", link.dataset.page === name);
  });

  // Show/hide search bar — only useful on Rankings page
  const search = document.getElementById("navSearch");
  if (search) search.style.display = name === "rankings" ? "" : "none";

  // Update URL hash so browser back/forward works
  history.pushState({ page: name }, "", "#" + name);
}

// Wire all nav links and any in-page buttons with data-page
document.addEventListener("click", e => {
  const btn = e.target.closest("[data-page]");
  if (!btn) return;
  const page = btn.dataset.page;
  if (PAGES.includes(page)) {
    e.preventDefault();
    showPage(page);
  }
});

// Handle browser back/forward
window.addEventListener("popstate", e => {
  const page = (e.state && e.state.page) || location.hash.replace("#", "") || "home";
  showPage(page);
});

// ─── AUTO-REFRESH every 30 seconds ───────────────────────────────────────
setInterval(loadPlayers, 30_000);

// ─── INIT ─────────────────────────────────────────────────────────────────
const initialPage = location.hash.replace("#", "") || "home";
showPage(initialPage);
loadPlayers();
