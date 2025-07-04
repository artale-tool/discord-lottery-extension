function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

// 載入並顯示 localStorage 內的結果
function loadSavedResults() {
  const savedDataStr = localStorage.getItem("drawResults");
  if (!savedDataStr) return;

  try {
    const data = JSON.parse(savedDataStr);
    const { filteredCandidates, winners, duplicateAuthors, duplicateNumbers, keyword, drawCount, keywordPosition } = data;

    const keywordInput = document.getElementById("keyword");
    const keywordPositionSelect = document.getElementById("keywordPosition");
    const drawCountInput = document.getElementById("drawCount");
    const resultTitle = document.getElementById("resultTitle");
    const resultBox = document.getElementById("result");
    const winnersBox = document.getElementById("winners");
    const duplicateAuthorsTitle = document.getElementById("duplicateAuthorsTitle");
    const duplicateAuthorsBox = document.getElementById("duplicateAuthors");
    const duplicateNumbersTitle = document.getElementById("duplicateNumbersTitle");
    const duplicateNumbersBox = document.getElementById("duplicateNumbers");

    if (keywordInput && keyword) {
      keywordInput.value = keyword;
    }
    if (drawCountInput && typeof drawCount === "number") {
      drawCountInput.value = drawCount;
    }
    if (keywordPositionSelect && keywordPosition) {
      keywordPositionSelect.value = keywordPosition;
    }
    if(resultTitle) {
      resultTitle.textContent = `留言清單（共 ${filteredCandidates.length} 位）`;
    }
    if(resultBox) {
      resultBox.textContent = filteredCandidates.map(m => `${m.author}: ${m.content}`).join("\n");
    }

    if(winnersBox) {
      winnersBox.innerHTML = "";
      winners.forEach(w => {
        const li = document.createElement("li");
        li.textContent = `${w.author} - ${keyword}${w.number}`;
        winnersBox.appendChild(li);
      });
    }

    if (duplicateAuthorsBox) {
      duplicateAuthorsBox.innerHTML = "";
      if (duplicateAuthors && Object.keys(duplicateAuthors).length > 0) {
        if (duplicateAuthorsTitle) {
          duplicateAuthorsTitle.textContent = `重複帳號留言清單（共 ${Object.keys(duplicateAuthors).length} 位）`;
        }
        for (const [realId, data] of Object.entries(duplicateAuthors)) {
          const nickname = data.nickname || realId;
          const msgs = data.messages || [];
          const nums = msgs.map(m => `${keyword}${m.number}`);
          const div = document.createElement("div");
          div.textContent = `${nickname} (${nums.join(", ")})`;
          duplicateAuthorsBox.appendChild(div);
        }
      } else {
        duplicateAuthorsBox.textContent = "無重複留言帳號";
      }
    }

    if (duplicateNumbersBox) {
      duplicateNumbersBox.innerHTML = "";
      if (duplicateNumbers && Object.keys(duplicateNumbers).length > 0) {
        if (duplicateNumbersTitle) {
          duplicateNumbersTitle.textContent = `重複推號留言清單（共 ${Object.keys(duplicateNumbers).length} 位）`;
        }
        for (const [number, msgs] of Object.entries(duplicateNumbers)) {
          msgs.forEach(m => {
            const div = document.createElement("div");
            div.textContent = `${m.author} - ${keyword}${number}`;
            duplicateNumbersBox.appendChild(div);
          });
        }
      } else {
        duplicateNumbersBox.textContent = "無重複推號留言";
      }
    }
  } catch(e) {
    console.warn("無法讀取儲存的抽籤結果", e);
  }
}

window.addEventListener("load", loadSavedResults);

// 清空按鈕事件
document.getElementById("clearBtn").addEventListener("click", () => {
  resetUI();
  localStorage.removeItem("drawResults");
});

// 抓取按鈕事件
document.getElementById("grab").addEventListener("click", async () => {
  resetUI();

  const resultTitle = document.getElementById("resultTitle");
  const resultBox = document.getElementById("result");
  const winnersBox = document.getElementById("winners");
  const duplicateAuthorsTitle = document.getElementById("duplicateAuthorsTitle");
  const duplicateAuthorsBox = document.getElementById("duplicateAuthors");
  const duplicateNumbersTitle = document.getElementById("duplicateNumbersTitle");
  const duplicateNumbersBox = document.getElementById("duplicateNumbers");

  winnersBox.innerHTML = "";
  duplicateAuthorsBox.innerHTML = "";
  duplicateNumbersBox.innerHTML = "";
  resultBox.textContent = "";

  resultBox.textContent = "自動滾動載入留言中，請稍候...";

  const keyword = document.getElementById("keyword").value.trim();
  const drawCountInput = document.getElementById("drawCount").value;
  const drawCount = Math.max(0, parseInt(drawCountInput) || 0);
  const dupMode = document.getElementById("dupMode").value; // exclude | keepFirst | allow

  if (!keyword) {
    alert("請輸入關鍵詞");
    return;
  }

  const escapedKeyword = escapeRegExp(keyword);
  const keywordPosition = document.getElementById("keywordPosition").value;

  let pattern;
  if (keywordPosition === "front") {
    // 關鍵詞在前，後面接數字，如 推123
    pattern = new RegExp(`${escapedKeyword}(\\d+)`);
  } else if (keywordPosition === "back") {
    // 數字在前，關鍵詞在後，如 123推
    pattern = new RegExp(`(\\d+)${escapedKeyword}`);
  } else if (keywordPosition === "both") {
    // 兩種都要配對，如 推123 或 123推
    pattern = new RegExp(`(?:${escapedKeyword}(\\d+)|(\\d+)${escapedKeyword})`);
  }

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
          const usernameEl = item.querySelector('[class^="username_"]');
          const contentEl = item.querySelector('[class^="markup_"]');
          if (!usernameEl || !contentEl) return;

          const author = usernameEl.textContent.trim();
          const content = contentEl.textContent.trim();
          const usernameHTML = usernameEl.outerHTML;

          if (author && content) {
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

        collected.push(...grabMessages());

        //移到底部
        while (true) {
          scrollBox.scrollTop = scrollBox.scrollHeight;
          await delay(500);
          collected.push(...grabMessages());
          const jumpToPresentBar = document.querySelector('[class*="jumpToPresentBar"]');
          if (!jumpToPresentBar) break;
        }

        const hasDeletedPost = !!document.querySelector('[class*="text-md/normal"]');
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
    const matchedMessages = messages.filter(m => pattern.test(m.content));

    const tempCandidates = [];
    matchedMessages.forEach(m => {
      const match = m.content.match(pattern);
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
          tempCandidates.push({
            author: m.author,
            content: m.content,
            number: num,
            usernameHTML: m.usernameHTML
          });
        }
      }
    });

    // 群組 nickname，找出重複暱稱
    const nicknameMap = new Map();
    tempCandidates.forEach(m => {
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

    const [{ result: realAccountMap }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: findRealAccountMap,
      args: [duplicateMessages],
      world: "MAIN"
    });

    // 更新 author 為真帳號（如果有）
    const finalMessages = tempCandidates.map(m => {
      const key = `${m.author}___${m.usernameHTML}___${m.content}`;
      return {
        ...m,
        author: realAccountMap[key] || m.author
      };
    });

    // 群組留言 by realId
    const allAuthorsMessages = new Map();
    finalMessages.forEach(c => {
      if (!allAuthorsMessages.has(c.author)) allAuthorsMessages.set(c.author, []);
      allAuthorsMessages.get(c.author).push(c);
    });

    // 重複留言名單（realId）
    const duplicateAuthors = new Map();
    allAuthorsMessages.forEach((msgs, author) => {
      if (msgs.length > 1) duplicateAuthors.set(author, msgs);
    });

    // 三種抽籤模式處理
    let filteredCandidates = [];
    if (dupMode === "allow") {
      filteredCandidates = finalMessages;
    } else if (dupMode === "keepFirst") {
      const seen = new Set();
      finalMessages.forEach(c => {
        if (!seen.has(c.author)) {
          filteredCandidates.push(c);
          seen.add(c.author);
        }
      });
    } else if (dupMode === "exclude") {
      finalMessages.forEach(c => {
        if (allAuthorsMessages.get(c.author).length === 1) {
          filteredCandidates.push(c);
        }
      });
    }

    // 重複推號處理
    const seenNumbers = new Set();
    const uniqueNumberCandidates = [];
    const duplicateNumbers = new Map();

    for (const c of filteredCandidates) {
      if (!seenNumbers.has(c.number)) {
        uniqueNumberCandidates.push(c);
        seenNumbers.add(c.number);
      } else {
        if (!duplicateNumbers.has(c.number)) duplicateNumbers.set(c.number, []);
        duplicateNumbers.get(c.number).push(c);
      }
    }

    const pool = uniqueNumberCandidates;
    if (drawCount > pool.length) {
      alert(`抽籤人數超過候選人數（${pool.length}），將改為抽全部候選人。`);
    }

    function fisherYatesShuffle(array) {
      const result = array.slice(); // 建立副本避免改到原始 pool
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1)); // 隨機選一個索引 j
        [result[i], result[j]] = [result[j], result[i]]; // 交換位置
      }
      return result;
    }

    const shuffled = fisherYatesShuffle(pool);
    const winners = drawCount > 0 ? shuffled.slice(0, Math.min(drawCount, pool.length)) : [];

    // 顯示留言清單標題與內容
    if(resultTitle) {
      resultTitle.textContent = `留言清單（共 ${filteredCandidates.length} 位）`;
    }
    resultBox.textContent = filteredCandidates.map(m => `${m.author}: ${m.content}`).join("\n");

    // 顯示中獎名單
    winnersBox.innerHTML = "";
    winners.forEach(w => {
      const li = document.createElement("li");
      li.textContent = `${w.author} - ${keyword}${w.number}`;
      winnersBox.appendChild(li);
    });
    if (drawCount === 0 && winnersBox) {
      const li = document.createElement("li");
      li.textContent = "（未執行抽獎，只分析留言）";
      winnersBox.appendChild(li);
    }

    // 顯示重複留言名單
    duplicateAuthorsBox.innerHTML = "";
    if (duplicateAuthors.size > 0) {
      if (duplicateAuthorsTitle) {
        duplicateAuthorsTitle.textContent = `重複帳號留言清單（共 ${duplicateAuthors.size} 位）`;
      }
      duplicateAuthors.forEach((msgs, realId) => {
        // nickname: 用 realAccountMap 找對應暱稱
        const someKey = Object.entries(realAccountMap).find(([k, v]) => v === realId);
        let nickname = someKey ? someKey[0].split("___")[0] : realId;
        const nums = msgs.map(m => `${keyword}${m.number}`);
        const div = document.createElement("div");
        div.textContent = `${nickname} (${nums.join(", ")})`;
        duplicateAuthorsBox.appendChild(div);
      });
    } else {
      duplicateAuthorsBox.textContent = "無重複留言帳號";
    }

    // 顯示重複推號留言
    duplicateNumbersBox.innerHTML = "";
    if (duplicateNumbers.size > 0) {
      if (duplicateNumbersTitle) {
        duplicateNumbersTitle.textContent = `重複推號留言清單（共 ${duplicateNumbers.size} 位）`;
      }
      duplicateNumbers.forEach((msgs, number) => {
        msgs.forEach(m => {
          const div = document.createElement("div");
          div.textContent = `${m.author} - ${keyword}${number}`;
          duplicateNumbersBox.appendChild(div);
        });
      });
    } else {
      duplicateNumbersBox.textContent = "無重複推號留言";
    }


    // 加入 nickname 資訊一起儲存
    const duplicateAuthorsObj = {};
    duplicateAuthors.forEach((msgs, realId) => {
      const nickname = (Object.entries(realAccountMap).find(([k, v]) => v === realId)?.[0].split("___")[0]) || realId;
      duplicateAuthorsObj[realId] = {
        nickname,
        messages: msgs
      };
    });

    // 儲存結果到 localStorage
    const saveData = {
      filteredCandidates,
      winners,
      duplicateAuthors: duplicateAuthorsObj,
      duplicateNumbers: Object.fromEntries(duplicateNumbers),
      keyword,
      drawCount,
      keywordPosition
    };
    localStorage.setItem("drawResults", JSON.stringify(saveData));

  } catch (err) {
    resultBox.textContent = `❌ 擷取或抽籤失敗：${err.message}`;
    console.error(err);
  }
});
