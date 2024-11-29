const urlUserInfo = 'http://localhost:8080/user-info';

// 헤더 유저 프로필 표시
async function loadHeader() {
    try { // 세션에서 로그인 유저 정보 fetch
      const res = await fetch(urlUserInfo, { method: 'GET', credentials: 'include' });
      if (!res.ok) {
        console.log('로그인 유저 정보 fetch 오류');
      }
      const user = await res.json();  // 유저 정보 JSON 변환
      const userID = user.id;
      const username = user.username;
      const userProfileUrl = user.profile;

      // 로그인 유저 정보 표시
      document.getElementById('profile-username').innerText = username || '로그인 하세요.';
      document.getElementById('profile-image').src = userProfileUrl || '../img_src/account.jpg';
    } catch (error) {
      console.error("사용자 정보 load 오류: ", error);
    }
  }
