function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

let allCandidates = [];
let realAccountMap = {};
let winners = [];

function renderAllResults({ winners = [], duplicateAuthors = {}, duplicateNumbers = {} }) {
  const resultTitle = document.getElementById("resultTitle");
  const resultBox = document.getElementById("result");
  const winnersBox = document.getElementById("winners");
  const duplicateAuthorsTitle = document.getElementById("duplicateAuthorsTitle");
  const duplicateAuthorsBox = document.getElementById("duplicateAuthors");
  const duplicateNumbersTitle = document.getElementById("duplicateNumbersTitle");
  const duplicateNumbersBox = document.getElementById("duplicateNumbers");

  if (resultTitle) {
    resultTitle.textContent = `留言清單（共 ${allCandidates.length} 位，含無效留言）`;
  }

  resultBox.innerHTML = "";
  allCandidates.forEach((m) => {
    const div = document.createElement("div");
    div.style.marginBottom = "8px";
    div.style.paddingBottom = "8px";
    div.style.borderBottom = "1px solid #ccc";  // 加分隔線
    div.style.display = "flex";
    div.style.justifyContent = "space-between";
    div.style.alignItems = "center";
    div.style.gap = "10px";

    const span = document.createElement("span");
    span.textContent = `${m.author}: ${m.content}`;
    span.style.flex = "1";
    span.style.whiteSpace = "pre-wrap"; // 若內容太長可自動換行


    const delBtn = document.createElement("button");
    delBtn.textContent = "刪除";
    delBtn.style.padding = "2px 8px";
    delBtn.style.fontSize = "12px";
    delBtn.style.backgroundColor = "#f44336";
    delBtn.style.color = "white";
    delBtn.style.border = "none";
    delBtn.style.borderRadius = "4px";
    delBtn.style.cursor = "pointer";

    delBtn.addEventListener("click", () => {
      const index = allCandidates.findIndex(c => c.author === m.author && c.content === m.content);
      if (index !== -1) {
        allCandidates.splice(index, 1);
        refreshAfterDelete();
      }
    });

    div.appendChild(span);
    div.appendChild(delBtn);
    resultBox.appendChild(div);
  });

  winnersBox.innerHTML = "";
  if (winners.length > 0) {
    winners.forEach(w => {
      const li = document.createElement("li");
      li.textContent = `${w.nickname} - ${w.keyword}${w.number}`;
      winnersBox.appendChild(li);
    });
  } else {
    const li = document.createElement("li");
    li.textContent = "（未執行抽獎，只分析留言）";
    winnersBox.appendChild(li);
  }

  // ===== 重複帳號留言 =====

  duplicateAuthorsBox.innerHTML = "";
  if (duplicateAuthors && Object.keys(duplicateAuthors).length > 0) {
    duplicateAuthorsTitle.textContent = `重複帳號留言清單（共 ${Object.keys(duplicateAuthors).length} 位）`;
    for (const [realId, data] of Object.entries(duplicateAuthors)) {
      const nickname = data.nickname || realId;
      const msgs = data.messages || [];
      const nums = msgs.map(m => `${m.keyword}${m.number}`);
      const div = document.createElement("div");
      div.textContent = `${nickname} (${nums.join(", ")})`;
      duplicateAuthorsBox.appendChild(div);
    }
  } else {
    duplicateAuthorsTitle.textContent = "重複帳號留言清單";
    duplicateAuthorsBox.textContent = "無重複留言帳號";
  }

  // ===== 重複推號 =====
  duplicateNumbersBox.innerHTML = "";
  if (duplicateNumbers && Object.keys(duplicateNumbers).length > 0) {
    duplicateNumbersTitle.textContent = `重複推號留言清單（共 ${Object.keys(duplicateNumbers).length} 位）`;
    for (const [number, msgs] of Object.entries(duplicateNumbers)) {
      msgs.forEach(m => {
        const div = document.createElement("div");
        div.textContent = `${m.nickname} - ${m.keyword}${number}`;
        duplicateNumbersBox.appendChild(div);
      });
    }
  } else {
    duplicateNumbersTitle.textContent = "重複推號留言清單";
    duplicateNumbersBox.textContent = "無重複推號留言";
  }

  // 儲存到 localStorage
  const saveData = {
    rawKeywords: document.getElementById("keyword").value.trim(),
    drawCount: parseInt(document.getElementById("drawCount").value) || 0,
    keywordPosition: document.getElementById("keywordPosition").value,
    dupMode: document.getElementById("dupMode").value,
    allCandidates,
    realAccountMap,
    winners,
    duplicateAuthors,
    duplicateNumbers,
  };
  localStorage.setItem("drawResults", JSON.stringify(saveData));
}

function refreshAfterDelete() {
  const finalMessages = applyRealId();
  const { allAuthorsMessages, duplicateAuthors } = analyzeDuplicates(finalMessages);
  const dupMode = document.getElementById("dupMode").value;
  const filteredCandidates = filterByDupMode(finalMessages, allAuthorsMessages, dupMode);
  const { duplicateNumbers } = filterUniqueNumbers(filteredCandidates);

  // ✅ 不重新抽籤，只更新畫面
  renderAllResults({
    winners,
    duplicateAuthors: Object.fromEntries(duplicateAuthors),
    duplicateNumbers: Object.fromEntries(duplicateNumbers)
  });
}

// 重設所有結果區與標題
function resetUI() {
  const resultTitle = document.getElementById("resultTitle");
  const resultBox = document.getElementById("result");
  const winnersBox = document.getElementById("winners");
  const duplicateAuthorsTitle = document.getElementById("duplicateAuthorsTitle");
  const duplicateAuthorsBox = document.getElementById("duplicateAuthors");
  const duplicateNumbersTitle = document.getElementById("duplicateNumbersTitle");
  const duplicateNumbersBox = document.getElementById("duplicateNumbers");

  if (resultTitle) resultTitle.textContent = "留言清單";
  if (resultBox) resultBox.textContent = "";
  if (winnersBox) winnersBox.innerHTML = "";
  if (duplicateAuthorsTitle) duplicateAuthorsTitle.textContent = "重複帳號留言清單";
  if (duplicateAuthorsBox) duplicateAuthorsBox.innerHTML = "";
  if (duplicateNumbersTitle) duplicateNumbersTitle.textContent = "重複推號留言清單";
  if (duplicateNumbersBox) duplicateNumbersBox.innerHTML = "";
}

function loadSavedResults() {
  const savedDataStr = localStorage.getItem("drawResults");
  if (!savedDataStr) return;

  try {
    const data = JSON.parse(savedDataStr);
    const {
      rawKeywords,
      drawCount,
      keywordPosition,
      dupMode,
      allCandidates: loaded_all,
      realAccountMap: loaded_real,
      winners,
      duplicateAuthors,
      duplicateNumbers
    } = data;

    allCandidates = loaded_all;
    realAccountMap = loaded_real;

    const keywordInput = document.getElementById("keyword");
    const keywordPositionSelect = document.getElementById("keywordPosition");
    const drawCountInput = document.getElementById("drawCount");
    const dupModeInput = document.getElementById("dupMode");

    if (keywordInput && rawKeywords) keywordInput.value = rawKeywords;
    if (drawCountInput && typeof drawCount === "number") drawCountInput.value = drawCount;
    if (keywordPositionSelect && keywordPosition) keywordPositionSelect.value = keywordPosition;
    if (dupModeInput && dupMode) dupModeInput.value = dupMode;

    renderAllResults({ 
      winners,
      duplicateAuthors,
      duplicateNumbers,
    });
  } catch (e) {
    console.warn("無法讀取儲存的抽籤結果", e);
  }
}

window.addEventListener("load", loadSavedResults);

// 清空按鈕事件
document.getElementById("clearBtn").addEventListener("click", () => {
  // 只重設結果畫面，不清除欄位設定
  resetUI();

  // 清除畫面用資料，但保留設定欄位
  const rawKeywords = document.getElementById("keyword").value.trim();
  const drawCount = parseInt(document.getElementById("drawCount").value) || 0;
  const keywordPosition = document.getElementById("keywordPosition").value;
  const dupMode = document.getElementById("dupMode").value;

  // 清空資料
  allCandidates = [];
  realAccountMap = {};
  winners = [];

  // 更新 localStorage，但保留設定
  const saveData = {
    rawKeywords,
    drawCount,
    keywordPosition,
    dupMode,
    allCandidates: [],
    realAccountMap: [],
    winners: [],
    duplicateAuthors: [],
    duplicateNumbers: [],
  };
  localStorage.setItem("drawResults", JSON.stringify(saveData));
});

function applyRealId() {
  return allCandidates.map(m => {
    const key = `${m.author}___${m.usernameHTML}___${m.content}`;
    const realid = realAccountMap[key] || m.author;
    const { author, ...rest } = m; // 先用解構去除 author
    return {
      ...rest,
      nickname: m.author,
      realid: realid,
    };
  });
}

function analyzeDuplicates(messages) {
  const allAuthorsMessages = new Map(); // 根據真帳號ID分組留言
  const duplicateAuthors = new Map(); // 有重複留言（留言數 > 1）的帳號

  messages.forEach(m => {
    const id = m.realid;  // 用 realid 當 key
    if (!allAuthorsMessages.has(id)) allAuthorsMessages.set(id, []);
    allAuthorsMessages.get(id).push(m);
  });

  allAuthorsMessages.forEach((msgs, realid) => {
    if (msgs.length > 1) {
      const nickname = msgs[0].nickname;
      duplicateAuthors.set(realid, {
        nickname,
        messages: msgs
      });
    }
  });

  return { allAuthorsMessages, duplicateAuthors };
}

function filterByDupMode(messages, allAuthorsMessages, mode) {
  if (mode === "allow") return messages;

  const seen = new Set();
  const result = [];

  messages.forEach(m => {
    const isDuplicate = allAuthorsMessages.get(m.realid)?.length > 1;

    if (mode === "keepFirst" && !seen.has(m.realid)) {
      result.push(m);
      seen.add(m.realid);
    } else if (mode === "exclude" && !isDuplicate) {
      result.push(m);
    }
  });

  return result;
}

function filterUniqueNumbers(candidates) {
  const seenNumbers = new Set();
  const unique = [];
  const duplicateNumbers = new Map();

  candidates.forEach(c => {
    if (seenNumbers.has(c.number)) {
      if (!duplicateNumbers.has(c.number)) duplicateNumbers.set(c.number, []);
      duplicateNumbers.get(c.number).push(c);
    } else {
      seenNumbers.add(c.number);
      unique.push(c);
    }
  });

  return { uniqueNumberCandidates: unique, duplicateNumbers };
}


function drawWinners(pool, count) {
  const result = [...pool]; // 複製
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return count > 0 ? result.slice(0, Math.min(count, pool.length)) : [];
}



// 抓取按鈕事件
document.getElementById("fetchBtn").addEventListener("click", async () => {
  resetUI();

  const resultBox = document.getElementById("result");
  const winnersBox = document.getElementById("winners");
  const duplicateAuthorsBox = document.getElementById("duplicateAuthors");
  const duplicateNumbersBox = document.getElementById("duplicateNumbers");

  winnersBox.innerHTML = "";
  duplicateAuthorsBox.innerHTML = "";
  duplicateNumbersBox.innerHTML = "";
  resultBox.textContent = "";

  resultBox.textContent = "自動滾動載入留言中，請稍候...";

  const rawKeywords  = document.getElementById("keyword").value.trim();
  const dupMode = document.getElementById("dupMode").value; // exclude | keepFirst | allow

  if (!rawKeywords ) {
    alert("請輸入關鍵詞");
    return;
  }

  const keywords = rawKeywords.split(",").map(k => k.trim()).filter(Boolean);
  // const escapedKeyword = escapeRegExp(keyword);
  const keywordPosition = document.getElementById("keywordPosition").value;

  const patterns = keywords.map(kw => {
    const escaped = escapeRegExp(kw);
    if (keywordPosition === "front") {
      return { kw, regex: new RegExp(`(?:^|\\s)${escaped}(\\d+)`) };
    } else if (keywordPosition === "back") {
      return { kw, regex: new RegExp(`(?:^|\\s)(\\d+)${escaped}`) };
    } else {
      return { kw, regex: new RegExp(`(?:^|\\s)(?:${escaped}(\\d+)|(\\d+)${escaped})`) };
    }
  });

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    function scrollAndCollectMessages() {
      const delay = ms => new Promise(r => setTimeout(r, ms));
      const scrollBox = document.querySelector('[data-list-id="chat-messages"]')?.closest('[role="group"]');
      if (!scrollBox) return [];

      const seenKeys = new Set();
      const collected = [];

      function grabMessages() {
        const items = document.querySelectorAll('li[id^="chat-messages-"]');
        const newMsgs = [];
        items.forEach(item => {
          const contentContainer = item.querySelector('[class^="contents_"]');
          const usernameEl = contentContainer?.querySelector('[class^="username_"]');
          const contentEl = contentContainer?.querySelector('[id*="message-content-"]')?.childNodes[0];
          if (!usernameEl || !contentEl) return;

          const author = usernameEl.textContent.trim();
          const content = contentEl.childNodes[0]?.textContent.trim();
          const usernameHTML = usernameEl.outerHTML;

          if (author) {
            const key = author + "|||" + content;
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              newMsgs.push({ author, content, usernameHTML });
            }
          }
        });
        return newMsgs;
      }

      return (async () => {

        //回到頂部
        const scrollTopButton = document.querySelector('button[aria-label="跳到頂部"]');
        if (scrollTopButton) {
            scrollTopButton.click();
            await delay(1500);
        } else {
          while (true) {
            scrollBox.scrollTop = 0;
            await delay(500);
            const flashExists = document.querySelector('[class*="heading-xxl"]');
            if (flashExists) break
          }
        }

        const hasDeletedPost = !!document.querySelector('[class*="text-md/normal"]');
        collected.push(...grabMessages());

        //移到底部
        while (true) {
          scrollBox.scrollTop = scrollBox.scrollHeight;
          await delay(500);
          collected.push(...grabMessages());
          const jumpToPresentBar = document.querySelector('[class*="jumpToPresentBar"]');
          if (!jumpToPresentBar) break;
        }

        return { rawMessages: collected, hasDeletedPost };
      })();
    }

    const [{ result: { rawMessages, hasDeletedPost } }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrollAndCollectMessages,
      world: "MAIN"
    });


    if (!rawMessages || rawMessages.length === 0) {
      resultBox.textContent = "未擷取到留言，請確認 Discord 頁面有留言。";
      return;
    }

    const messages = hasDeletedPost ? rawMessages : rawMessages.slice(1);
    const matchedMessages = messages.filter(m =>
      patterns.some(({ regex }) => regex.test(m.content))
    );

    allCandidates = [];
    matchedMessages.forEach(m => {
      for (const { kw, regex } of patterns) {
        const match = m.content.match(regex);
        if (match) {

          let numStr = null;
          if (keywordPosition === "both") {
            // match[1] 是關鍵詞前面的數字, match[2] 是關鍵詞後面的數字
            numStr = match[1] || match[2];
          } else {
            numStr = match[1];
          }

          const num = parseInt(numStr, 10);
          if (!isNaN(num)) {
            allCandidates.push({
              author: m.author,
              content: m.content,
              number: num,
              keyword: kw,
              usernameHTML: m.usernameHTML
            });
            break;
          }
        }
      }
    });

    // 群組 nickname，找出重複暱稱
    const nicknameMap = new Map();
    allCandidates.forEach(m => {
      if (!nicknameMap.has(m.author)) nicknameMap.set(m.author, []);
      nicknameMap.get(m.author).push(m);
    });
    const duplicateNicknames = Array.from(nicknameMap.entries()).filter(([_, arr]) => arr.length > 1);

    // 重複留言清單
    const duplicateMessages = [];
    duplicateNicknames.forEach(([nick, msgs]) => {
      msgs.forEach(m => {
        duplicateMessages.push({
          nickname: nick,
          usernameHTML: m.usernameHTML,
          content: m.content
        });
      });
    });

    // 取得真帳號，回頂部往下滾找
    async function findRealAccountMap(dupList) {
      const delay = ms => new Promise(r => setTimeout(r, ms));
      const result = {};
      const scrollBox = document.querySelector('[data-list-id="chat-messages"]')?.closest('[role="group"]');
      if (!scrollBox) return result;

      //頂部
      const scrollTopButton = document.querySelector('button[aria-label="跳到頂部"]');
      if (scrollTopButton) {
        scrollTopButton.click();
        await delay(1500);
      } else {
        while (true) {
          scrollBox.scrollTop = 0;
          await delay(500);
          const flashExists = document.querySelector('[class*="heading-xxl"]');
          if (flashExists) break;
        }
      }

      const dupSet = new Set(dupList.map(d => `${d.usernameHTML}___${d.content.trim()}`));
      const foundSet = new Set();
      
      async function checkRealIdsFromListItems(listItems) {
        for (const li of listItems) {
          const usernameEl = li.querySelector('[class^="username_"]');
          const contentEl = li.querySelector('[class^="markup_"]');
          if (!usernameEl || !contentEl) continue;

          const usernameHTML = usernameEl.outerHTML;
          const contentText = contentEl.textContent.trim();
          const key = `${usernameHTML}___${contentText}`;

          if (dupSet.has(key) && !foundSet.has(key)) {
            usernameEl.click();
            await delay(300);

            const tag = document.querySelector('span[class*="userTagUsername_"]');
            const realId = tag?.textContent.trim();

            usernameEl.click();
            await delay(100);

            if (realId) {
              const dupObj = dupList.find(d => d.usernameHTML === usernameHTML && d.content.trim() === contentText);
              if (dupObj) {
                result[`${dupObj.nickname}___${usernameHTML}___${contentText}`] = realId;
                foundSet.add(key);
              }
            }
          }
        }
      }

      while (true) {
        const listItems = [...document.querySelectorAll('li[id^="chat-messages-"]')];
        await checkRealIdsFromListItems(listItems);

        //底部
        scrollBox.scrollTop = scrollBox.scrollHeight;
        await delay(500);
        const jumpToPresentBar = document.querySelector('[class*="jumpToPresentBar"]');
        if (!jumpToPresentBar) break;
      }

      const finalListItems = [...document.querySelectorAll('li[id^="chat-messages-"]')];
      await checkRealIdsFromListItems(finalListItems);

      return result;
    }

    resultBox.textContent = "🔍 檢查重複 ID 中，請稍候...";

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: findRealAccountMap,
      args: [duplicateMessages],
      world: "MAIN"
    });

    realAccountMap = result;

    // 依 realId 更新作者欄位
    const finalMessages = applyRealId();

    // 分析留言（群組作者留言 & 抓出重複帳號）
    const { allAuthorsMessages, duplicateAuthors } = analyzeDuplicates(finalMessages);

    // 根據選擇的帳號重複處理方式過濾
    const filteredCandidates = filterByDupMode(finalMessages, allAuthorsMessages, dupMode);

    // 過濾唯一推號
    const { duplicateNumbers } = filterUniqueNumbers(filteredCandidates);

    // 繪製畫面
    renderAllResults({
      duplicateAuthors: Object.fromEntries(duplicateAuthors),
      duplicateNumbers: Object.fromEntries(duplicateNumbers)
    });

  } catch (err) {
    resultBox.textContent = `❌ 擷取或抽籤失敗：${err.message}`;
    console.error(err);
  }
});


document.getElementById("drawBtn").addEventListener("click", () => {
  if (!allCandidates || allCandidates.length === 0) {
    alert("請先擷取留言");
    return;
  }

  const savedDataStr = localStorage.getItem("drawResults");
  const data = JSON.parse(savedDataStr);
  const {
    duplicateAuthors,
    duplicateNumbers
  } = data;

  const drawCount = Math.max(0, parseInt(document.getElementById("drawCount").value) || 0);
  const dupMode = document.getElementById("dupMode").value;

  const finalMessages = applyRealId();
  const { allAuthorsMessages } = analyzeDuplicates(finalMessages);
  const filteredCandidates = filterByDupMode(finalMessages, allAuthorsMessages, dupMode);
  const { uniqueNumberCandidates } = filterUniqueNumbers(filteredCandidates);

  const pool = uniqueNumberCandidates;

  if (drawCount > pool.length) {
    alert(`抽籤人數超過候選人數（${pool.length}），將改為抽全部候選人。`);
  }

  winners = drawWinners(pool, drawCount);

  renderAllResults({
    winners, 
    duplicateAuthors,
    duplicateNumbers
  });
});
