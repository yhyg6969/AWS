/**
 * AWS EC2 Cute Cat Gallery Demo Page JS
 * Handles gallery rendering, dynamic filtering, interactive tag editing,
 * likes counter with floating heart particles, lightbox slide-show, EC2 metadata simulation,
 * and custom Watermelon Game with dynamic cat image rendering.
 */

// Initial Photos Database - 삼냥이별로 4장씩 총 12장의 사진을 매칭
const DEFAULT_PHOTOS = [
    // 용용이 사진 4장 (🤎 첫째 / 갈색고양이 / 시크도도)
    { id: 0, src: 'images/용용01.jpg', cat: '용용', likes: 24, desc: '첫째 용용이의 시크 도도함이 느껴지는 아침 눈빛 🤎' },
    { id: 3, src: 'images/용용02.jpg', cat: '용용', likes: 18, desc: '장난감을 봐도 새침하게 쳐다보는 용용이의 시크한 뒤태 🐾' },
    { id: 6, src: 'images/용용03.jpg', cat: '용용', likes: 39, desc: '캣타워 꼭대기에서 도도하게 식빵 굽는 우리 집 첫째 용용 🍞' },
    { id: 9, src: 'images/용용04.jpg', cat: '용용', likes: 42, desc: '집사를 가만히 응시하는 용용이의 치명적인 눈빛 ✨' },

    // 로미 사진 4장 (🤍 둘째 / 흰고양이 / 제일용감)
    { id: 1, src: 'images/로미01.jpg', cat: '로미', likes: 45, desc: '용감한 둘째 로미의 햇살 가득한 오후 나른함 🤍' },
    { id: 4, src: 'images/로미02.jpg', cat: '로미', likes: 53, desc: '창밖 참새들을 당당하게 구경하는 제일 용감한 미묘 로미 🦅' },
    { id: 8, src: 'images/로미03.jpg', cat: '로미', likes: 31, desc: '새로운 장난감도 무서워하지 않고 덥석 잡는 용맹한 로미 🦁' },
    { id: 10, src: 'images/로미04.jpg', cat: '로미', likes: 57, desc: '당당하게 카메라를 아이컨택하는 우리 대장 고양이 로미 📸' },

    // 타비 사진 4장 (💛 막내 / 치즈고양이 / 소심함)
    { id: 2, src: 'images/타비01.jpg', cat: '타비', likes: 32, desc: '소심쟁이 막내 타비의 따끈따끈 골골송 타임 💛' },
    { id: 5, src: 'images/타비02.jpg', cat: '타비', likes: 27, desc: '낯선 소리에 깜짝 놀라 따뜻한 담요 속에 푹 파묻힌 소심 타비 ☁️' },
    { id: 7, src: 'images/타비03.jpg', cat: '타비', likes: 61, desc: '집사가 부르자 소심하게 귀가 쫑긋해진 막내 타비 🍗' },
    { id: 11, src: 'images/타비04.jpg', cat: '타비', likes: 49, desc: '구석진 곳이 제일 안전해! 틈새에 숨어서 눈치 보는 귀여운 타비 🍯' }
];

let photos = [];
let currentFilter = 'all';
let filteredPhotosList = [];
let activeLightboxIndex = -1;

// 🎮 수박 게임 데이터 및 설정 자료형 정의
const EVOLUTION_LEVELS = [
    { level: 0, radius: 20, score: 2,  src: 'images/용용01.jpg', color: '#713f12' },
    { level: 1, radius: 28, score: 4,  src: 'images/로미01.jpg', color: '#0284c7' },
    { level: 2, radius: 36, score: 6,  src: 'images/타비01.jpg', color: '#ca8a04' },
    { level: 3, radius: 44, score: 8,  src: 'images/용용02.jpg', color: '#854d0e' },
    { level: 4, radius: 52, score: 12, src: 'images/로미02.jpg', color: '#38bdf8' },
    { level: 5, radius: 60, score: 16, src: 'images/타비02.jpg', color: '#eab308' },
    { level: 6, radius: 68, score: 20, src: 'images/용용03.jpg', color: '#a16207' },
    { level: 7, radius: 76, score: 26, src: 'images/타비03.jpg', color: '#fef08a' },
    { level: 8, radius: 84, score: 32, src: 'images/용용04.jpg', color: '#451a03' },
    { level: 9, radius: 94, score: 40, src: 'images/로미04.jpg', color: '#0f172a' },
    { level: 10,radius: 110,score: 50, src: 'images/타비04.jpg', color: '#dc2626' } // 최종 진화 수박단계 고양이
];

// 게임 내 전역 변수
let canvas, ctx;
let gameImages = {}; // 이미지 객체 캐싱용
let circles = [];
let currentCircle = null;
let nextCircleLevel = 0;
let gameScore = 0;
let gameBestScore = 0;
let isGameOver = false;
let canDrop = true;
let lastDropTime = 0;
const DROP_DELAY = 400; // 낙하 쿨타임(ms)
const DEADLINE_Y = 100;  // 한계선 높이

// App 최초 초기화
document.addEventListener('DOMContentLoaded', () => {
    loadPhotosData();
    renderGallery(currentFilter);
    setupFilters();
    setupLightbox();
    fetchEC2Metadata();
    setupProfileClicks();
    
    // 게임 시스템 구동
    initCatGame();
});

// Load photos from LocalStorage or initialize with default
function loadPhotosData() {
    const stored = localStorage.getItem('aws_cat_gallery_photos');
    if (stored) {
        try {
            photos = JSON.parse(stored);
            if (photos.length !== DEFAULT_PHOTOS.length || photos[0].src.includes('KakaoTalk')) {
                photos = [...DEFAULT_PHOTOS];
                savePhotosData();
            }
        } catch (e) {
            console.error('Failed to parse stored photos, fallback to defaults', e);
            photos = [...DEFAULT_PHOTOS];
        }
    } else {
        photos = [...DEFAULT_PHOTOS];
        savePhotosData();
    }
}

function savePhotosData() {
    localStorage.setItem('aws_cat_gallery_photos', JSON.stringify(photos));
}

// Render Photos Grid
function renderGallery(filter) {
    currentFilter = filter;
    const grid = document.getElementById('galleryGrid');
    if(!grid) return;
    grid.innerHTML = '';

    filteredPhotosList = photos.filter(p => filter === 'all' || p.cat === filter);

    if (filteredPhotosList.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem; background: rgba(255,255,255,0.5); border-radius: 20px; font-family: var(--font-cute); font-size: 1.5rem; color: var(--text-muted);">😿 이 카테고리에는 등록된 고양이 사진이 없어요!</div>`;
        return;
    }

    filteredPhotosList.forEach((photo, index) => {
        let badgeClass = 'unknown';
        let badgeEmoji = '❓';
        if (photo.cat === '용용') { badgeClass = 'yongyong'; badgeEmoji = '🤎'; }
        else if (photo.cat === '로미') { badgeClass = 'romi'; badgeEmoji = '🤍'; }
        else if (photo.cat === '타비') { badgeClass = 'tabi'; badgeEmoji = '💛'; }

        const card = document.createElement('div');
        card.className = 'gallery-item';
        card.innerHTML = `
            <div class="img-container" data-index="${index}">
                <img src="${photo.src}" alt="${photo.desc}" loading="lazy">
            </div>
            <div class="card-content">
                <div class="card-header">
                    <span class="cat-badge ${badgeClass}">${badgeEmoji} ${photo.cat}</span>
                    <button class="like-button" data-id="${photo.id}">
                        <span class="heart">❤️</span> <span class="like-count">${photo.likes}</span>
                    </button>
                </div>
                <p style="font-size: 0.9rem; margin-bottom: 1rem; color: var(--text-dark); flex-grow: 1;">${photo.desc}</p>
                <div class="card-control">
                    <div class="tag-select-wrapper">
                        <label for="tag-select-${photo.id}">집사 태그 변경:</label>
                        <select id="tag-select-${photo.id}" class="tag-select" data-id="${photo.id}">
                            <option value="용용" ${photo.cat === '용용' ? 'selected' : ''}>용용 (첫째)</option>
                            <option value="로미" ${photo.cat === '로미' ? 'selected' : ''}>로미 (둘째)</option>
                            <option value="타비" ${photo.cat === '타비' ? 'selected' : ''}>타비 (막내)</option>
                        </select>
                    </div>
                </div>
            </div>
        `;

        card.querySelector('.like-button').addEventListener('click', (e) => { handleLike(photo.id, e); });
        card.querySelector('.tag-select').addEventListener('change', (e) => { handleTagChange(photo.id, e.target.value); });
        card.querySelector('.img-container').addEventListener('click', () => { openLightbox(index); });
        grid.appendChild(card);
    });
}

function setupFilters() {
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderGallery(btn.getAttribute('data-filter'));
        });
    });
}

function setupProfileClicks() {
    const profiles = document.querySelectorAll('.profile-card');
    profiles.forEach(card => {
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
            const catName = card.getAttribute('data-cat');
            document.querySelectorAll('.filter-btn').forEach(btn => {
                if (btn.getAttribute('data-filter') === catName) {
                    btn.click();
                    document.querySelector('.filter-section').scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
    });
}

function handleLike(photoId, event) {
    const photo = photos.find(p => p.id === photoId);
    if (photo) {
        photo.likes += 1;
        savePhotosData();
        event.currentTarget.querySelector('.like-count').textContent = photo.likes;
        createFloatingHeart(event.clientX, event.clientY);
    }
}

function createFloatingHeart(x, y) {
    const heart = document.createElement('span');
    heart.className = 'floating-heart';
    heart.innerHTML = '❤️';
    heart.style.left = `${x - 10}px`;
    heart.style.top = `${y - 10}px`;
    heart.style.setProperty('--rot-angle', `${(Math.random() - 0.5) * 60}deg`);
    document.body.appendChild(heart);
    heart.addEventListener('animationend', () => { heart.remove(); });
}

function handleTagChange(photoId, newCat) {
    const photo = photos.find(p => p.id === photoId);
    if (photo && photo.cat !== newCat) {
        photo.cat = newCat;
        savePhotosData();
        setTimeout(() => { renderGallery(currentFilter); }, 150);
    }
}

function setupLightbox() {
    const lightbox = document.getElementById('lightbox');
    if(!lightbox) return;
    document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
    document.getElementById('lightboxPrev').addEventListener('click', (e) => { e.stopPropagation(); slideLightbox(-1); });
    document.getElementById('lightboxNext').addEventListener('click', (e) => { e.stopPropagation(); slideLightbox(1); });
}

function openLightbox(index) {
    activeLightboxIndex = index;
    updateLightboxContent();
    document.getElementById('lightbox').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    document.getElementById('lightbox').classList.remove('active');
    document.body.style.overflow = '';
}

function slideLightbox(direction) {
    if (filteredPhotosList.length <= 1) return;
    activeLightboxIndex += direction;
    if (activeLightboxIndex < 0) activeLightboxIndex = filteredPhotosList.length - 1;
    else if (activeLightboxIndex >= filteredPhotosList.length) activeLightboxIndex = 0;
    updateLightboxContent();
}

function updateLightboxContent() {
    const imgEl = document.getElementById('lightboxImg');
    const captionEl = document.getElementById('lightboxCaption');
    const activePhoto = filteredPhotosList[activeLightboxIndex];
    if (activePhoto && imgEl) {
        imgEl.src = activePhoto.src;
        captionEl.innerHTML = `<strong>[${activePhoto.cat}]</strong> ${activePhoto.desc} (❤️ ${activePhoto.likes})`;
    }
}

// 🎮 =========================================================================
// 🎮 NEW: 수박게임 자체 물리 연산 및 캔버스 구현 코드 영역
// 🎮 =========================================================================

function initCatGame() {
    canvas = document.getElementById('gameCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    // 이미지 사전 로드 캐싱
    EVOLUTION_LEVELS.forEach(levelData => {
        const img = new Image();
        img.src = levelData.src;
        gameImages[levelData.level] = img;
    });

    // 최고기록 로드 (로컬 캐시 보관함 조회)
    gameBestScore = parseInt(localStorage.getItem('samnyong_game_best')) || 0;
    document.getElementById('bestScore').textContent = gameBestScore;

    // 이벤트 리스너 바인딩
    window.addEventListener('keydown', handleKeyDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', triggerDrop);
    
    document.getElementById('restartBtn').addEventListener('click', resetGame);
    document.getElementById('modalRestartBtn').addEventListener('click', resetGame);

    resetGame();
    // 60FPS 애니메이션 루프 가동
    requestAnimationFrame(gameLoop);
}

function resetGame() {
    circles = [];
    gameScore = 0;
    isGameOver = false;
    canDrop = true;
    document.getElementById('currentScore').textContent = '0';
    document.getElementById('gameOverScreen').classList.add('hidden');
    spawnNextCircle();
}

function spawnNextCircle() {
    // 최초 0~3 레벨(작은 원) 중 랜덤 생성
    const lv = Math.floor(Math.random() * 4);
    const meta = EVOLUTION_LEVELS[lv];
    currentCircle = {
        x: canvas.width / 2,
        y: 50,
        level: lv,
        radius: meta.radius,
        color: meta.color,
        isDropped: false,
        vx: 0,
        vy: 0
    };
}

function handleKeyDown(e) {
    if (isGameOver || !currentCircle || currentCircle.isDropped) return;

    if (e.key === 'ArrowLeft') {
        currentCircle.x = Math.max(currentCircle.radius, currentCircle.x - 20);
    } else if (e.key === 'ArrowRight') {
        currentCircle.x = Math.min(canvas.width - currentCircle.radius, currentCircle.x + 20);
    } else if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        triggerDrop();
    }
}

function handleMouseMove(e) {
    if (isGameOver || !currentCircle || currentCircle.isDropped) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    
    // 벽면 이탈 방지 경계 제한
    currentCircle.x = Math.max(currentCircle.radius, Math.min(canvas.width - currentCircle.radius, mouseX));
}

function triggerDrop() {
    if (isGameOver || !canDrop || !currentCircle || currentCircle.isDropped) return;
    
    const now = Date.now();
    if (now - lastDropTime < DROP_DELAY) return;

    currentCircle.isDropped = true;
    currentCircle.vy = 2; // 낙하 초기 속도 제공
    circles.push(currentCircle);
    currentCircle = null;
    
    canDrop = false;
    lastDropTime = now;

    // 잠시 후 다음 과일 대기조 생성
    setTimeout(() => {
        if (!isGameOver) {
            spawnNextCircle();
            canDrop = true;
        }
    }, DROP_DELAY);
}

function gameLoop() {
    updatePhysics();
    drawGame();
    requestAnimationFrame(gameLoop);
}

function updatePhysics() {
    if (isGameOver) return;

    const gravity = 0.4;
    const bounce = 0.15;
    const friction = 0.98;

    // 1. 이동 및 물리 중력 연산
    circles.forEach(c => {
        if (!c.isDropped) return;
        c.vy += gravity;
        c.x += c.vx;
        c.y += c.vy;
        c.vx *= friction;

        // 바닥 충돌
        if (c.y + c.radius > canvas.height) {
            c.y = canvas.height - c.radius;
            c.vy = -c.vy * bounce;
            if (Math.abs(c.vy) < 0.5) c.vy = 0;
        }
        // 좌우 벽 충돌
        if (c.x - c.radius < 0) {
            c.x = c.radius;
            c.vx = -c.vx * bounce;
        } else if (c.x + c.radius > canvas.width) {
            c.x = canvas.width - c.radius;
            c.vx = -c.vx * bounce;
        }
    });

    // 2. 오브젝트 상호 간 원형 충돌(Circle Collision) 처리 루프
    for (let i = 0; i < circles.length; i++) {
        for (let j = i + 1; j < circles.length; j++) {
            let c1 = circles[i];
            let c2 = circles[j];

            let dx = c2.x - c1.x;
            let dy = c2.y - c1.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            let minDist = c1.radius + c2.radius;

            if (dist < minDist) {
                // 진화 조건 체크: 레벨이 같고 아직 최대 진화형이 아닐 때
                if (c1.level === c2.level && c1.level < EVOLUTION_LEVELS.length - 1) {
                    // 두 오브젝트를 합성하여 한 자리에 한 단계 높은 레벨 인스턴스 생성
                    const nextLv = c1.level + 1;
                    const meta = EVOLUTION_LEVELS[nextLv];
                    
                    const newCircle = {
                        x: (c1.x + c2.x) / 2,
                        y: (c1.y + c2.y) / 2,
                        level: nextLv,
                        radius: meta.radius,
                        color: meta.color,
                        isDropped: true,
                        vx: (c1.vx + c2.vx) * 0.5,
                        vy: (c1.vy + c2.vy) * 0.5 - 2 // 합성 시 약간 튕기는 이펙트
                    };

                    // 점수 합산 가산 및 갱신
                    gameScore += meta.score;
                    document.getElementById('currentScore').textContent = gameScore;
                    
                    if (gameScore > gameBestScore) {
                        gameBestScore = gameScore;
                        document.getElementById('bestScore').textContent = gameBestScore;
                        localStorage.setItem('samnyong_game_best', gameBestScore);
                    }

                    // 기존 충돌 원 두 개 제거 후 새 원 투입
                    circles.splice(j, 1);
                    circles.splice(i, 1);
                    circles.push(newCircle);
                    
                    i--; // 인덱스 보정
                    break;
                }

                // 일반 반발 물리 밀어내기 연산 (오버랩 해제)
                let overlap = minDist - dist;
                if (dist === 0) dist = 0.1; // Divide by zero 방지
                let nx = dx / dist;
                let ny = dy / dist;

                // 서로 반대 방향으로 밀어내기 조정
                c1.x -= nx * overlap * 0.5;
                c1.y -= ny * overlap * 0.5;
                c2.x += nx * overlap * 0.5;
                c2.y += ny * overlap * 0.5;

                // 탄성 벡터 연산 구조화
                let kx = c1.vx - c2.vx;
                let ky = c1.vy - c2.vy;
                let p = 2 * (nx * kx + ny * ky) / 2; // 단순 질량 균등화 1:1 가정

                c1.vx -= nx * p * 0.3;
                c1.vy -= ny * p * 0.3;
                c2.vx += nx * p * 0.3;
                c2.vy += ny * p * 0.3;
            }
        }
    }

    // 3. 게임 오버(한계선 이탈) 감지 조건 연산
    circles.forEach(c => {
        if (c.isDropped && c.y - c.radius < DEADLINE_Y && Math.abs(c.vy) < 0.1) {
            // 한계선(DEADLINE_Y) 위에서 안착되어 멈춰있을 경우 종료 판정
            isGameOver = true;
            document.getElementById('gameOverScreen').classList.remove('hidden');
        }
    });
}

function drawGame() {
    // 캔버스 잔상 클리어
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. 데드라인 가이드라인 그리기 (점선 처리)
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(0, DEADLINE_Y);
    ctx.lineTo(canvas.width, DEADLINE_Y);
    ctx.stroke();
    ctx.setLineDash([]); // 대시라인 초기화

    // 2. 안착 완료된 원 오브젝트 렌더링
    circles.forEach(c => drawCircleObject(c));

    // 3. 대기/조작 중인 원 라인 렌더링
    if (currentCircle && !isGameOver) {
        // 낙하 예상 보조 수직 가이드선 선행 렌더링
        ctx.strokeStyle = 'rgba(2, 132, 199, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(currentCircle.x, currentCircle.y);
        ctx.lineTo(currentCircle.x, canvas.height);
        ctx.stroke();

        drawCircleObject(currentCircle);
    }
}

// 고양이 원형 마스킹 이미지 렌더링 헬퍼 함수
function drawCircleObject(c) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip(); // 테두리 영역 클리핑

    const img = gameImages[c.level];
    if (img && img.complete && img.naturalWidth !== 0) {
        // 이미지 종횡비 유지 원형 내부 센터 배치 스케일링 기법(크롭 일치)
        const size = c.radius * 2;
        ctx.drawImage(img, c.x - c.radius, c.y - c.radius, size, size);
    } else {
        // 이미지 로딩 지연 대비 폴백 솔리드 컬러 채우기
        ctx.fillStyle = c.color || '#cccccc';
        ctx.fill();
    }

    // 예쁜 아웃라인 테두리 마감선 추가
    ctx.restore();
    ctx.strokeStyle = c.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
    ctx.stroke();
}

async function fetchEC2Metadata() {
    const instanceIdEl = document.getElementById('meta-instance-id');
    const azEl = document.getElementById('meta-az');
    const ipEl = document.getElementById('meta-public-ip');
    const platformEl = document.getElementById('meta-platform');
    const terminalTitle = document.querySelector('.terminal-title');

    const fetchWithTimeout = async (url, options = {}, timeout = 1200) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(id);
            return response;
        } catch (error) {
            clearTimeout(id);
            throw error;
        }
    };

    try {
        const idRes = await fetchWithTimeout('/latest/meta-data/instance-id');
        const instanceId = await idRes.text();
        const azRes = await fetchWithTimeout('/latest/meta-data/placement/availability-zone');
        const az = await azRes.text();
        const ipRes = await fetchWithTimeout('/latest/meta-data/public-ipv4');
        const publicIp = await ipRes.text();

        instanceIdEl.textContent = instanceId.trim();
        azEl.textContent = az.trim();
        ipEl.textContent = publicIp.trim();
        platformEl.textContent = 'Apache/2.4.52 (Amazon Linux 2023) PHP/8.1';
        terminalTitle.innerHTML = `<span>ℹ️ ec2-metadata-status</span> <span class="metadata-badge ec2">AWS EC2 ACTIVE</span>`;
    } catch (e) {
        setTimeout(() => {
            instanceIdEl.textContent = 'i-0d5b9f71c4c1a5b82';
            azEl.textContent = 'ap-northeast-2a (Seoul)';
            ipEl.textContent = '3.38.125.82';
            platformEl.textContent = 'Local Apache Server (Simulated EC2 httpd)';
            terminalTitle.innerHTML = `<span>ℹ️ ec2-metadata-status</span> <span class="metadata-badge local">LOCAL DEV MODE</span>`;
        }, 1000);
    }
}