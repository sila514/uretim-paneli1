"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* =========================================================================
 *  YAPILANDIRMA
 *  Backend hazır olunca sadece API_URL'i doldur. Boş bırakılırsa otomatik
 *  olarak mock veriye düşer; böylece backend olmadan da panel çalışır.
 * ========================================================================= */
const API_URL = ""; // örn: "https://api.fabrikam.com/v1/machines"
const POLL_MS = 5000; // kaç ms'de bir yenilensin
const THRESHOLD = 80; // verimlilik uyarı eşiği (%)

/* ---- Mock veri (fallback) ---- */
const MOCK_MACHINES = [
  { id: "M-01", name: "CNC Tezgah A1", line: "Hat 1", efficiency: 94, output: 1280, status: "running" },
  { id: "M-02", name: "Pres 200T", line: "Hat 1", efficiency: 76, output: 940, status: "running" },
  { id: "M-03", name: "Enjeksiyon E3", line: "Hat 2", efficiency: 88, output: 1110, status: "running" },
  { id: "M-04", name: "Kaynak Robotu R2", line: "Hat 2", efficiency: 63, output: 520, status: "warning" },
  { id: "M-05", name: "Montaj Bandı B1", line: "Hat 3", efficiency: 91, output: 1340, status: "running" },
  { id: "M-06", name: "Lazer Kesim L1", line: "Hat 3", efficiency: 82, output: 1015, status: "running" },
  { id: "M-07", name: "Boyahane BZ", line: "Hat 4", efficiency: 48, output: 0, status: "stopped" },
  { id: "M-08", name: "Torna T7", line: "Hat 4", efficiency: 79, output: 870, status: "running" },
  { id: "M-09", name: "Paketleme P2", line: "Hat 5", efficiency: 96, output: 1490, status: "running" },
  { id: "M-10", name: "Freze F4", line: "Hat 5", efficiency: 71, output: 760, status: "running" },
];

/* =========================================================================
 *  VERİ KATMANI
 * ========================================================================= */

// Gelen API verisini panelin beklediği şekle normalize eder.
// Backend alan adların farklıysa burada eşle (ör: m.makine_adi -> name).
function normalize(raw) {
  if (!Array.isArray(raw)) throw new Error("Beklenen format: dizi");
  return raw.map((m) => ({
    id: String(m.id ?? m.machineId ?? m.code ?? "?"),
    name: m.name ?? m.makineAdi ?? "İsimsiz makine",
    line: m.line ?? m.hat ?? "—",
    efficiency: Number(m.efficiency ?? m.verimlilik ?? 0),
    output: Number(m.output ?? m.uretim ?? 0),
    status: m.status ?? m.durum ?? "running",
  }));
}

async function fetchMachines(signal) {
  // API_URL boşsa mock veriyle ağ gecikmesini taklit et.
  if (!API_URL) {
    await new Promise((r) => setTimeout(r, 400));
    return normalize(MOCK_MACHINES);
  }
  const res = await fetch(API_URL, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Sunucu hatası: ${res.status}`);
  const json = await res.json();
  // Backend verileri { data: [...] } sarmalıyorsa burada aç.
  return normalize(Array.isArray(json) ? json : json.data ?? json.machines ?? []);
}

// Polling + iptal + hata yönetimini kapsülleyen hook.
function useMachines() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true); // sadece ilk yükleme
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const firstLoad = useRef(true);

  const load = useCallback(async (signal) => {
    try {
      const machines = await fetchMachines(signal);
      setData(machines);
      setError(null);
      setLastUpdated(new Date());
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message || "Veri alınamadı");
    } finally {
      if (firstLoad.current) {
        setLoading(false);
        firstLoad.current = false;
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    const id = setInterval(() => load(controller.signal), POLL_MS);
    return () => {
      controller.abort();
      clearInterval(id);
    };
  }, [load]);

  const refresh = useCallback(() => {
    const controller = new AbortController();
    load(controller.signal);
  }, [load]);

  return { data, loading, error, lastUpdated, refresh };
}

/* =========================================================================
 *  YARDIMCILAR
 * ========================================================================= */
const fmt = (n) => Number(n).toLocaleString("tr-TR");
const STATUS = {
  running: { label: "Çalışıyor", dot: "#16a34a" },
  warning: { label: "Uyarı", dot: "#d97706" },
  stopped: { label: "Durdu", dot: "#dc2626" },
};
const timeStr = (d) =>
  d ? d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";

/* =========================================================================
 *  BİLEŞENLER
 * ========================================================================= */
function KpiCard({ label, value, unit, sub }) {
  return (
    <div style={styles.kpiCard}>
      <span style={styles.kpiLabel}>{label}</span>
      <div style={styles.kpiValueRow}>
        <span style={styles.kpiValue}>{value}</span>
        {unit && <span style={styles.kpiUnit}>{unit}</span>}
      </div>
      {sub && <span style={styles.kpiSub}>{sub}</span>}
    </div>
  );
}

function MachineCard({ m }) {
  const low = m.efficiency < THRESHOLD;
  const st = STATUS[m.status] ?? STATUS.running;
  const barColor = low ? "#dc2626" : "#16a34a";
  return (
    <div
      style={{
        ...styles.card,
        borderColor: low ? "#fca5a5" : "#e7e8ec",
        background: low ? "#fff7f7" : "#ffffff",
      }}
    >
      <div style={styles.cardHead}>
        <div>
          <div style={styles.cardName}>{m.name}</div>
          <div style={styles.cardMeta}>{m.id} · {m.line}</div>
        </div>
        <span style={styles.statusPill}>
          <span style={{ ...styles.statusDot, background: st.dot }} />
          {st.label}
        </span>
      </div>

      <div style={styles.effRow}>
        <span style={styles.effLabel}>Verimlilik</span>
        <span style={{ ...styles.effValue, color: low ? "#dc2626" : "#111827" }}>{m.efficiency}%</span>
      </div>

      <div style={styles.track}>
        <div style={{ ...styles.fill, width: `${Math.min(m.efficiency, 100)}%`, background: barColor }} />
      </div>

      <div style={styles.cardFoot}>
        <span style={styles.footLabel}>Üretim</span>
        <span style={styles.footValue}>{fmt(m.output)} adet</span>
      </div>

      {low && <div style={styles.warnTag}>⚠ Hedef verimliliğin altında</div>}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div style={{ ...styles.card, background: "#fff" }}>
      <div style={{ ...styles.sk, width: "60%", height: 15 }} />
      <div style={{ ...styles.sk, width: "35%", height: 11 }} />
      <div style={{ ...styles.sk, width: "100%", height: 8, marginTop: 8 }} />
      <div style={{ ...styles.sk, width: "45%", height: 13 }} />
    </div>
  );
}

/* =========================================================================
 *  ANA PANEL
 * ========================================================================= */
export default function MachineDashboard() {
  const { data, loading, error, lastUpdated, refresh } = useMachines();

  const kpis = useMemo(() => {
    if (!data.length) return { totalOutput: 0, avgEff: 0, active: 0, total: 0 };
    const totalOutput = data.reduce((s, m) => s + m.output, 0);
    const avgEff = Math.round(data.reduce((s, m) => s + m.efficiency, 0) / data.length);
    const active = data.filter((m) => m.status !== "stopped").length;
    return { totalOutput, avgEff, active, total: data.length };
  }, [data]);

  return (
    <div style={styles.page}>
      <style>{keyframes}</style>
      <div style={styles.shell}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>Üretim İzleme Paneli</h1>
            <p style={styles.subtitle}>
              {API_URL ? "Canlı API" : "Demo (mock veri)"} · {kpis.total || MOCK_MACHINES.length} makine ·
              Son güncelleme {timeStr(lastUpdated)}
            </p>
          </div>
          <div style={styles.headerActions}>
            <span style={styles.liveBadge}>
              <span style={styles.liveDot} /> {error ? "Bağlantı yok" : "Canlı"}
            </span>
            <button style={styles.refreshBtn} onClick={refresh}>Yenile</button>
          </div>
        </header>

        {error && (
          <div style={styles.errorBox}>
            <strong>Veri alınamadı.</strong> {error}. Otomatik yeniden deneniyor…
          </div>
        )}

        <section style={styles.kpiGrid}>
          <KpiCard label="Toplam Üretim" value={fmt(kpis.totalOutput)} unit="adet" sub="Vardiya toplamı" />
          <KpiCard
            label="Ortalama Verimlilik"
            value={`${kpis.avgEff}%`}
            sub={kpis.avgEff < THRESHOLD ? "Hedefin altında" : "Hedef seviyede"}
          />
          <KpiCard
            label="Aktif Makine"
            value={`${kpis.active}`}
            unit={`/ ${kpis.total}`}
            sub={`${kpis.total - kpis.active} makine durdu`}
          />
        </section>

        <section style={styles.cardGrid}>
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            : data.map((m) => <MachineCard key={m.id} m={m} />)}
        </section>
      </div>
    </div>
  );
}

/* =========================================================================
 *  STİLLER
 * ========================================================================= */
const keyframes = `
@keyframes pulse { 0%,100% { opacity: .5 } 50% { opacity: 1 } }
@keyframes blink { 0%,100% { opacity: 1 } 50% { opacity: .35 } }
`;

const styles = {
  page: {
    minHeight: "100%",
    background: "#f5f6f8",
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    color: "#111827",
    padding: "32px 20px",
    boxSizing: "border-box",
  },
  shell: { maxWidth: 1120, margin: "0 auto" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
    flexWrap: "wrap",
    gap: 12,
  },
  title: { fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" },
  subtitle: { fontSize: 14, color: "#6b7280", margin: "6px 0 0" },
  headerActions: { display: "flex", alignItems: "center", gap: 10 },
  liveBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    fontWeight: 600,
    color: "#16a34a",
    background: "#ecfdf3",
    padding: "6px 12px",
    borderRadius: 999,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#16a34a",
    animation: "blink 1.6s infinite",
  },
  refreshBtn: {
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#374151",
    fontSize: 13,
    fontWeight: 600,
    padding: "7px 14px",
    borderRadius: 8,
    cursor: "pointer",
  },
  errorBox: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    fontSize: 13,
    padding: "10px 14px",
    borderRadius: 10,
    marginBottom: 20,
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
    marginBottom: 28,
  },
  kpiCard: {
    background: "#fff",
    border: "1px solid #e7e8ec",
    borderRadius: 14,
    padding: "18px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  kpiLabel: { fontSize: 13, color: "#6b7280", fontWeight: 500 },
  kpiValueRow: { display: "flex", alignItems: "baseline", gap: 6 },
  kpiValue: { fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em" },
  kpiUnit: { fontSize: 14, color: "#9ca3af", fontWeight: 500 },
  kpiSub: { fontSize: 12, color: "#9ca3af" },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 16,
  },
  card: {
    border: "1px solid #e7e8ec",
    borderRadius: 14,
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    transition: "border-color 0.2s",
  },
  cardHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  cardName: { fontSize: 15, fontWeight: 600 },
  cardMeta: { fontSize: 12, color: "#9ca3af", marginTop: 3 },
  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    fontWeight: 500,
    color: "#374151",
    whiteSpace: "nowrap",
  },
  statusDot: { width: 8, height: 8, borderRadius: "50%" },
  effRow: { display: "flex", justifyContent: "space-between", alignItems: "baseline" },
  effLabel: { fontSize: 13, color: "#6b7280" },
  effValue: { fontSize: 18, fontWeight: 700 },
  track: { height: 8, background: "#eef0f3", borderRadius: 999, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 999, transition: "width 0.4s ease" },
  cardFoot: { display: "flex", justifyContent: "space-between", alignItems: "baseline" },
  footLabel: { fontSize: 13, color: "#6b7280" },
  footValue: { fontSize: 14, fontWeight: 600 },
  warnTag: {
    fontSize: 12,
    fontWeight: 600,
    color: "#b91c1c",
    background: "#fee2e2",
    padding: "6px 10px",
    borderRadius: 8,
  },
  sk: { background: "#eef0f3", borderRadius: 6, animation: "pulse 1.4s infinite" },
};
