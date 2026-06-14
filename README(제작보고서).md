"# food-and-exercise-plan" 

제미나이로 코드 작성했습니다.
프롬프트는 다음과 같습니다.

1.
/my-health-app
├── server.js              # 백엔드: API 서버 및 CSV 데이터 로드
├── public/
│   ├── index.html         # 메인 UI (달력 및 메뉴) └── app.js             # 프론트엔드 로직 (검색, 데이터 처리)

2.
/diet_p
├── server.js              # 백엔드: API 서버 및 CSV 데이터 로드
├── public/
│   ├── index.html         # 메인 UI (달력 및 메뉴)
        └── app.js             # 프론트엔드 로직 (검색, 데이터 처리)

3.
식단 입력과 운동 입력할때 알람 설정도 추가하고 알람이 켜져있는지 아닌 아이콘으로 표시해

4.
일정을 선택하면 수정, 삭제하는 기능 추가

5.
운동표에서 시간순으로 출력하되 표에서 시간순 정렬1 정렬2 이런건 출력하지 않게 해, 알람을 저장했다면 끄더라도 알람시간정보가 남게 하고 켜기끄기 버튼을 만들어, 정보 수정 사항 저장이라는 텍스트로 하지 말고 저장으로 바꿔

6."1. 식단 입력" 을 "식단 입력" 으로 바꾸기

"2. 주간 식단표 출력 (클릭 시 수정/삭제 가능)" 을 "주간 식단표 (일정 클릭 시 수정/삭제 가능)" 으로 바꾸기

"1. 운동 계획 입력" 을 "운동 계획 입력"으로 바꾸기

"2. 주간 운동표 (클릭 시 수정/삭제 가능)" 을 "주간 운동표 (일정 클릭 시 수정/삭제 가능)" 으로 바꾸기 

운동표 메뉴와 식단표메뉴에서 주간 일정 삭제 버튼과 전체 일정 삭제 버튼 만들기

달력에서 한달 일정 삭제 버튼과 전체 일정 삭제 버튼 만들기

달력에서 년도와 달을 표시하는 텍스트를 누르면 달을 선택해서 출력하는 달 변경 기능 추가

6.
일정 날짜 수정 가능하게 해

7.
전체 코드

8.
데이터 저장 위치

9.
프로젝트 폴더 구조

10.
깃허브와 vercel 이용한 배포

11.
안전하게 데이터 베이스를 저장하는 방법

12.
Firebase Firestore로 데이터 저장을 변경하고 아이디와  비밀번호로 회원 가입기능으로 코드 수정

13.
프로젝트 구조

14.
비밀번호 찾기, 탈퇴 기능 추가

코드리뷰


1. Firestore 클라우드 데이터 동기화:
앱의 데이터를 서버에 저장하고 불러오는 핵심 로직입니다.

// 서버에서 사용자 데이터를 불러와 전역 변수에 할당
async function loadUserDataFromServer(uid) {
    try {
        const userDocRef = doc(db, "users", uid); // users 컬렉션 내 해당 유저 문서 참조
        const docSnap = await getDoc(userDocRef); // 데이터 읽기 요청
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            userMeals = data.meals || []; // 식단 데이터 할당
            userWorkouts = data.workouts || []; // 운동 데이터 할당
        } else {
            // 처음 가입한 유저라면 빈 배열로 문서 초기화
            await setDoc(userDocRef, { meals: [], workouts: [] });
        }
    } catch (err) {
        console.error("데이터 동기화 실패:", err);
    }
}

// 로컬 변수(userMeals, userWorkouts)를 서버에 저장
async function saveUserDataToServer() {
    const user = auth.currentUser;
    if (!user) return;
    try {
        const userDocRef = doc(db, "users", user.uid);
        // 전체 데이터를 덮어써서 최신 상태 유지 (데이터 무결성 관리)
        await setDoc(userDocRef, { meals: userMeals, workouts: userWorkouts });
    } catch (err) {
        alert("서버 저장 실패");
    }
}


2. 일정 관리 (CRUD 로직):
식단이나 운동을 추가할 때 ID를 부여하고, 수정/삭제 시 해당 ID를 찾아 처리합니다.

// 새로운 식단 추가 로직
window.saveDiet = async function(e) {
    e.preventDefault();
    // 데이터 객체 생성: Date.now()로 고유 ID를 만들어 충돌 방지
    const newMeal = { 
        id: 'meal_' + Date.now(), 
        type, menu, date, time, 
        kcal: Number(kcal), 
        alarm, 
        alarmOn: alarm ? true : false 
    };
    userMeals.push(newMeal); // 로컬 배열에 추가
    await saveUserDataToServer(); // 서버와 싱크
    renderWeeklyDiet(); // UI 업데이트
}

// 일정 수정 로직 (모달에서 저장 버튼 클릭 시)
window.updateEventData = async function() {
    if (!selectedEvent) return;
    // selectedEvent.id를 사용해 배열 내 해당 객체 찾기
    const item = userMeals.find(m => m.id === selectedEvent.id);
    if (item) {
        // 객체 내부 속성을 갱신 (참조에 의한 수정)
        item.date = document.getElementById('modal-date').value;
        item.menu = document.getElementById('modal-name').value;
        // ... 나머지 속성 업데이트
    }
    await saveUserDataToServer(); // 수정본 서버 저장
}


3. 자동 알람 확인 시스템:
매 1분마다 사용자의 일정과 현재 시간을 비교합니다.
setInterval(() => {
    const now = new Date();
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const todayStr = now.toISOString().split('T')[0]; 

    // 식단 배열 전체를 확인
    userMeals.forEach(m => {
        // 1. 날짜가 오늘인가? 2. 설정한 알람 시간인가? 3. 알람이 켜져 있는가?
        if (m.date === todayStr && m.alarm === currentTimeStr && m.alarmOn !== false) {
            alert(`🚨 [식단 알림] ${m.type} 시간입니다! 메뉴: ${m.menu}`);
            m.alarmOn = false; // 알람 중복 발생을 막기 위해 끔
            saveUserDataToServer(); // 알람 상태 서버에 기록
            refreshCurrentViews(); // UI 갱신 (배지 업데이트)
        }
    });
}, 60000); // 60,000ms = 1분 주기

4. 인증 상태 모니터링:
사용자가 로그인했는지, 로그아웃했는지에 따라 앱의 동작을 제어합니다.

onAuthStateChanged(auth, async (user) => {
    if (user) {
        // 로그인 성공: 버튼 텍스트 변경 및 서버에서 데이터 불러오기
        toggleInputControls(false); // 입력창 잠금 해제
        await loadUserDataFromServer(user.uid);
    } else {
        // 로그아웃 상태: 모든 데이터 초기화 및 UI 잠금
        userMeals = [];
        userWorkouts = [];
        toggleInputControls(true); // 입력창 비활성화
    }
    refreshCurrentViews(); // 로그인 상태에 따라 달력/식단표 즉시 갱신
});
