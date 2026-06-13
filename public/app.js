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
    doc, 
    setDoc, 
    getDoc, 
    deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 1. Firebase 설정 (본인의 Firebase 키로 대체하세요)
const firebaseConfig = {
    apiKey: "AIzaSyAJWI6bzgha26NWSfJaFCZ9OKoafeYqPwQ",
    authDomain: "food-and-exercise-plan.firebaseapp.com",
    projectId: "food-and-exercise-plan",
    storageBucket: "food-and-exercise-plan.firebasestorage.app",
    messagingSenderId: "363003929755",
    appId: "1:363003929755:web:dde1ad36eebd6861eb123e"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 2. 내부 데이터 상태 관리를 위한 변수
let currentUser = null;
let appData = {
    meals: [],
    workouts: []
};

// 현재 선택된 날짜 및 뷰 상태 관리
let currentDate = new Date();
let currentMenu = 'home';
let selectedEvent = null; // 수정/삭제 시 선택된 일정 객체

// 알람 타이머 변수
let alarmInterval = null;

// ==========================================
// DB 제어 함수 (핵심: 로그인 여부에 따른 분기처리)
// ==========================================

// 데이터 가져오기
async function loadData() {
    if (currentUser) {
        // [로그인 상태] Firebase Firestore에서 불러오기
        try {
            const docRef = doc(db, "users", currentUser.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                appData = docSnap.data();
                if (!appData.meals) appData.meals = [];
                if (!appData.workouts) appData.workouts = [];
            } else {
                appData = { meals: [], workouts: [] };
            }
        } catch (error) {
            console.error("Firebase 데이터 로드 실패, 로컬 데이터를 사용합니다:", error);
            loadFromLocalStorage();
        }
    } else {
        // [로그아웃 상태] 로컬 스토리지에서 불러오기
        loadFromLocalStorage();
    }
    // 데이터 로드 후 화면 갱신
    renderActivePage();
}

// 로컬스토리지 백업 로드 헬퍼
function loadFromLocalStorage() {
    const localMeals = localStorage.getItem("meals");
    const localWorkouts = localStorage.getItem("workouts");
    appData.meals = localMeals ? JSON.parse(localMeals) : [];
    appData.workouts = localWorkouts ? JSON.parse(localWorkouts) : [];
}

// 데이터 저장하기
async function saveData() {
    if (currentUser) {
        // [로그인 상태] Firebase Firestore에 저장
        try {
            await setDoc(doc(db, "users", currentUser.uid), appData);
        } catch (error) {
            console.error("Firebase 데이터 저장 실패:", error);
            alert("클라우드 저장에 실패했습니다. 브라우저에 임시 저장합니다.");
            saveToLocalStorage();
        }
    } else {
        // [로그아웃 상태] 로컬 스토리지에 저장
        saveToLocalStorage();
    }
    // 데이터 변경 후 화면 갱신
    renderActivePage();
}

// 로컬스토리지 저장 헬퍼
function saveToLocalStorage() {
    localStorage.setItem("meals", JSON.stringify(appData.meals));
    localStorage.setItem("workouts", JSON.stringify(appData.workouts));
}

// ==========================================
// 인증(Auth) 비즈니스 로직 및 UI 제어
// ==========================================

// 인증 상태 감시자 등록
onAuthStateChanged(auth, (user) => {
    const authStatusText = document.getElementById("auth-status-text");
    const loginMenuBtn = document.getElementById("login-menu-btn");
    const logoutMenuBtn = document.getElementById("logout-menu-btn");
    const deleteAccBtn = document.getElementById("delete-account-btn");

    if (user) {
        currentUser = user;
        authStatusText.textContent = `${user.email} (회원 모드)`;
        loginMenuBtn.style.display = "none";
        logoutMenuBtn.style.display = "inline-block";
        deleteAccBtn.style.display = "inline-block";
    } else {
        currentUser = null;
        authStatusText.textContent = "비회원 모드 (로컬 저장)";
        loginMenuBtn.style.display = "inline-block";
        logoutMenuBtn.style.display = "none";
        deleteAccBtn.style.display = "none";
    }
    // 상태가 변경되면 데이터를 다시 로드하고 UI 업데이트
    loadData();
});

// 회원가입
window.handleSignUp = async function() {
    const email = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value.trim();
    if (!email || !password) return alert("이메일과 비밀번호를 입력하세요.");

    try {
        await createUserWithEmailAndPassword(auth, email, password);
        alert("회원가입이 완료되었습니다!");
        closeAuthModal();
    } catch (error) {
        alert(`회원가입 실패: ${error.message}`);
    }
};

// 로그인
window.handleSignIn = async function() {
    const email = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value.trim();
    if (!email || !password) return alert("이메일과 비밀번호를 입력하세요.");

    try {
        await signInWithEmailAndPassword(auth, email, password);
        alert("로그인 성공!");
        closeAuthModal();
    } catch (error) {
        alert(`로그인 실패: ${error.message}`);
    }
};

// 로그아웃
window.handleSignOut = async function() {
    if (confirm("로그아웃 하시겠습니까? 로그아웃 시 로컬 데이터 모드로 전환됩니다.")) {
        try {
            await signOut(auth);
            alert("로그아웃 되었습니다.");
        } catch (error) {
            alert("로그아웃 실패");
        }
    }
};

// 비밀번호 찾기 (이메일 전송)
window.handleResetPassword = async function() {
    const email = document.getElementById("auth-email").value.trim();
    if (!email) return alert("비밀번호를 재설정할 이메일 주소를 먼저 입력해 주세요.");

    try {
        await sendPasswordResetEmail(auth, email);
        alert("입력하신 이메일로 비밀번호 재설정 링크를 발송했습니다.");
    } catch (error) {
        alert(`링크 전송 실패: ${error.message}`);
    }
};

// 회원 탈퇴
window.handleDeleteAccount = async function() {
    if (!currentUser) return;
    if (confirm("정말로 탈퇴하시겠습니까? 클라우드에 저장된 모든 식단/운동 데이터가 영구 삭제됩니다.")) {
        try {
            const userRef = doc(db, "users", currentUser.uid);
            await deleteDoc(userRef); // Firestore 데이터 선삭제
            await deleteUser(currentUser); // 계정 삭제
            alert("회원 탈퇴 및 데이터 삭제가 정상 처리되었습니다.");
        } catch (error) {
            alert(`탈퇴 실패 (최근 로그인하지 않은 경우 재인증이 필요할 수 있습니다): ${error.message}`);
        }
    }
};

// 모달 제어 함수들
window.openAuthModal = function() {
    document.getElementById("auth-modal").style.display = "block";
};
window.closeAuthModal = function() {
    document.getElementById("auth-modal").style.display = "none";
    document.getElementById("auth-email").value = "";
    document.getElementById("auth-password").value = "";
};

// ==========================================
// 프론트엔드 비즈니스 로직 (기존 고도화 기능 통합)
// ==========================================

// 메뉴 이동 헬퍼
window.navigateTo = function(menuName) {
    currentMenu = menuName;
    
    // 메뉴 바 활성화 스타일 처리
    document.querySelectorAll('.navbar a').forEach(el => el.classList.remove('active'));
    const activeMenuEl = document.querySelector(`.navbar a[onclick="navigateTo('${menuName}')"]`);
    if(activeMenuEl) activeMenuEl.classList.add('active');

    // 섹션 토글
    document.querySelectorAll('.page-section').forEach(el => el.style.display = 'none');
    const targetSection = document.getElementById(`${menuName}-section`);
    if(targetSection) targetSection.style.display = 'block';

    renderActivePage();
};

// 현재 탭에 맞는 렌더링 스위치
function renderActivePage() {
    if (currentMenu === 'diet') {
        renderWeeklyDietTable();
    } else if (currentMenu === 'workout') {
        renderWeeklyWorkoutTable();
    } else if (currentMenu === 'calendar') {
        renderCalendar();
    }
}

// 알람 종 아이콘 표시 헬퍼 함수
function getAlarmIcon(hasAlarm, isAlarmOn, alarmTime) {
    if (!hasAlarm) return '';
    return isAlarmOn 
        ? `<span class="alarm-icon on" title="알람 켜짐: ${alarmTime}">🔔</span>` 
        : `<span class="alarm-icon off" title="알람 꺼짐: ${alarmTime}">🔕</span>`;
}

// ------------------------------------------
// 데이터 입력 및 일정 상세 관리 (수정/삭제/날짜이동)
// ------------------------------------------

// 식단 입력 등록
window.saveNewMeal = async function(e) {
    e.preventDefault();
    const type = document.getElementById("meal-type").value;
    const menu = document.getElementById("meal-name").value.trim();
    const date = document.getElementById("meal-date").value;
    const time = document.getElementById("meal-time").value;
    const calories = parseInt(document.getElementById("meal-calories").value) || 0;
    
    const setAlarm = document.getElementById("meal-set-alarm").checked;
    const alarmTime = document.getElementById("meal-alarm-time").value;

    if(!menu || !date || !time) return alert("필수 정보를 기입해 주세요.");

    // 날짜별 식단 타입(아침, 점심 등)은 단 하나씩만 존재해야 하는 제약조건 체크
    const isDuplicate = appData.meals.some(m => m.date === date && m.type === type);
    if(isDuplicate) {
        return alert(`해당 날짜(${date})에는 이미 [${type}] 식단이 등록되어 있습니다. 기존 일정을 선택해 수정해 주세요.`);
    }

    const newMeal = {
        id: 'meal_' + Date.now(),
        type, menu, date, time, calories,
        hasAlarm: setAlarm,
        alarmOn: setAlarm,
        alarmTime: setAlarm ? alarmTime : ""
    };

    appData.meals.push(newMeal);
    await saveData();
    alert("식단 일정이 등록되었습니다.");
    document.getElementById("diet-form").reset();
};

// 운동 입력 등록
window.saveNewWorkout = async function(e) {
    e.preventDefault();
    const name = document.getElementById("workout-name").value.trim();
    const date = document.getElementById("workout-date").value;
    const startTime = document.getElementById("workout-start-time").value;
    const endTime = document.getElementById("workout-end-time").value;
    const calories = parseInt(document.getElementById("workout-calories").value) || 0;

    const setAlarm = document.getElementById("workout-set-alarm").checked;
    const alarmTime = document.getElementById("workout-alarm-time").value;

    if(!name || !date || !startTime || !endTime) return alert("필수 정보를 기입해 주세요.");

    const newWorkout = {
        id: 'workout_' + Date.now(),
        name, date, startTime, endTime, calories,
        hasAlarm: setAlarm,
        alarmOn: setAlarm,
        alarmTime: setAlarm ? alarmTime : ""
    };

    appData.workouts.push(newWorkout);
    await saveData();
    alert("운동 계획이 등록되었습니다.");
    document.getElementById("workout-form").reset();
};

// 수정 및 상세조회 모달창 오픈
window.openEditModal = function(id, category) {
    if(category === 'meal') {
        selectedEvent = { ...appData.meals.find(m => m.id === id), _category: 'meal' };
        if(!selectedEvent.id) return;

        document.getElementById("modal-title").innerText = "식단 정보 상세 및 수정";
        document.getElementById("modal-info-label").innerText = "식단 메뉴명";
        document.getElementById("modal-event-name").value = selectedEvent.menu;
        
        // 시간 배치 구조 통합 조율
        document.getElementById("modal-time-container").innerHTML = `
            <label>시간:</label>
            <input type="time" id="modal-start-time" value="${selectedEvent.time}">
        `;
    } else {
        selectedEvent = { ...appData.workouts.find(w => w.id === id), _category: 'workout' };
        if(!selectedEvent.id) return;

        document.getElementById("modal-title").innerText = "운동 정보 상세 및 수정";
        document.getElementById("modal-info-label").innerText = "운동명";
        document.getElementById("modal-event-name").value = selectedEvent.name;

        document.getElementById("modal-time-container").innerHTML = `
            <label>시작시간:</label>
            <input type="time" id="modal-start-time" value="${selectedEvent.startTime}">
            <label style="margin-left:10px;">종료시간:</label>
            <input type="time" id="modal-end-time" value="${selectedEvent.endTime}">
        `;
    }

    // 공통 필드 매핑 (날짜 수정 활성화)
    const dateInput = document.getElementById("modal-event-date");
    dateInput.value = selectedEvent.date;
    dateInput.readOnly = false;
    dateInput.style.backgroundColor = "#fff";

    document.getElementById("modal-event-calories").value = selectedEvent.calories;

    // 알람 토글 스위치 상태 렌더링
    const alarmArea = document.getElementById("modal-alarm-toggle-area");
    if(selectedEvent.hasAlarm) {
        alarmArea.style.display = "block";
        updateAlarmToggleButtonUI();
    } else {
        alarmArea.style.display = "none";
    }

    document.getElementById("edit-modal").style.display = "block";
};

// 알람 버튼 텍스트 토글 스위처 디스플레이 갱신 헬퍼
function updateAlarmToggleButtonUI() {
    const btn = document.getElementById("modal-alarm-toggle-btn");
    if(selectedEvent.alarmOn) {
        btn.innerHTML = "🔔 알람 켜짐 (끄려면 클릭)";
        btn.className = "btn-alarm-on";
    } else {
        btn.innerHTML = "🔕 알람 꺼짐 (켜려면 클릭)";
        btn.className = "btn-alarm-off";
    }
}

// 모달창 내 알람 온/오프 상태 전환 토글 이벤트
window.toggleModalAlarmState = function() {
    selectedEvent.alarmOn = !selectedEvent.alarmOn;
    updateAlarmToggleButtonUI();
};

window.closeEditModal = function() {
    document.getElementById("edit-modal").style.display = "none";
    selectedEvent = null;
};

// 일정 상세 정보 업데이트 실행 (날짜 변경 이동 로직 포함)
window.updateEventData = async function() {
    if(!selectedEvent) return;

    const newName = document.getElementById("modal-event-name").value.trim();
    const newDate = document.getElementById("modal-event-date").value;
    const newCalories = parseInt(document.getElementById("modal-event-calories").value) || 0;
    const newStartTime = document.getElementById("modal-start-time").value;

    if(!newName || !newDate || !newStartTime) return alert("빈칸을 채워주세요.");

    if(selectedEvent._category === 'meal') {
        // 날짜가 변경되었을 경우 타겟 날짜 중복 검증
        if(selectedEvent.date !== newDate) {
            const isDuplicate = appData.meals.some(m => m.date === newDate && m.type === selectedEvent.type && m.id !== selectedEvent.id);
            if(isDuplicate) return alert(`변경하려는 날짜(${newDate})에 이미 [${selectedEvent.type}] 식단이 존재합니다.`);
        }

        const idx = appData.meals.findIndex(m => m.id === selectedEvent.id);
        if(idx !== -1) {
            appData.meals[idx].menu = newName;
            appData.meals[idx].date = newDate;
            appData.meals[idx].time = newStartTime;
            appData.meals[idx].calories = newCalories;
            appData.meals[idx].alarmOn = selectedEvent.alarmOn; // 보존 토글 상태 바인딩
        }
    } else {
        const newEndTime = document.getElementById("modal-end-time").value;
        if(!newEndTime) return alert("종료 시간을 입력하세요.");

        const idx = appData.workouts.findIndex(w => w.id === selectedEvent.id);
        if(idx !== -1) {
            appData.workouts[idx].name = newName;
            appData.workouts[idx].date = newDate;
            appData.workouts[idx].startTime = newStartTime;
            appData.workouts[idx].endTime = newEndTime;
            appData.workouts[idx].calories = newCalories;
            appData.workouts[idx].alarmOn = selectedEvent.alarmOn;
        }
    }

    await saveData();
    alert("변경 사항이 저장되었습니다.");
    closeEditModal();
};

// 특정 일정 삭제 처리
window.deleteEventData = async function() {
    if(!selectedEvent) return;
    if(!confirm("이 일정을 정말로 삭제하시겠습니까?")) return;

    if(selectedEvent._category === 'meal') {
        appData.meals = appData.meals.filter(m => m.id !== selectedEvent.id);
    } else {
        appData.workouts = appData.workouts.filter(w => w.id !== selectedEvent.id);
    }

    await saveData();
    alert("일정이 완전히 지워졌습니다.");
    closeEditModal();
};

// ------------------------------------------
// 데이터 일괄 삭제 기획 (식단, 운동, 달력 탭 연동)
// ------------------------------------------

// 주간 및 전체 식단 청소 연산
window.deleteWeeklyDiet = async function() {
    if(!confirm("선택된 주의 모든 식단 데이터를 삭제하시겠습니까?")) return;
    const startOfWeek = getStartOfWeek(currentDate);
    const weekDates = [];
    for(let i=0; i<7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        weekDates.push(formatDate(d));
    }
    appData.meals = appData.meals.filter(m => !weekDates.includes(m.date));
    await saveData();
    alert("선택된 주간 범위의 식단 일정을 삭제했습니다.");
};

window.deleteAllDiet = async function() {
    if(!confirm("🚨 저장 시스템 내부의 모든 식단 데이터를 초기화하시겠습니까?")) return;
    appData.meals = [];
    await saveData();
    alert("전체 식단 데이터가 소거되었습니다.");
};

// 주간 및 전체 운동 청소 연산
window.deleteWeeklyWorkout = async function() {
    if(!confirm("선택된 주의 모든 운동 계획 데이터를 삭제하시겠습니까?")) return;
    const startOfWeek = getStartOfWeek(currentDate);
    const weekDates = [];
    for(let i=0; i<7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        weekDates.push(formatDate(d));
    }
    appData.workouts = appData.workouts.filter(w => !weekDates.includes(w.date));
    await saveData();
    alert("선택된 주간 범위의 운동 스케줄을 삭제했습니다.");
};

window.deleteAllWorkout = async function() {
    if(!confirm("🚨 저장 시스템 내부의 모든 운동 데이터를 초기화하시겠습니까?")) return;
    appData.workouts = [];
    await saveData();
    alert("전체 운동 데이터가 소거되었습니다.");
};

// 달력 기준 한달 및 원스톱 완전 청소 연산
window.deleteMonthlyEvents = async function() {
    if(!confirm(`${currentDate.getFullYear()}년 ${currentDate.getMonth()+1}월 기준의 모든 일정을 삭제합니까?`)) return;
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const filterTarget = (dateStr) => {
        const d = new Date(dateStr);
        return d.getFullYear() === year && d.getMonth() === month;
    };

    appData.meals = appData.meals.filter(m => !filterTarget(m.date));
    appData.workouts = appData.workouts.filter(w => !filterTarget(w.date));
    await saveData();
    alert("해당 월의 데이터가 정리되었습니다.");
};

window.deleteAllSystemEvents = async function() {
    if(!confirm("🚨 시스템의 전체 데이터베이스(식단 및 운동 정보 모두)를 초기화합니까?\n이 작업은 되돌릴 수 없습니다.")) return;
    appData.meals = [];
    appData.workouts = [];
    await saveData();
    alert("전체 데이터베이스 시스템이 완벽하게 초기화되었습니다.");
};

// ------------------------------------------
// 주간 식단표 / 운동표 테이블 렌더링 엔진
// ------------------------------------------

function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 월요일을 주 시작일로 설정
    return new Date(d.setDate(diff));
}

window.changeWeek = function(direction) {
    currentDate.setDate(currentDate.getDate() + direction * 7);
    renderActivePage();
};

function renderWeeklyDietTable() {
    const startOfWeek = getStartOfWeek(currentDate);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    document.getElementById("diet-week-title").innerText = `${formatDate(startOfWeek)} ~ ${formatDate(endOfWeek)} 주간 식단 리스트`;

    const types = ['아침', '점심', '저녁', '간식'];
    const tbody = document.querySelector("#weekly-diet-table tbody");
    tbody.innerHTML = "";

    types.forEach(type => {
        let tr = document.createElement("tr");
        let typeTd = document.createElement("td");
        typeTd.innerText = type;
        typeTd.style.fontWeight = 'bold';
        typeTd.style.backgroundColor = '#f9f9f9';
        tr.appendChild(typeTd);

        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            const dateStr = formatDate(d);

            let cellTd = document.createElement("td");
            cellTd.className = "clickable-cell";
            
            const meal = appData.meals.find(m => m.date === dateStr && m.type === type);
            if (meal) {
                cellTd.innerHTML = `
                    <div class="table-item-box item-meal">
                        <strong>${meal.menu}</strong><br>
                        <small>🕐 ${meal.time}</small><br>
                        <small>🔥 ${meal.calories} kcal</small>
                        ${getAlarmIcon(meal.hasAlarm, meal.alarmOn, meal.alarmTime)}
                    </div>
                `;
                cellTd.onclick = () => openEditModal(meal.id, 'meal');
            } else {
                cellTd.innerHTML = `<span class="empty-text">-</span>`;
            }
            tr.appendChild(cellTd);
        }
        tbody.appendChild(tr);
    });
}

function renderWeeklyWorkoutTable() {
    const startOfWeek = getStartOfWeek(currentDate);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    document.getElementById("workout-week-title").innerText = `${formatDate(startOfWeek)} ~ ${formatDate(endOfWeek)} 주간 운동 시간표`;

    const theadTr = document.querySelector("#weekly-workout-table thead tr");
    theadTr.innerHTML = "<th>시간 구분</th>";
    const dayNames = ['월', '화', '수', '목', '금', '토', '일'];
    
    const weekDates = [];
    for(let i=0; i<7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        weekDates.push(formatDate(d));
        
        let th = document.createElement("th");
        th.innerHTML = `${d.getMonth()+1}/${d.getDate()} (${dayNames[i]})`;
        theadTr.appendChild(th);
    }

    const tbody = document.querySelector("#weekly-workout-table tbody");
    tbody.innerHTML = "";

    // 고정 행 제목 열 제거 완료: 오직 해당 일자에 잡힌 운동 데이터 목록을 순수 정렬하여 동적 셀 배치
    let maxItems = 0;
    const dailyWorkoutsList = weekDates.map(dateStr => {
        // 시간순 정렬 알고리즘 적용
        const list = appData.workouts.filter(w => w.date === dateStr);
        list.sort((a, b) => a.startTime.localeCompare(b.startTime));
        if(list.length > maxItems) maxItems = list.length;
        return list;
    });

    if(maxItems === 0) {
        let tr = document.createElement("tr");
        let emptyTd = document.createElement("td");
        emptyTd.colSpan = 8;
        emptyTd.innerHTML = `<div style="text-align:center; padding:20px; color:#999;">이번 주에 등록된 운동 계획이 없습니다.</div>`;
        tr.appendChild(emptyTd);
        tbody.appendChild(tr);
        return;
    }

    for(let row=0; row<maxItems; row++) {
        let tr = document.createElement("tr");
        let seqTd = document.createElement("td");
        seqTd.innerText = `스케줄 ${row + 1}`;
        seqTd.style.backgroundColor = "#f9f9f9";
        seqTd.style.fontSize = "12px";
        tr.appendChild(seqTd);

        for(let col=0; col<7; col++) {
            let cellTd = document.createElement("td");
            cellTd.className = "clickable-cell";
            const item = dailyWorkoutsList[col][row];
            if(item) {
                cellTd.innerHTML = `
                    <div class="table-item-box item-workout">
                        <strong>${item.name}</strong><br>
                        <small>🕐 ${item.startTime} ~ ${item.endTime}</small><br>
                        <small>🔥 ${item.calories} kcal</small>
                        ${getAlarmIcon(item.hasAlarm, item.alarmOn, item.alarmTime)}
                    </div>
                `;
                cellTd.onclick = () => openEditModal(item.id, 'workout');
            } else {
                cellTd.innerHTML = "-";
            }
            tr.appendChild(cellTd);
        }
        tbody.appendChild(tr);
    }
}

// ------------------------------------------
// 종합 달력 (Calendar) 엔진 및 빠른 이동 제어
// ------------------------------------------

window.changeMonth = function(direction) {
    currentDate.setMonth(currentDate.getMonth() + direction);
    renderCalendar();
};

// 연도와 달 셀렉트 박스 고속 패스 전환 컴포넌트 렌더러
function renderCalendarHeaderSelectors() {
    const container = document.getElementById("calendar-year-month-container");
    container.innerHTML = "";

    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    // 연도 선택기 생성
    const yearSelect = document.createElement("select");
    yearSelect.className = "calendar-select";
    for(let y = currentYear - 10; y <= currentYear + 10; y++) {
        let opt = document.createElement("option");
        opt.value = y;
        opt.innerText = `${y}년`;
        if(y === currentYear) opt.selected = true;
        yearSelect.appendChild(opt);
    }

    // 월 선택기 생성
    const monthSelect = document.createElement("select");
    monthSelect.className = "calendar-select";
    for(let m = 0; m < 12; m++) {
        let opt = document.createElement("option");
        opt.value = m;
        opt.innerText = `${m + 1}월`;
        if(m === currentMonth) opt.selected = true;
        monthSelect.appendChild(opt);
    }

    // 체인지 이벤트 리스너 통합 바인딩
    const handleQuickMove = () => {
        currentDate.setFullYear(parseInt(yearSelect.value));
        currentDate.setMonth(parseInt(monthSelect.value));
        renderCalendar();
    };

    yearSelect.onchange = handleQuickMove;
    monthSelect.onchange = handleQuickMove;

    container.appendChild(yearSelect);
    container.appendChild(monthSelect);
}

function renderCalendar() {
    renderCalendarHeaderSelectors();

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();

    const grid = document.getElementById("calendar-grid");
    // 기저 헤더 그리드 세팅 유지 후 일자 데이터 초기화 소거
    const headers = grid.querySelectorAll(".calendar-header");
    grid.innerHTML = "";
    headers.forEach(h => grid.appendChild(h));

    // 공백 배치
    for (let i = 0; i < firstDayIndex; i++) {
        let emptyCell = document.createElement("div");
        emptyCell.className = "calendar-cell empty";
        grid.appendChild(emptyCell);
    }

    // 일자 셀 동적 렌더링 및 결합 연산
    for (let day = 1; day <= lastDay; day++) {
        let cell = document.createElement("div");
        cell.className = "calendar-cell";

        let dayNum = document.createElement("div");
        dayNum.className = "day-number";
        dayNum.innerText = day;
        cell.appendChild(dayNum);

        const targetDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        // 해당 날짜 식단 탐색 (시간순 정렬)
        const dayMeals = appData.meals.filter(m => m.date === targetDateStr);
        dayMeals.sort((a,b) => a.time.localeCompare(b.time));
        dayMeals.forEach(meal => {
            let div = document.createElement("div");
            div.className = "calendar-item cal-meal";
            div.innerHTML = `[${meal.type}] ${meal.menu} ${getAlarmIcon(meal.hasAlarm, meal.alarmOn, meal.alarmTime)}`;
            div.onclick = (e) => {
                e.stopPropagation();
                openEditModal(meal.id, 'meal');
            };
            cell.appendChild(div);
        });

        // 해당 날짜 운동 탐색 (시간순 정렬)
        const dayWorkouts = appData.workouts.filter(w => w.date === targetDateStr);
        dayWorkouts.sort((a,b) => a.startTime.localeCompare(b.startTime));
        dayWorkouts.forEach(workout => {
            let div = document.createElement("div");
            div.className = "calendar-item cal-workout";
            div.innerHTML = `💪 ${workout.name} ${getAlarmIcon(workout.hasAlarm, workout.alarmOn, workout.alarmTime)}`;
            div.onclick = (e) => {
                e.stopPropagation();
                openEditModal(workout.id, 'workout');
            };
            cell.appendChild(div);
        });

        grid.appendChild(cell);
    }
}

// ------------------------------------------
// 실시간 알람 체크 시스템 (Engine)
// ------------------------------------------
function startAlarmSystem() {
    if(alarmInterval) clearInterval(alarmInterval);
    
    alarmInterval = setInterval(() => {
        const now = new Date();
        const currentStrDate = formatDate(now);
        const currentStrTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
        
        // 초 단위가 0초일 때 분 단위 매칭 알림 실행 구조화
        if(now.getSeconds() === 0) {
            // 식단 체크
            appData.meals.forEach(meal => {
                if(meal.hasAlarm && meal.alarmOn && meal.date === currentStrDate && meal.alarmTime === currentStrTime) {
                    playAlarmNotice(`[식단 알람] 설정하신 아침/점심/저녁/간식 알림 시간입니다!\n메뉴: ${meal.menu}`);
                }
            });

            // 운동 체크
            appData.workouts.forEach(work => {
                if(work.hasAlarm && work.alarmOn && work.date === currentStrDate && work.alarmTime === currentStrTime) {
                    playAlarmNotice(`[운동 알람] 설정하신 계획된 운동 시작 스케줄 시간입니다!\n운동명: ${work.name}`);
                }
            });
        }
    }, 1000);
}

function playAlarmNotice(msg) {
    alert(msg);
    // 브라우저 내 오디오 알림 API 추가 확장 시 이 부분에 구성 커스텀 가능
}

// ------------------------------------------
// 공통 데이터 포맷터 유틸리티
// ------------------------------------------
function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// ------------------------------------------
// 애플리케이션 초기화 구동부
// ------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
    // 인풋 날짜 기본값을 오늘 날짜로 세팅
    const todayStr = formatDate(new Date());
    const dateInputs = ["meal-date", "workout-date", "meal-alarm-time", "workout-alarm-time"];
    dateInputs.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            if(el.type === 'date') el.value = todayStr;
            if(el.type === 'time') el.value = "09:00";
        }
    });

    // 실시간 백그라운드 알람 엔진 활성화
    startAlarmSystem();

    // 첫 페이지로 홈 탭 대시보드 로드
    navigateTo('home');
});
