// js/script.js
// 前端計時器 & UI 控制
(() => {
  // DOM
  const minutesInput = document.getElementById('minutes');
  const secondsInput = document.getElementById('seconds');
  const startBtn = document.getElementById('start-btn');
  const pauseBtn = document.getElementById('pause-btn');
  // const resetBtn = document.getElementById('reset-btn');
  const timeDisplay = document.getElementById('time-display');
  const recordsList = document.getElementById('records-list');
  const openExport = document.getElementById('open-export');
  const exportModal = document.getElementById('export-modal');
  // const closeExport = document.getElementById('close-export');
  const selectRecord = document.getElementById('select-record');
  const confirmExport = document.getElementById('confirm-export');
  const yearSpan = document.getElementById('year');

  yearSpan.textContent = new Date().getFullYear();

  // state
  let totalSeconds = parseInt(secondsInput.value || 0, 10) + (parseInt(minutesInput.value || 0, 10) * 60);
  let remaining = totalSeconds;
  let timerInterval = null;
  let isRunning = false;
  const records = []; // {id, durationSec, startedAt, endedAt}

  // helpers
  function pad(n){ return String(n).padStart(2,'0') }
  function formatTime(s){
    if (s < 0) s = 0;
    const m = Math.floor(s/60);
    const sec = s % 60;
    return `${pad(m)}:${pad(sec)}`;
  }

  function updateDisplay(){
    timeDisplay.textContent = formatTime(remaining);
  }

  function enableControlsOnStart(){
    startBtn.disabled = true;
    pauseBtn.disabled = false;
    // resetBtn.disabled = false;
  }
  function enableControlsOnPause(){
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    // resetBtn.disabled = false;
  }
  function enableControlsOnReset(){
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    // resetBtn.disabled = true;
  }

  // sync inputs -> remaining
  function syncFromInputs(){
    const m = Math.max(0, parseInt(minutesInput.value || 0, 10));
    const s = Math.max(0, Math.min(59, parseInt(secondsInput.value || 0, 10)));
    totalSeconds = (m * 60) + s;
    remaining = totalSeconds;
    updateDisplay();
  }

  minutesInput.addEventListener('change', syncFromInputs);
  secondsInput.addEventListener('change', syncFromInputs);

  // Timer tick
  function tick(){
    if (remaining <= 0){
      stopTimer(true);
      return;
    }
    remaining -= 1;
    updateDisplay();
  }

  function startTimer(){
    if (isRunning) return;
    if (remaining <= 0) return;
    timerInterval = setInterval(tick, 1000);
    isRunning = true;
    enableControlsOnStart();
  }

  function pauseTimer(){
    if (!isRunning) return;
    clearInterval(timerInterval);
    timerInterval = null;
    isRunning = false;
    enableControlsOnPause();
  }

  function stopTimer(completed = false){
    // stop, record if completed
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    isRunning = false;
    if (completed){
      const now = new Date();
      const duration = totalSeconds; // original planned duration
      const rec = {
        id: 'r' + Date.now(),
        durationSec: duration,
        startedAt: new Date(now.getTime() - (duration*1000)).toISOString(),
        endedAt: now.toISOString(),
      };
      records.unshift(rec);
      renderRecords();
    }
    // reset to original totalSeconds (keep inputs)
    remaining = totalSeconds;
    updateDisplay();
    enableControlsOnReset();
  }

  function resetTimer(){
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    isRunning = false;
    remaining = totalSeconds;
    updateDisplay();
    enableControlsOnReset();
  }

  // records UI
  function renderRecords(){
    recordsList.innerHTML = '';
    selectRecord.innerHTML = '<option value="">— 無 —</option>';
    records.forEach(r => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div>
          <strong>${formatTime(r.durationSec)}</strong>
          <div class="muted">結束：${new Date(r.endedAt).toLocaleString()}</div>
        </div>
        
      `;
      recordsList.appendChild(li);

      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = `${formatTime(r.durationSec)} — ${new Date(r.endedAt).toLocaleString()}`;
      selectRecord.appendChild(opt);
    });
  }

  // open/close modal (keyboard accessible)
  function openModal(){
    exportModal.setAttribute('aria-hidden','false');
    exportModal.querySelector('.modal-content').focus();
    // trap focus lightly (simple)
    document.addEventListener('keydown', onModalKeydown);
  }
  function closeModal(){
    exportModal.setAttribute('aria-hidden','true');
    document.removeEventListener('keydown', onModalKeydown);
  }
  function onModalKeydown(e){
    if (e.key === 'Escape') closeModal();
  }

  // Bind events
  startBtn.addEventListener('click', () => {
    startTimer();
  });
  pauseBtn.addEventListener('click', () => {
    pauseTimer();
  });
  // resetBtn.addEventListener('click', () => {
  //   resetTimer();
  // });

  // Quick open timer CTA
  document.getElementById('open-timer').addEventListener('click', (e) => {
    minutesInput.focus();
  });

  document.getElementById('open-export').addEventListener('click', (e) => {
    confirmExport.focus();
  });

  // Export modal
  openExport.addEventListener('click', () => {
    openModal();
  });
  // closeExport.addEventListener('click', () => {
  //   closeModal();
  // });

  confirmExport.addEventListener('click', async () => {
    const id = selectRecord.value;
    if (!id) {
      alert('請先選擇要匯出的記錄。');
      return;
    }
    // find record
    const rec = records.find(r => r.id === id);
    if (!rec) { alert('找不到該記錄'); return; }

    // POST to backend to create Google Calendar event
    try {
      confirmExport.disabled = true;
      confirmExport.textContent = '匯出中…';
      const res = await fetch('/create-event', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          title: '超慢跑：' + formatTime(rec.durationSec),
          description: `運動記錄，由萌貓計時器建立。\n開始: ${rec.startedAt}\n結束: ${rec.endedAt}`,
          start: rec.startedAt,
          end: rec.endedAt
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert('已成功建立 Google 日曆事件！');
        closeModal();
      } else {
        // 如果後端返回需要 OAuth 跳轉的 URL，導向它（例如首次授權）
        if (data && data.authUrl) {
          // Redirect browser to Google OAuth
          window.location.href = data.authUrl;
          return;
        }
        alert('匯出失敗：' + (data && data.error ? data.error : '未知錯誤'));
      }
    } catch (err) {
      console.error(err);
      alert('網路或伺服器錯誤，請稍後再試。');
    } finally {
      confirmExport.disabled = false;
      confirmExport.textContent = '匯出到 Google 日曆';
    }
  });

  // initial
  syncFromInputs();
  updateDisplay();
  enableControlsOnReset();

  // Expose small API for testing (optional)
  window._timerApp = {
    startTimer, pauseTimer, resetTimer, records, formatTime
  };

  



  

  // --- Metronome (Web Audio API Version) ---
  const metronomeStartBtn = document.getElementById("metronome-start");
  const metronomeStopBtn = document.getElementById("metronome-stop");

  // 建立 AudioContext (這是音訊的核心)
  // 注意：瀏覽器要求 AudioContext 必須在使用者互動(點擊)後才能 Resume
  let audioContext = null;
  let audioBuffer = null;

  // 節拍設定
  let isPlaying = false;
  let tempo = 180;          // BPM
  let lookahead = 25.0;     // 每 25ms 檢查一次排程 (毫秒)
  let scheduleAheadTime = 0.1; // 預先排程未來 0.1 秒的聲音
  let nextNoteTime = 0.0;   // 下一個拍子的時間點
  let timerID = null;       // 用於 clearInterval

  // 1. 預先載入音效檔案 (解決延遲的關鍵)
  async function loadSound() {
      // 確保只建立一次 AudioContext
      if (!audioContext) {
          audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }

      // 載入你的 wav 檔案
      const response = await fetch('/metronome_out.wav');
      const arrayBuffer = await response.arrayBuffer();
      // 解碼成 AudioBuffer
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  }

  // 2. 排程函式：計算下一個拍子的時間
  function nextNote() {
      const secondsPerBeat = 60.0 / tempo;
      nextNoteTime += secondsPerBeat; // 累加時間，保證絕對精準
  }

  // 3. 播放聲音函式
  function playSample(time) {
      if (!audioBuffer) return;
      
      // 建立聲音來源
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      
      // 在精確的時間點播放
      source.start(time);
  }

  // 4. 核心迴圈：不斷檢查是否需要排程
  function scheduler() {
      // 如果下一個拍子的時間 < 目前時間 + 預判時間
      while (nextNoteTime < audioContext.currentTime + scheduleAheadTime) {
          playSample(nextNoteTime);
          nextNote();
      }
      
      // 透過 setTimeout 讓迴圈持續跑 (這裡的時間不準沒關係，因為 playSample 是靠 audioContext 時間排程的)
      timerID = setTimeout(scheduler, lookahead);
  }

  // --- 事件監聽 ---

  metronomeStartBtn.addEventListener("click", async () => {
      // 第一次點擊時初始化 AudioContext
      if (!audioContext) {
          await loadSound();
      }
      // 如果 Context 被暫停，恢復它
      if (audioContext.state === 'suspended') {
          await audioContext.resume();
      }

      if (isPlaying) return;

      isPlaying = true;
      
      // 設定第一個拍子的時間為 "現在"
      nextNoteTime = audioContext.currentTime;
      
      // 開始排程迴圈
      scheduler();

      metronomeStartBtn.disabled = true;
      metronomeStopBtn.disabled = false;
      console.log("Metronome Started at 180 BPM");
  });

  metronomeStopBtn.addEventListener("click", () => {
      isPlaying = false;
      clearTimeout(timerID);

      metronomeStartBtn.disabled = false;
      metronomeStopBtn.disabled = true;
      console.log("Metronome Stopped");
  });

  // 頁面載入時先嘗試載入聲音(選用，也可以等到點擊時再載入)
  // loadSound();

})();

