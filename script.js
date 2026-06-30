const slides = [
  {
    image: "assets/pet-play.svg?v=20260630d",
    alt: "主人和宠物在宠之岛玩耍",
    three: true,
    scene: "play",
    burst: "一起撒欢",
    burstSmall: "PLAY DATE",
    title: "主人和宠物一起玩的岛",
    descOne: "白天一起奔跑、躲猫猫、训练小把戏，把精力释放在一个安全好玩的场地里。",
    descTwo: "主人也不用只在旁边等，可以一起参与、拍照、交朋友。"
  },
  {
    image: "assets/pet-social.svg?v=20260630d",
    alt: "主人和宠物在宠友会客厅社交",
    three: true,
    scene: "social",
    burst: "宠友会客厅",
    burstSmall: "SOCIAL",
    title: "宠物社交，主人也社交",
    descOne: "给小家伙认识新伙伴，也给主人留一个轻松聊天的客厅。",
    descTwo: "活动可以是生日局、领养分享、宠物摄影，也可以只是一起坐坐。"
  },
  {
    image: "assets/pet-snack-tray.svg?v=20260630d",
    alt: "宠之岛电影夜热狗薯条托盘",
    three: true,
    scene: "cinema",
    burst: "宠物电影夜",
    burstSmall: "CINEMA",
    title: "今晚带毛孩子一起看电影",
    descOne: "南京江北新区宠物友好电影夜：低灯光、软垫位、可暂停，胆小宝也能慢慢适应。",
    descTwo: "打卡、碰头、吃小零食、拍合照，把普通周末变成你和小可爱的专属约会。"
  }
];

const steps = [
  "到南京江北新区集合，先完成宠物入场和基础安全确认。",
  "进入草坪撒欢区，一起跑、一起玩、一起把当天的能量释放掉。",
  "转到宠友会客厅，主人聊天，宠物认识新朋友。",
  "傍晚切到电影夜模式，选片、铺垫子、准备水和小零食。",
  "一起看完电影再离岛，把这一天存进你们的共同记忆。"
];

const markers = {
  day: [
    ["草坪撒欢区", "南京江北新区", "奔跑、互动、拍照", "日间开放"],
    ["宠友会客厅", "南京江北新区", "社交、生日局、分享会", "下午到傍晚"],
    ["宠物补给站", "南京江北新区", "饮水、休息、清洁", "全时段"]
  ],
  night: [
    ["宠物电影场", "南京江北新区", "宠物友好观影", "夜场"],
    ["安静缓冲区", "南京江北新区", "胆小宠物适应、休息", "观影前后"],
    ["夜间散步线", "南京江北新区", "散步、告别、返程", "散场后"]
  ]
};

let activeSlide = 0;
let activeMap = "day";

const preloader = document.querySelector("#preloader");
const startButton = document.querySelector("#startButton");
const siteHeader = document.querySelector("#siteHeader");
const mealImage = document.querySelector("#mealImage");
const mealStage = document.querySelector(".meal-stage");
const heroTitle = document.querySelector("#heroTitle");
const descOne = document.querySelector("#descOne");
const descTwo = document.querySelector("#descTwo");
const burstLabel = document.querySelector("#burstLabel");
const meterBar = document.querySelector("#meterBar");
const slideDots = document.querySelector("#slideDots");
const soundButton = document.querySelector("#soundButton");
const bgMusic = document.querySelector("#bgMusic");
const menuButton = document.querySelector("#menuButton");
const mobileNav = document.querySelector("#mobileNav");
const processText = document.querySelector("#processText");
const mapImage = document.querySelector("#mapImage");
const markerTitle = document.querySelector("#markerTitle");
const markerDistance = document.querySelector("#markerDistance");
const markerRa = document.querySelector("#markerRa");
const markerDec = document.querySelector("#markerDec");
const canvas = document.querySelector("#spaceCanvas");
const context = canvas.getContext("2d");

function hidePreloader() {
  preloader.classList.add("is-hidden");
  playMusic();
  setTimeout(() => {
    preloader.hidden = true;
  }, 760);
}

function renderDots() {
  slideDots.innerHTML = "";
  slides.forEach((_, index) => {
    const dot = document.createElement("span");
    dot.className = index === activeSlide ? "is-active" : "";
    slideDots.appendChild(dot);
  });
}

function syncThreeScene(slide) {
  const sceneName = slide.scene || "";
  document.documentElement.dataset.petScene = sceneName;
  mealStage.classList.toggle("is-three-slide", slide.three === true);
  window.petSnackThree?.setScene(sceneName);
  window.petSnackThree?.setVisible(slide.three === true);
}

function updateSlide(nextIndex) {
  activeSlide = (nextIndex + slides.length) % slides.length;
  const slide = slides[activeSlide];

  mealImage.classList.add("is-swapping");
  window.setTimeout(() => {
    mealImage.src = slide.image;
    mealImage.alt = slide.alt;
    syncThreeScene(slide);
    heroTitle.textContent = slide.title;
    descOne.textContent = slide.descOne;
    descTwo.textContent = slide.descTwo;
    burstLabel.querySelector("span").textContent = slide.burst;
    burstLabel.querySelector("small").textContent = slide.burstSmall;
    meterBar.style.width = `${((activeSlide + 1) / slides.length) * 100}%`;
    renderDots();
    mealImage.classList.remove("is-swapping");
  }, 180);
}

function updateStep(index) {
  const stepButtons = document.querySelectorAll(".step");
  stepButtons.forEach((button) => button.classList.toggle("is-active", Number(button.dataset.step) === index));
  processText.textContent = steps[index] || steps[0];
}

function updateMap(mapName) {
  activeMap = mapName;
  mapImage.src = mapName === "day" ? "assets/map-jiangbei.svg?v=20260630d" : "assets/map-pet-night.svg?v=20260630d";
  mapImage.alt = mapName === "day" ? "南京江北新区 PET PET LAND 日间地图" : "南京江北新区 PET PET LAND 电影夜地图";
  document.querySelectorAll("[data-map]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.map === mapName);
  });
  updateMarker(0);
}

function updateMarker(index) {
  const markerData = markers[activeMap][index];
  markerTitle.textContent = markerData[0];
  markerDistance.textContent = markerData[1];
  markerRa.textContent = markerData[2];
  markerDec.textContent = markerData[3];
  document.querySelectorAll(".marker").forEach((marker) => {
    marker.classList.toggle("is-active", Number(marker.dataset.marker) === index);
  });
}

async function toggleSound() {
  if (!bgMusic.paused) {
    bgMusic.pause();
    soundButton.setAttribute("aria-pressed", "false");
    soundButton.querySelector(".sound-label").textContent = "音乐开";
    return;
  }

  await playMusic();
}

async function playMusic() {
  try {
    bgMusic.volume = 0.55;
    await bgMusic.play();
    soundButton.setAttribute("aria-pressed", "true");
    soundButton.querySelector(".sound-label").textContent = "音乐关";
  } catch {
    soundButton.setAttribute("aria-pressed", "false");
    soundButton.querySelector(".sound-label").textContent = "音乐开";
  }
}

function drawSpace() {
  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  canvas.width = Math.floor(canvas.clientWidth * ratio);
  canvas.height = Math.floor(canvas.clientHeight * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

  const count = Math.max(30, Math.floor(canvas.clientWidth / 30));
  for (let i = 0; i < count; i += 1) {
    const x = (i * 97) % canvas.clientWidth;
    const y = (i * 151) % canvas.clientHeight;
    const r = 1 + (i % 4);
    context.beginPath();
    context.fillStyle = i % 3 === 0 ? "#fff3cf" : "#050505";
    context.globalAlpha = i % 3 === 0 ? 0.7 : 0.18;
    context.arc(x, y, r, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
}

function onScroll() {
  siteHeader.classList.toggle("is-solid", window.scrollY > 120);
}

startButton.addEventListener("click", hidePreloader);
soundButton.addEventListener("click", toggleSound);
menuButton.addEventListener("click", () => {
  const isOpen = mobileNav.classList.toggle("is-open");
  menuButton.setAttribute("aria-expanded", String(isOpen));
});
mobileNav.addEventListener("click", () => {
  mobileNav.classList.remove("is-open");
  menuButton.setAttribute("aria-expanded", "false");
});

document.querySelectorAll("[data-slide]").forEach((button) => {
  button.addEventListener("click", () => {
    updateSlide(activeSlide + (button.dataset.slide === "next" ? 1 : -1));
  });
});

document.querySelectorAll(".step").forEach((button) => {
  button.addEventListener("click", () => updateStep(Number(button.dataset.step)));
});

document.querySelectorAll("[data-map]").forEach((button) => {
  button.addEventListener("click", () => updateMap(button.dataset.map));
});

document.querySelectorAll(".marker").forEach((button) => {
  button.addEventListener("click", () => updateMarker(Number(button.dataset.marker)));
});

window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", drawSpace);

renderDots();
drawSpace();
onScroll();
syncThreeScene(slides[activeSlide]);
