// ================= Firebase SDK 임포트 및 초기화 =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    sendPasswordResetEmail,
    deleteUser
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ⚠️ 여기에 본인의 Firebase 웹 앱 SDK 구성 키를 붙여넣으세요!

  const firebaseConfig = {
    apiKey: "AIzaSyAJWI6bzgha26NWSfJaFCZ9OKoafeYqPwQ",
    authDomain: "food-and-exercise-plan.firebaseapp.com",
    projectId: "food-and-exercise-plan",
    storageBucket: "food-and-exercise-plan.firebasestorage.app",
    messagingSenderId: "363003929755",
    appId: "1:363003929755:web:dde1ad36eebd6861eb123e"
  };


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ================= 영양/운동 고정형 데이터 베이스 =================
const FOOD_DATABASE = [
    { name: "공기밥", kcal: 300, carbo: 65, protein: 5, fat: 1 },
    { name: "닭가슴살(100g)", kcal: 165, carbo: 0, protein: 31, fat: 3.6 },
    { name: "사과(1개)", kcal: 100, carbo: 25, protein: 0, fat: 0 },
    { name: "계란프라이", kcal: 89, carbo: 0.4, protein: 6.2, fat: 7 }
];

const EXERCISE_DATABASE = [
    { name: "달리기", kcalPerHour: 600, intensity: "고강도" },
    { name: "걷기", kcalPerHour: 240, intensity: "저강도" },
    { name: "자전거", kcalPerHour: 480, intensity: "중강도" },
    { name: "웨이트 트레이닝", kcalPerHour: 400, intensity: "중~고강도" }
];

// ================= 전역 상태 제어 필드 =================
let currentYear = 2026;
let currentMonth = 5; 
let selectedEvent = null; 
let authMode = "login"; // "login", "signup", "find_password"

// 클라우드와 로컬 싱크용 전역 가상 메모리 변수
let userMeals = [];
let userWorkouts = [];

// ================= 인증 상태 실시간 모니터링 수신기 =================
onAuthStateChanged(auth, async (user) => {
    const statusText = document.getElementById('user-display-name');
    const authBtn = document.getElementById('btn-auth-action');
    const withdrawBtn = document.getElementById('btn-withdraw');
    const noticeBox = document.getElementById('login-required-notice');

    if (user) {
        statusText.innerText = `👤 ${user.email} 님`;
        authBtn.innerText = "로그아웃";
        withdrawBtn.style.display = 'inline-block';
        noticeBox.style.display = 'none';
        toggleInputControls(false);

        await loadUserDataFromServer(user.uid);
    } else {
        statusText.innerText = "로그인이 필요합니다.";
        authBtn.innerText = "로그인";
        withdrawBtn.style.display = 'none';
        noticeBox.style.display = 'block';
        toggleInputControls(true);
        
        userMeals = [];
        userWorkouts = [];
    }
    refreshCurrentViews();
});

function toggleInputControls(disabled) {
    document.getElementById('btn-diet-submit').disabled = disabled;
    document.getElementById('btn-workout-submit').disabled = disabled;
    document.getElementById('btn-diet-week-del').disabled = disabled;
    document.getElementById('btn-diet-all-del').disabled = disabled;
    document.getElementById('btn-work-week-del').disabled = disabled;
    document.getElementById('btn-work-all-del').disabled = disabled;
    document.getElementById('btn-cal-month-del').disabled = disabled;
    document.getElementById('btn-cal-all-del').disabled = disabled;
}

// ================= Firestore Cloud 데이터 동기화 코어 =================
async function loadUserDataFromServer(uid) {
    try {
        const userDocRef = doc(db, "users", uid);
        const docSnap = await getDoc(userDocRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            userMeals = data.meals || [];
            userWorkouts = data.workouts || [];
        } else {
            await setDoc(userDocRef, { meals: [], workouts: [] });
            userMeals = [];
            userWorkouts = [];
        }
    } catch (err) {
        console.error("데이터 동기화 실패:", err);
    }
}

async function saveUserDataToServer() {
    const user = auth.currentUser;
    if (!user) return;
    try {
        const userDocRef = doc(db, "users", user.uid);
        await setDoc(userDocRef, { meals: userMeals, workouts: userWorkouts });
    } catch (err) {
        alert("클라우드 서버에 저장하는 중 오류가 발생했습니다.");
        console.error(err);
    }
}

function getDB(key) {
    return key === 'meals' ? userMeals : userWorkouts;
}

// ================= 인증 제어 및 추가 기능 처리기 =================
window.openAuthModal = function() {
    if (auth.currentUser) {
        if (confirm("로그아웃 하시겠습니까?")) {
            signOut(auth).then(() => alert("안전하게 로그아웃되었습니다."));
        }
        return;
    }
    setAuthMode("login");
    document.getElementById('auth-modal').style.display = 'flex';
}

window.closeAuthModal = function() {
    document.getElementById('auth-modal').style.display = 'none';
    document.getElementById('auth-email').value = "";
    document.getElementById('auth-password').value = "";
}

function setAuthMode(mode) {
    authMode = mode;
    const title = document.getElementById('auth-modal-title');
    const submitBtn = document.getElementById('btn-auth-submit');
    const toggleLink = document.getElementById('auth-toggle-text');
    const passwordGroup = document.getElementById('auth-password-group');

    if (mode === "login") {
        title.innerText = "🔐 로그인";
        submitBtn.innerText = "로그인하기";
        toggleLink.innerText = "계정이 없으신가요? 회원가입하기";
        passwordGroup.style.display = "flex";
    } else if (mode === "signup") {
        title.innerText = "✨ 새 계정 회원가입";
        submitBtn.innerText = "가입하기";
        toggleLink.innerText = "이미 계정이 있으신가요? 로그인하기";
        passwordGroup.style.display = "flex";
    } else if (mode === "find_password") {
        title.innerText = "🔍 비밀번호 재설정";
        submitBtn.innerText = "초기화 이메일 전송";
        toggleLink.innerText = "로그인 화면으로 돌아가기";
        passwordGroup.style.display = "none";
    }
}

window.toggleAuthMode = function() {
    if (authMode === "login") setAuthMode("signup");
    else setAuthMode("login");
}

window.toggleFindPasswordMode = function() {
    if (authMode !== "find_password") setAuthMode("find_password");
    else setAuthMode("login");
}

// 회원인증 및 비밀번호 찾기 통합 서브밋
window.handleAuthSubmit = async function() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;

    if (!email) return alert("이메일 아이디를 입력해주세요.");

    try {
        if (authMode === "find_password") {
            // [기능 추가] 비밀번호 찾기 메일 발송 로직
            await sendPasswordResetEmail(auth, email);
            alert(`📨 '${email}' 주소로 비밀번호 재설정 이메일을 보냈습니다. 받은편지함(또는 스팸함)을 확인해주세요.`);
            setAuthMode("login");
            return;
        }

        if (!password) return alert("비밀번호를 입력해주세요.");
        if (password.length < 6) return alert("비밀번호는 6자리 이상이어야 합니다.");

        if (authMode === "signup") {
            await createUserWithEmailAndPassword(auth, email, password);
            alert("회원가입이 정상 완료되었습니다. 환영합니다!");
        } else if (authMode === "login") {
            await signInWithEmailAndPassword(auth, email, password);
            alert("성공적으로 로그인되었습니다.");
        }
        closeAuthModal();
    } catch (err) {
        console.error(err);
        if (err.code === "auth/email-already-in-use") alert("이미 등록된 이메일 아이디입니다.");
        else if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
            alert("아이디 혹은 비밀번호가 잘못되었거나 존재하지 않는 회원입니다.");
        } else if (err.code === "auth/invalid-email") alert("올바른 이메일 형식이 아닙니다.");
        else alert("인증 처리 중 오류가 발생했습니다: " + err.message);
    }
}

// [기능 추가] 회원 탈퇴 비즈니스 로직 처리기
window.handleAccountWithdrawal = async function() {
    const user = auth.currentUser;
    if (!user) return;

    const firstConfirm = confirm("⚠️ 정말로 탈퇴하시겠습니까?\n탈퇴 시 클라우드에 저장된 모든 식단 및 운동 일정 데이터가 영구 삭제되며 복구할 수 없습니다.");
    if (!firstConfirm) return;

    const secondConfirm = prompt("보안 및 데이터 일괄 삭제 확정을 위해 계정 아이디(이메일 주소)를 똑같이 입력해주세요:");
    if (secondConfirm !== user.email) {
        alert("이메일 주소가 일치하지 않아 탈퇴 처리가 취소되었습니다.");
        return;
    }

    try {
        // 1. Firestore 클라우드 데이터베이스의 개인 도큐먼트 우선 완전 삭제
        const userDocRef = doc(db, "users", user.uid);
        await deleteDoc(userDocRef);

        // 2. Authentication 인증 서버에서 해당 계정 정보 완전 삭제
        await deleteUser(user);
        
        alert("회원 탈퇴 및 데이터 삭제 처리가 완벽하게 완료되었습니다. 그동안 이용해 주셔서 감사합니다.");
    } catch (err) {
        console.error(err);
        if (err.code === "auth/requires-recent-login") {
            alert("🔒 보안을 위해 최근 로그인 기록이 필요합니다. 로그아웃 후 다시 로그인하여 탈퇴 절차를 진행해 주세요.");
        } else {
            alert("회원 탈퇴 처리 중 오류가 발생했습니다: " + err.message);
        }
    }
}

// ================= 알람 배지 아이콘 빌더 =================
function getAlarmIcon(item) {
    if (item.alarm && item.alarmOn !== false) {
        return `<span class="alarm-badge alarm-on" title="알람 켜짐: ${item.alarm}">🔔</span>`;
    } else if (item.alarm) {
        return `<span class="alarm-badge alarm-off" title="알람 꺼짐 (기록됨: ${item.alarm})">🔕</span>`;
    }
    return ''; 
}

// ================= 네비게이션 제어 =================
window.switchPage = function(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(pageId).classList.add('active');
    document.getElementById(`nav-${pageId}`).classList.add('active');

    if (pageId === 'food-info') searchFood();
    if (pageId === 'exercise-info') searchExerciseInfo();
    if (pageId === 'diet-page') renderWeeklyDiet();
    if (pageId === 'exercise-page') renderWeeklyExercise();
    if (pageId === 'calendar-page') {
        toggleCalendarSelectors(false);
        renderCalendar();
    }
}

// ================= 검색 매핑 펑션 =================
window.searchFood = function() {
    const keyword = document.getElementById('food-search').value.toLowerCase();
    const tbody = document.getElementById('food-table-body');
    tbody.innerHTML = '';
    FOOD_DATABASE.filter(f => f.name.toLowerCase().includes(keyword)).forEach(f => {
        tbody.innerHTML += `<tr><td>${f.name}</td><td>${f.kcal}</td><td>${f.carbo}</td><td>${f.protein}</td><td>${f.fat}</td></tr>`;
    });
}

window.searchExerciseInfo = function() {
    const keyword = document.getElementById('ex-search').value.toLowerCase();
    const tbody = document.getElementById('ex-table-body');
    tbody.innerHTML = '';
    EXERCISE_DATABASE.filter(e => e.name.toLowerCase().includes(keyword)).forEach(e => {
        tbody.innerHTML += `<tr><td>${e.name}</td><td>${e.kcalPerHour}</td><td>${e.intensity}</td></tr>`;
    });
}

// ================= 주간 캘린더 일자 계산 보조 함수 =================
function getWeekDates(baseDateStr) {
    const base = new Date(baseDateStr);
    const day = base.getDay(); 
    const diff = base.getDate() - day + (day === 0 ? -6 : 1); 
    const monday = new Date(base.setDate(diff));
    
    const week = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        week.push(d.toISOString().split('T')[0]);
    }
    return week;
}

// ================= 비즈니스 로직: 식단 파트 =================
window.saveDiet = async function(e) {
    e.preventDefault();
    if (!auth.currentUser) return alert("로그인 후에 데이터를 입력할 수 있습니다.");

    const date = document.getElementById('diet-date').value;
    const time = document.getElementById('diet-time').value;
    const type = document.getElementById('diet-type').value; 
    const menu = document.getElementById('diet-menu').value;
    const kcal = document.getElementById('diet-kcal').value;
    const alarm = document.getElementById('diet-alarm').value || null;

    userMeals = userMeals.filter(item => !(item.date === date && item.type === type));
    userMeals.push({ id: 'meal_' + Date.now(), type, menu, date, time, kcal: Number(kcal), alarm, alarmOn: alarm ? true : false });
    
    await saveUserDataToServer();
    alert(`[${type}] 식단이 서버에 동기화 저장되었습니다.`);
    document.getElementById('diet-form').reset();
    document.getElementById('diet-date').value = date;
    renderWeeklyDiet();
}

window.renderWeeklyDiet = function() {
    const viewDate = document.getElementById('diet-view-date').value;
    if (!viewDate) return;
    
    const weekDates = getWeekDates(viewDate);
    const headers = document.getElementById('diet-week-headers');
    const daysName = ['월', '화', '수', '목', '금', '토', '일'];
    
    headers.innerHTML = '<th>구분 (시간)</th>' + weekDates.map((d, i) => `<th>${d}<br>(${daysName[i]})</th>`).join('');
    
    const meals = getDB('meals');
    const tbody = document.getElementById('diet-timetable-body');
    tbody.innerHTML = '';

    const mealTypes = ['아침', '점심', '저녁', '간식'];
    
    mealTypes.forEach(type => {
        let row = `<tr><td><strong>${type}</strong></td>`;
        weekDates.forEach(date => {
            const found = meals.find(m => m.date === date && m.type === type);
            if (found) {
                row += `<td class="clickable-cell" onclick="openEditModal('meal', '${found.id}')" style="background-color: #e6f4ea;">[${found.time}]<br><b>${found.menu}</b> ${getAlarmIcon(found)}<br>${found.kcal}kcal</td>`;
            } else {
                row += `<td>-</td>`;
            }
        });
        row += `</tr>`;
        tbody.innerHTML += row;
    });
}

// ================= 비즈니스 로직: 운동 파트 =================
window.saveExercise = async function(e) {
    e.preventDefault();
    if (!auth.currentUser) return alert("로그인 후에 데이터를 입력할 수 있습니다.");

    const name = document.getElementById('ex-name').value;
    const date = document.getElementById('ex-date').value;
    const start = document.getElementById('ex-start').value;
    const end = document.getElementById('ex-end').value;
    const kcal = document.getElementById('ex-kcal').value;
    const alarm = document.getElementById('ex-alarm').value || null;

    userWorkouts.push({ id: 'work_' + Date.now(), name, date, start, end, kcal: Number(kcal), alarm, alarmOn: alarm ? true : false });
    
    await saveUserDataToServer();
    alert('운동 계획이 서버에 동기화 저장되었습니다.');
    document.getElementById('exercise-form').reset();
    document.getElementById('ex-date').value = date;
    renderWeeklyExercise();
}

window.renderWeeklyExercise = function() {
    const viewDate = document.getElementById('ex-view-date').value;
    if (!viewDate) return;

    const weekDates = getWeekDates(viewDate);
    const headers = document.getElementById('ex-week-headers');
    const daysName = ['월', '화', '수', '목', '금', '토', '일'];

    headers.innerHTML = weekDates.map((d, i) => `<th>${d}<br>(${daysName[i]})</th>`).join('');

    const workouts = getDB('workouts');
    const tbody = document.getElementById('ex-timetable-body');
    tbody.innerHTML = '';

    let maxItems = 0;
    const dailyMap = weekDates.map(date => {
        const list = workouts.filter(w => w.date === date).sort((a,b) => a.start.localeCompare(b.start));
        if (list.length > maxItems) maxItems = list.length;
        return list;
    });

    if (maxItems === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="color:#9ca3af; padding:2rem;">등록된 운동 계획이 없습니다.</td></tr>`;
        return;
    }

    for (let i = 0; i < maxItems; i++) {
        let row = `<tr>`;
        for (let j = 0; j < 7; j++) {
            const item = dailyMap[j][i];
            if (item) {
                row += `<td class="clickable-workout-cell" onclick="openEditModal('workout', '${item.id}')" style="background-color: #e8f0fe;">⏰ ${item.start}~${item.end}<br><b>${item.name}</b> ${getAlarmIcon(item)}<br>${item.kcal}kcal</td>`;
            } else {
                row += `<td>-</td>`;
            }
        }
        row += `</tr>`;
        tbody.innerHTML += row;
    }
}

// ================= 비즈니스 로직: 종합 달력 파트 =================
const weekDaysList = ['일', '월', '화', '수', '목', '금', '토'];

window.renderCalendar = function() {
    document.getElementById('calendar-month-year').innerText = `${currentYear}년 ${String(currentMonth + 1).padStart(2, '0')}월`;
    
    document.getElementById('select-year').value = currentYear;
    document.getElementById('select-month').value = currentMonth;

    const headerGrid = document.getElementById('calendar-grid-header');
    headerGrid.innerHTML = weekDaysList.map(w => `<div class="calendar-header">${w}</div>`).join('');

    const daysContainer = document.getElementById('calendar-days');
    daysContainer.innerHTML = '';

    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const lastDate = new Date(currentYear, currentMonth + 1, 0).getDate();

    const meals = getDB('meals');
    const workouts = getDB('workouts');

    for (let i = 0; i < firstDayIndex; i++) {
        daysContainer.innerHTML += `<div class="calendar-day" style="background:#f3f4f6;"></div>`;
    }

    for (let day = 1; day <= lastDate; day++) {
        const hypenDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        const dayMeals = meals.filter(m => m.date === hypenDateStr).sort((a,b)=>a.time.localeCompare(b.time));
        const dayWorkouts = workouts.filter(w => w.date === hypenDateStr).sort((a,b)=>a.start.localeCompare(b.start));

        let tagsHtml = '';
        dayMeals.forEach(m => {
            tagsHtml += `<div class="event-tag tag-meal" onclick="event.stopPropagation(); openEditModal('meal', '${m.id}')">[${m.time}] ${m.type}:${m.menu} ${getAlarmIcon(m)}</div>`;
        });
        dayWorkouts.forEach(w => {
            tagsHtml += `<div class="event-tag tag-workout" onclick="event.stopPropagation(); openEditModal('workout', '${w.id}')">[${w.start}] ${w.name} ${getAlarmIcon(w)}</div>`;
        });

        daysContainer.innerHTML += `
            <div class="calendar-day">
                <span class="day-num">${day}</span>
                <div>${tagsHtml}</div>
            </div>
        `;
    }
}

window.changeMonth = function(val) {
    currentMonth += val;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar();
}

window.toggleCalendarSelectors = function(show) {
    const textContainer = document.getElementById('calendar-month-year');
    const selectBox = document.getElementById('calendar-select-box');
    if (show) {
        textContainer.style.display = 'none';
        selectBox.style.display = 'flex';
    } else {
        textContainer.style.display = 'block';
        selectBox.style.display = 'none';
    }
}

window.handleSelectDateChange = function() {
    currentYear = parseInt(document.getElementById('select-year').value);
    currentMonth = parseInt(document.getElementById('select-month').value);
    renderCalendar();
}

function initSelectOptions() {
    const sYear = document.getElementById('select-year');
    const sMonth = document.getElementById('select-month');
    
    sYear.innerHTML = '';
    for(let y = 2020; y <= 2035; y++) {
        sYear.innerHTML += `<option value="${y}">${y}년</option>`;
    }
    sMonth.innerHTML = '';
    for(let m = 0; m < 12; m++) {
        sMonth.innerHTML += `<option value="${m}">${m+1}월</option>`;
    }
}

// ================= 그룹 삭제 제어 로직 =================
window.deleteWeeklyData = async function(key) {
    const inputId = key === 'meals' ? 'diet-view-date' : 'ex-view-date';
    const viewDate = document.getElementById(inputId).value;
    if (!viewDate) return alert('기준 날짜를 먼저 선택해 주세요.');

    if (!confirm('선택한 주간의 모든 일정을 삭제하시겠습니까?')) return;

    const weekDates = getWeekDates(viewDate);
    if (key === 'meals') {
        userMeals = userMeals.filter(item => !weekDates.includes(item.date));
    } else {
        userWorkouts = userWorkouts.filter(item => !weekDates.includes(item.date));
    }

    await saveUserDataToServer();
    alert('해당 주간의 일정이 삭제되었습니다.');
    refreshCurrentViews();
}

window.clearAllData = async function(key) {
    const typeNm = key === 'meals' ? '식단' : '운동 계획';
    if (!confirm(`저장된 모든 [${typeNm}] 데이터를 초기화하시겠습니까?`)) return;
    
    if (key === 'meals') userMeals = [];
    else userWorkouts = [];

    await saveUserDataToServer();
    alert(`모든 ${typeNm} 데이터가 완전히 삭제되었습니다.`);
    refreshCurrentViews();
}

window.deleteMonthlyData = async function() {
    if (!confirm(`${currentYear}년 ${currentMonth + 1}월의 모든 식단 및 운동 일정을 삭제하시겠습니까?`)) return;

    const prefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    
    userMeals = userMeals.filter(m => !m.date.startsWith(prefix));
    userWorkouts = userWorkouts.filter(w => !w.date.startsWith(prefix));

    await saveUserDataToServer();
    alert(`${currentMonth + 1}월의 일정이 전부 정리되었습니다.`);
    refreshCurrentViews();
}

window.clearAllCalendarData = async function() {
    if (!confirm('시스템에 저장된 모든 식단 및 운동 데이터를 삭제하시겠습니까?')) return;

    userMeals = [];
    userWorkouts = [];

    await saveUserDataToServer();
    alert('전체 데이터가 초기화되었습니다.');
    refreshCurrentViews();
}

// ================= 일정 수정/삭제 모달 제어 함수 =================
window.openEditModal = function(type, id) {
    selectedEvent = { type, id };
    
    const modalDate = document.getElementById('modal-date');
    const modalTimeStart = document.getElementById('modal-time-start');
    const modalTimeEnd = document.getElementById('modal-time-end');
    const modalName = document.getElementById('modal-name');
    const modalKcal = document.getElementById('modal-kcal');
    const modalAlarmTime = document.getElementById('modal-alarm-time');
    
    const timeEndContainer = document.getElementById('modal-time-end-container');
    const labelTime = document.getElementById('modal-label-time');
    const labelName = document.getElementById('modal-label-name');
    const btnToggle = document.getElementById('btn-toggle-alarm');

    let item;
    if (type === 'meal') {
        item = userMeals.find(m => m.id === id);
        if(!item) return;

        document.getElementById('modal-title').innerText = `✏️ 식단 정보 상세`;
        labelTime.innerText = "식사 시간";
        labelName.innerText = "메뉴명";
        timeEndContainer.style.display = 'none';
        
        modalTimeStart.value = item.time;
        modalName.value = item.menu;
    } else {
        item = userWorkouts.find(w => w.id === id);
        if(!item) return;

        document.getElementById('modal-title').innerText = `✏️ 운동 일정 상세`;
        labelTime.innerText = "시작 시간";
        labelName.innerText = "운동명";
        timeEndContainer.style.display = 'flex';
        
        modalTimeStart.value = item.start;
        modalTimeEnd.value = item.end;
        modalName.value = item.name;
    }

    modalDate.value = item.date;
    modalKcal.value = item.kcal;
    modalAlarmTime.value = item.alarm || "";

    if (!item.alarm) {
        btnToggle.style.display = 'none'; 
    } else {
        btnToggle.style.display = 'block';
        if (item.alarmOn !== false) {
            btnToggle.innerText = "🔕 알람 끄기";
            btnToggle.style.background = "#6b7280";
        } else {
            btnToggle.innerText = "🔔 알람 켜기";
            btnToggle.style.background = "#f59e0b";
        }
    }

    document.getElementById('edit-modal').style.display = 'flex';
}

window.closeModal = function() {
    document.getElementById('edit-modal').style.display = 'none';
    selectedEvent = null;
}

window.updateEventData = async function() {
    if (!selectedEvent) return;

    const newDate = document.getElementById('modal-date').value;
    const timeStart = document.getElementById('modal-time-start').value;
    const name = document.getElementById('modal-name').value;
    const kcal = Number(document.getElementById('modal-kcal').value);
    const alarm = document.getElementById('modal-alarm-time').value || null;

    if(!newDate || !timeStart || !name) {
        alert('필수 입력 항목(날짜, 시간, 명칭)을 채워주세요.');
        return;
    }

    if (selectedEvent.type === 'meal') {
        const item = userMeals.find(m => m.id === selectedEvent.id);
        if (item) {
            item.date = newDate;
            item.time = timeStart;
            item.menu = name;
            item.kcal = kcal;
            if (item.alarm !== alarm) {
                item.alarm = alarm;
                item.alarmOn = alarm ? true : false;
            }
        }
    } else {
        const timeEnd = document.getElementById('modal-time-end').value;
        const item = userWorkouts.find(w => w.id === selectedEvent.id);
        if (item) {
            item.date = newDate;
            item.start = timeStart;
            item.end = timeEnd;
            item.name = name;
            item.kcal = kcal;
            if (item.alarm !== alarm) {
                item.alarm = alarm;
                item.alarmOn = alarm ? true : false;
            }
        }
    }

    await saveUserDataToServer();
    alert('수정 사항이 서버에 안전하게 업데이트되었습니다.');
    closeModal();
    refreshCurrentViews();
}

window.toggleAlarmActive = async function() {
    if (!selectedEvent) return;

    if (selectedEvent.type === 'meal') {
        const item = userMeals.find(m => m.id === selectedEvent.id);
        if (item && item.alarm) {
            item.alarmOn = (item.alarmOn === false) ? true : false;
            alert(item.alarmOn ? `⏰ ${item.alarm} 알람이 켜졌습니다.` : `🔕 알람 정보(${item.alarm})를 유지한 채 알람을 껐습니다.`);
        }
    } else {
        const item = userWorkouts.find(w => w.id === selectedEvent.id);
        if (item && item.alarm) {
            item.alarmOn = (item.alarmOn === false) ? true : false;
            alert(item.alarmOn ? `⏰ ${item.alarm} 알람이 켜졌습니다.` : `🔕 알람 정보(${item.alarm})를 유지한 채 알람을 껐습니다.`);
        }
    }
    
    await saveUserDataToServer();
    openEditModal(selectedEvent.type, selectedEvent.id);
    refreshCurrentViews();
}

window.deleteEventData = async function() {
    if (!selectedEvent) return;
    if (!confirm('정말로 이 일정을 삭제하시겠습니까?')) return;

    if (selectedEvent.type === 'meal') {
        userMeals = userMeals.filter(m => m.id !== selectedEvent.id);
    } else {
        userWorkouts = userWorkouts.filter(w => w.id !== selectedEvent.id);
    }

    await saveUserDataToServer();
    alert('일정이 완전히 삭제되었습니다.');
    closeModal();
    refreshCurrentViews();
}

function refreshCurrentViews() {
    renderWeeklyDiet();
    renderWeeklyExercise();
    renderCalendar();
}

// ================= 실시간 알람 확인 시스템 =================
setInterval(() => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${hh}:${mm}`;
    const todayStr = now.toISOString().split('T')[0]; 

    userMeals.forEach(m => {
        if (m.date === todayStr && m.alarm === currentTimeStr && m.alarmOn !== false) {
            alert(`🚨 [식단 알림] ${m.type} 시간입니다!\n메뉴: ${m.menu}을(를) 챙겨 드세요!`);
            m.alarmOn = false; 
            saveUserDataToServer();
            refreshCurrentViews();
        }
    });

    userWorkouts.forEach(w => {
        if (w.date === todayStr && w.alarm === currentTimeStr && w.alarmOn !== false) {
            alert(`🚨 [운동 알림] 계획된 운동 시간입니다!\n운동명: ${w.name}을(를) 시작하세요!`);
            w.alarmOn = false; 
            saveUserDataToServer();
            refreshCurrentViews();
        }
    });
}, 60000); 

// 최초 로드 초기화
window.addEventListener('DOMContentLoaded', () => {
    const today = "2026-06-13"; 
    document.getElementById('diet-date').value = today;
    document.getElementById('diet-view-date').value = today;
    document.getElementById('ex-date').value = today;
    document.getElementById('ex-view-date').value = today;
    
    initSelectOptions(); 
    switchPage('food-info');
});
