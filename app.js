/* =========================================================
   HASUNG CLUB ARCHIVE - app.js (FINAL)
   - 키오스크: 10초 무입력 시 splash로
   - 데모: splash에서 15초 무입력 시 자동 시연
   - 캔바: 새 탭 열기 + 15초 후 자동 splash 복귀
   - PDF: iframe + #view=FitH (확대 완화)
========================================================= */

const screens = {
  splash: document.getElementById("screen-splash"),
  menu: document.getElementById("screen-menu"),
  club: document.getElementById("screen-club"),
};

const menuButtons = document.getElementById("menuButtons");
const btnHome = document.getElementById("btnHome");
const btnHome2 = document.getElementById("btnHome2");
const btnBack = document.getElementById("btnBack");

const clubTitle = document.getElementById("clubTitle");
const clubLogo = document.getElementById("clubLogo");
const clubName = document.getElementById("clubName");
const clubDesc = document.getElementById("clubDesc");

const fileListEl = document.getElementById("fileList");
const contentFrameWrap = document.getElementById("contentFrameWrap");
const btnOpenNewTab = document.getElementById("btnOpenNewTab");

/* =========================
   1) 키오스크 (10초 유지)
========================= */
const KIOSK_TIMEOUT = 10000;
let kioskTimer = null;

function resetKioskTimer() {
  if (kioskTimer) clearTimeout(kioskTimer);
  kioskTimer = setTimeout(() => showScreen("splash"), KIOSK_TIMEOUT);
}

/* =========================
   2) 데모 모드 (splash에서 15초 입력 없으면 시작)
========================= */
const DEMO_IDLE_MS = 15000;
const DEMO_STEP_MS = 4500;
let demoIdleTimer = null;
let demoStepTimer = null;
let demoRunning = false;

/* =========================
   3) 캔바 새 탭 자동 복귀 (15초)
========================= */
const EXTERNAL_VIEW_MS = 15000;
let externalReturnTimer = null;

/* 상태 */
let clubsCache = [];
let currentClub = null;
let currentFilePath = null;

/* =========================
   유틸
========================= */
function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[name].classList.add("active");

  resetKioskTimer();
  scheduleDemoIdle();
}

function isPdf(path) {
  return (path || "").toLowerCase().endsWith(".pdf");
}

function isCanvaUrl(path) {
  const p = (path || "").toLowerCase();
  return p.startsWith("http") && p.includes("canva.com");
}

/* =========================
   토스트(안내 문구)
========================= */
let toastEl = null;

function ensureToast() {
  if (toastEl) return;
  toastEl = document.createElement("div");
  toastEl.id = "toast";
  toastEl.style.position = "fixed";
  toastEl.style.left = "50%";
  toastEl.style.bottom = "26px";
  toastEl.style.transform = "translateX(-50%)";
  toastEl.style.padding = "12px 16px";
  toastEl.style.borderRadius = "14px";
  toastEl.style.background = "rgba(0,0,0,.78)";
  toastEl.style.color = "#fff";
  toastEl.style.fontWeight = "600";
  toastEl.style.fontSize = "14px";
  toastEl.style.zIndex = "9999";
  toastEl.style.display = "none";
  toastEl.style.maxWidth = "90vw";
  toastEl.style.textAlign = "center";
  document.body.appendChild(toastEl);
}

function showToast(msg, ms = 2000) {
  ensureToast();
  toastEl.textContent = msg;
  toastEl.style.display = "block";
  setTimeout(() => {
    if (toastEl) toastEl.style.display = "none";
  }, ms);
}

/* =========================
   PDF/링크 렌더 (단 1개만!)
========================= */
function renderFile(path) {
  contentFrameWrap.innerHTML = "";
  currentFilePath = path || null;

  if (!path) {
    contentFrameWrap.innerHTML = `<div style="padding:16px;">자료가 아직 없어요.</div>`;
    return;
  }

  // 캔바: 안내 화면만 표시 (새 탭으로 열기 버튼 사용)
  if (isCanvaUrl(path)) {
    contentFrameWrap.innerHTML = `
      <div style="
        height:100%;
        display:flex;
        align-items:center;
        justify-content:center;
        text-align:center;
        padding:20px;
      ">
        <div style="
          font-weight:900;
          font-size:40px;
          line-height:1.25;
        ">
          ${EXTERNAL_VIEW_MS / 1000}초 후 자동으로<br/>
          첫 화면으로 돌아옵니다
        </div>
      </div>
    `;
    return;
  }

  // PDF: FitH로 열기 (PPT 확대 완화)
  if (isPdf(path)) {
    const pdfUrl = `${path}#view=FitH`;

    const iframe = document.createElement("iframe");
    iframe.src = pdfUrl;
    iframe.title = "PDF Viewer";
    iframe.loading = "lazy";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";

    contentFrameWrap.appendChild(iframe);
    return;
  }

  // 기타 링크
  const iframe = document.createElement("iframe");
  iframe.src = path;
  iframe.title = "Content";
  iframe.loading = "lazy";
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "none";
  contentFrameWrap.appendChild(iframe);
}

/* =========================
   새 탭 열기 + 자동 복귀(캔바)
========================= */
function openExternalWithAutoReturn(url) {
  stopDemo();

  if (externalReturnTimer) clearTimeout(externalReturnTimer);

  const win = window.open(url, "_blank");

  showToast(
    `새 탭을 열었습니다. ${EXTERNAL_VIEW_MS / 1000}초 후 자동으로 첫 화면으로 돌아옵니다.`,
    3500
  );

  externalReturnTimer = setTimeout(() => {
    showScreen("splash");
    try {
      if (win && !win.closed) win.close();
    } catch (e) {
      /* 무시 */
    }
  }, EXTERNAL_VIEW_MS);
}

/* =========================
   파일 목록 렌더 (여기가 너 오류난 부분의 핵심)
========================= */
function renderFileList(files) {
  fileListEl.innerHTML = "";

  if (!Array.isArray(files) || files.length === 0) {
    fileListEl.innerHTML = `<div style="opacity:.7; padding:8px 0;">등록된 자료가 없어요.</div>`;
    currentFilePath = null;
    renderFile(null);
    return;
  }

  files.forEach((f, idx) => {
    const b = document.createElement("button");
    b.className = "fileBtn";
    b.textContent = f.title || `자료 ${idx + 1}`;

    b.onclick = () => {
      // active 처리
      [...fileListEl.querySelectorAll(".fileBtn")].forEach((x) =>
        x.classList.remove("active")
      );
      b.classList.add("active");

      renderFile(f.path);
    };

    fileListEl.appendChild(b);

    // 첫 파일 자동 선택
    if (idx === 0) {
      b.classList.add("active");
      renderFile(f.path);
    }
  });
}

/* =========================
   메뉴 렌더
========================= */
function renderMenu(clubs) {
  menuButtons.innerHTML = "";

  clubs.forEach((club) => {
    const btn = document.createElement("button");

    // club.id에 특수문자가 있을 수 있으니 CSS 클래스용은 안전하게 변환
    const safeId = String(club.id || "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-");

    btn.className = `clubBtn club-${safeId}`;
    btn.innerHTML = `
      <div class="name">${club.name || club.id}</div>
      <div class="sub">${club.desc || ""}</div>
    `;

    btn.onclick = () => {
      stopDemo();
      openClub(club);
    };

    menuButtons.appendChild(btn);
  });
}

/* =========================
   동아리 열기
========================= */
function openClub(club) {
  currentClub = club;

  // 테마(로직코드/ M&M)
  screens.club.classList.remove("theme-A", "theme-B");
  if (club.id === "logiccode" || club.id === "로직코드") screens.club.classList.add("theme-A");
  if (club.id === "mm" || club.id === "M&M") screens.club.classList.add("theme-B");

  clubTitle.textContent = club.name || club.id;
  clubLogo.src = club.logo || "";
  clubLogo.alt = `${club.name || club.id} 로고`;
  clubName.textContent = club.name || club.id;
  clubDesc.textContent = club.desc || "";

  const files = Array.isArray(club.files) ? club.files : [];
  renderFileList(files);

  // 새 탭 열기 버튼
  btnOpenNewTab.onclick = () => {
    stopDemo();
    if (!currentFilePath) return;

    if (isCanvaUrl(currentFilePath)) {
      openExternalWithAutoReturn(currentFilePath);
      return;
    }
    window.open(currentFilePath, "_blank");
  };

  showScreen("club");
}

/* =========================
   데모 모드
========================= */
function scheduleDemoIdle() {
  if (demoIdleTimer) clearTimeout(demoIdleTimer);
  if (demoRunning) return;
  if (!screens.splash.classList.contains("active")) return;

  demoIdleTimer = setTimeout(() => startDemo(), DEMO_IDLE_MS);
}

function startDemo() {
  if (demoRunning) return;
  demoRunning = true;

  showScreen("menu");

  let idx = 0;

  // ✅ clubs.json의 id 기준 (너 지금: logiccode/mm/vitalis/prism...)
  const order = ["logiccode", "mm", "vitalis", "prism"];

  const step = () => {
    if (!demoRunning) return;

    if (!clubsCache || clubsCache.length === 0) {
      demoRunning = false;
      showScreen("splash");
      scheduleDemoIdle();
      return;
    }

    const wantId = order[idx % order.length];
    const club =
      clubsCache.find((c) => String(c.id).toLowerCase() === wantId) ||
      clubsCache[idx % clubsCache.length];

    openClub(club);

    // 데모 중엔 캔바 새 탭 자동 오픈 X
    // 대신 2번째 파일이 캔바가 아니면 살짝 보여주기
    const files = Array.isArray(club.files) ? club.files : [];
    if (files.length >= 2 && !isCanvaUrl(files[1].path)) {
      const btns = [...fileListEl.querySelectorAll(".fileBtn")];
      if (btns[1]) {
        btns.forEach((b) => b.classList.remove("active"));
        btns[1].classList.add("active");
        renderFile(files[1].path);
      }
    }

    idx++;
    demoStepTimer = setTimeout(step, DEMO_STEP_MS);
  };

  demoStepTimer = setTimeout(step, DEMO_STEP_MS);
}

function stopDemo() {
  if (!demoRunning) {
    scheduleDemoIdle();
    return;
  }

  demoRunning = false;

  if (demoIdleTimer) clearTimeout(demoIdleTimer);
  if (demoStepTimer) clearTimeout(demoStepTimer);
  demoIdleTimer = null;
  demoStepTimer = null;

  scheduleDemoIdle();
}

/* =========================
   입력 감지
========================= */
function onAnyUserInput() {
  resetKioskTimer();
  if (demoRunning) stopDemo();
  scheduleDemoIdle();
}

/* =========================
   데이터 로드
========================= */
async function loadClubs() {
  const res = await fetch("clubs.json", { cache: "no-store" });
  const data = await res.json();
  clubsCache = data.clubs || [];
  renderMenu(clubsCache);
}

/* =========================
   버튼 이벤트
========================= */
screens.splash.onclick = () => showScreen("menu");
btnHome.onclick = () => showScreen("splash");
btnHome2.onclick = () => showScreen("splash");
btnBack.onclick = () => showScreen("menu");

/* 모든 입력 감지 */
["click", "touchstart", "mousemove", "keydown"].forEach((ev) => {
  document.addEventListener(ev, onAnyUserInput, { passive: true });
});

/* =========================
   첫 화면 떠다니는 로고
========================= */
const floatingLogos = [
  "assets/clubs/로직코드.png",
  "assets/clubs/M&M.png",
  "assets/clubs/prism.png",
  "assets/clubs/vitalis.png",
];

function initFloatingLogos() {
  const wrap = document.getElementById("floating-logos");
  if (!wrap) return;

  wrap.innerHTML = "";
  const count = 12;

  for (let i = 0; i < count; i++) {
    const img = document.createElement("img");
    img.src = floatingLogos[i % floatingLogos.length];
    img.className = "floating-logo";

    img.style.left = Math.random() * 100 + "vw";
    img.style.animationDuration = 20 + Math.random() * 20 + "s";
    img.style.animationDelay = -Math.random() * 20 + "s";

    wrap.appendChild(img);
  }
}

/* =========================
   시작
========================= */
loadClubs().catch((err) => {
  console.error(err);
  alert("clubs.json을 불러오지 못했어요. (GitHub Pages 또는 Live Server 확인)");
});

resetKioskTimer();
scheduleDemoIdle();
initFloatingLogos();
