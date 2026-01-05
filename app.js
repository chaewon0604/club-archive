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
   1) 키오스크 (너가 10초로 바꿔둔 값 유지)
========================= */
const KIOSK_TIMEOUT = 10000; // 너가 원하는 값(10초)
let kioskTimer = null;

function resetKioskTimer(){
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
let currentFileIsCanva = false;

/* =========================
   유틸
========================= */
function showScreen(name){
  Object.values(screens).forEach(s => s.classList.remove("active"));
  screens[name].classList.add("active");
  resetKioskTimer();

  // splash 상태가 되면 데모 예약
  scheduleDemoIdle();
}

function clearTimers(){
  if (demoIdleTimer) clearTimeout(demoIdleTimer);
  if (demoStepTimer) clearTimeout(demoStepTimer);
  demoIdleTimer = null;
  demoStepTimer = null;

  if (externalReturnTimer) clearTimeout(externalReturnTimer);
  externalReturnTimer = null;
}

function isPdf(path){
  return (path || "").toLowerCase().endsWith(".pdf");
}

function isCanvaUrl(path){
  const p = (path || "").toLowerCase();
  return p.startsWith("http") && p.includes("canva.com");
}

/* =========================
   토스트(안내 문구) - JS로 자동 생성
========================= */
let toastEl = null;

function ensureToast(){
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

function showToast(msg, ms = 2000){
  ensureToast();
  toastEl.textContent = msg;
  toastEl.style.display = "block";
  setTimeout(() => {
    if (toastEl) toastEl.style.display = "none";
  }, ms);
}

/* =========================
   PDF/링크 렌더
========================= */
function renderFile(path){
  contentFrameWrap.innerHTML = "";
  currentFilePath = path;
  currentFileIsCanva = isCanvaUrl(path);

  if (!path){
    contentFrameWrap.innerHTML = `<div style="padding:16px;">자료가 아직 없어요.</div>`;
    return;
  }

  // 캔바는 iframe 대신 안내 화면 (전시 안정성)
  // 캔바는 iframe 대신 안내 화면 (전시 안정성)
if (currentFileIsCanva){
  contentFrameWrap.innerHTML = `
    <div style="
      height:100%;
      display:flex;
      align-items:center;
      justify-content:center;
      text-align:center;
    ">
      <div style="
        font-weight:900;
        font-size:36px;
        line-height:1.3;
      ">
        파일을 선택하면 ${EXTERNAL_VIEW_MS/1000}초 후<br/>
        자동으로 돌아옵니다
      </div>
    </div>
  `;
}


  // PDF면 embed
  if (isPdf(path)){
    const embed = document.createElement("embed");
    embed.src = path;
    embed.type = "application/pdf";
    contentFrameWrap.appendChild(embed);
  } else {
    // 기타 링크는 iframe (원하면 여기도 새 탭으로만 바꿀 수 있음)
    const iframe = document.createElement("iframe");
    iframe.src = path;
    iframe.allow = "fullscreen";
    contentFrameWrap.appendChild(iframe);
  }
}

/* =========================
   새 탭 열기 + 자동 복귀(캔바)
========================= */
function openExternalWithAutoReturn(url){
  // 데모 중이면 종료
  stopDemo();

  // 기존 복귀 타이머 제거
  if (externalReturnTimer) clearTimeout(externalReturnTimer);

  // 사용자 클릭 이벤트 안에서 열어야 팝업 차단이 덜함
  const win = window.open(url, "_blank");

  // 안내
  showToast(`캔바 자료를 새 탭으로 열었어요. ${EXTERNAL_VIEW_MS/1000}초 후 자동으로 돌아갑니다.`, 3500);

  // 15초 뒤: 우리 사이트는 첫 화면으로 복귀
  externalReturnTimer = setTimeout(() => {
    showScreen("splash");

    // 우리가 연 창이면 닫히는 경우도 있음(브라우저 정책에 따라 다름)
    try{
      if (win && !win.closed) win.close();
    } catch(e){ /* 무시 */ }
  }, EXTERNAL_VIEW_MS);
}

/* =========================
   파일 리스트
========================= */
function renderFileList(files){
  fileListEl.innerHTML = "";

  if (!files || files.length === 0){
    fileListEl.innerHTML = `<div class="emptyFiles">등록된 자료가 없어요.</div>`;
    renderFile(null);
    return;
  }

  files.forEach((f, idx) => {
    const b = document.createElement("button");
    b.className = "fileBtn";
    b.textContent = f.title || `자료 ${idx + 1}`;

    b.onclick = () => {
      stopDemo();

      // active 표시
      [...fileListEl.querySelectorAll(".fileBtn")].forEach(x => x.classList.remove("active"));
      b.classList.add("active");

      //  캔바면: 자동 새 탭 + 자동 복귀
      if (isCanvaUrl(f.path)){
        renderFile(f.path);               // 오른쪽에 안내 패널 표시
        openExternalWithAutoReturn(f.path);
        return;
      }

      // PDF/기타 링크는 화면에 표시
      renderFile(f.path);
    };

    fileListEl.appendChild(b);

    // 첫 파일 자동 선택
    if (idx === 0){
      b.classList.add("active");
      renderFile(f.path);
    }
  });
}

/* =========================
   메뉴 렌더
========================= */
function renderMenu(clubs){
  menuButtons.innerHTML = "";
  clubs.forEach(club => {
    const btn = document.createElement("button");
    btn.className = `clubBtn club-${club.id}`;
    btn.innerHTML = `
      <div class="name">${club.id}</div>
      <div class="sub">${club.name}</div>
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
function openClub(club){
  currentClub = club;

  // A/B 상세 테마
  screens.club.classList.remove("theme-A", "theme-B");
  if (club.id === "A") screens.club.classList.add("theme-A");
  if (club.id === "B") screens.club.classList.add("theme-B");

  clubTitle.textContent = club.name || club.id;
  clubLogo.src = club.logo || "";
  clubLogo.alt = `${club.name || club.id} 로고`;
  clubName.textContent = club.name || club.id;
  clubDesc.textContent = club.desc || "";

  // files 배열 우선
  const files = Array.isArray(club.files)
    ? club.files
    : (club.link ? [{ title: "자료", path: club.link }] : []);

  renderFileList(files);

  // "선택한 자료 새 탭" 버튼: PDF도 새 탭 가능, 캔바는 자동 복귀
  btnOpenNewTab.onclick = () => {
    stopDemo();
    if (!currentFilePath) return;

    if (isCanvaUrl(currentFilePath)){
      openExternalWithAutoReturn(currentFilePath);
      return;
    }

    // PDF/기타 링크는 그냥 새 탭
    window.open(currentFilePath, "_blank");
  };

  showScreen("club");
}

/* =========================
   데모 모드
========================= */
function scheduleDemoIdle(){
  if (demoIdleTimer) clearTimeout(demoIdleTimer);
  if (demoRunning) return;
  if (!screens.splash.classList.contains("active")) return;

  demoIdleTimer = setTimeout(() => startDemo(), DEMO_IDLE_MS);
}

function startDemo(){
  if (demoRunning) return;
  demoRunning = true;

  showScreen("menu");

  let idx = 0;
  const order = ["A","B","C","D","E"]; //  전시용 고정 순서

  const step = () => {
    if (!demoRunning) return;

    if (!clubsCache || clubsCache.length === 0){
      demoRunning = false;
      showScreen("splash");
      scheduleDemoIdle();
      return;
    }

    // 고정 순서로 club 찾기
    const id = order[idx % order.length];
    const club = clubsCache.find(c => c.id === id) || clubsCache[idx % clubsCache.length];

    openClub(club);

    // 데모 중엔 캔바 자동 새 탭 안 열리게(현장 혼란 방지)
    // 대신 두 번째 파일이 PDF/링크면 바꿔보기만
    const files = Array.isArray(club.files) ? club.files : [];
    if (files.length >= 2 && !isCanvaUrl(files[1].path)){
      const btns = [...fileListEl.querySelectorAll(".fileBtn")];
      if (btns[1]){
        btns.forEach(b => b.classList.remove("active"));
        btns[1].classList.add("active");
        renderFile(files[1].path);
      }
    }

    idx++;
    demoStepTimer = setTimeout(step, DEMO_STEP_MS);
  };

  demoStepTimer = setTimeout(step, DEMO_STEP_MS);
}

function stopDemo(){
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
function onAnyUserInput(){
  resetKioskTimer();

  // 사람이 입력하면 데모 종료
  if (demoRunning) stopDemo();

  // splash일 때만 데모 예약
  scheduleDemoIdle();
}

/* =========================
   데이터 로드
========================= */
async function loadClubs(){
  const res = await fetch("clubs.json", { cache:"no-store" });
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
["click","touchstart","mousemove","keydown"].forEach(ev=>{
  document.addEventListener(ev, onAnyUserInput, { passive:true });
});

/* 시작 */
loadClubs().catch(err=>{
  console.error(err);
  alert("clubs.json을 불러오지 못했어요. Live Server로 실행 중인지 확인해 주세요.");
});

resetKioskTimer();
scheduleDemoIdle();
/* =========================
   첫 화면 떠다니는 로고
========================= */
const floatingLogos = [
  "assets/clubs/로직코드.png",
  "assets/clubs/M&M.png",
  "assets/clubs/C.png",
  "assets/clubs/D.png",
  "assets/clubs/E.png",
];

function initFloatingLogos(){
  const wrap = document.getElementById("floating-logos");
  if (!wrap) return;

  wrap.innerHTML = "";

  const count = 12; // 화면에 떠다니는 로고 개수

  for (let i = 0; i < count; i++){
    const img = document.createElement("img");
    img.src = floatingLogos[i % floatingLogos.length];
    img.className = "floating-logo";

    // 랜덤 위치 & 속도
    img.style.left = Math.random() * 100 + "vw";
    img.style.animationDuration = 20 + Math.random() * 20 + "s";
    img.style.animationDelay = (-Math.random() * 20) + "s";

    wrap.appendChild(img);
  }
}

/* 시작 시 실행 */
initFloatingLogos();
