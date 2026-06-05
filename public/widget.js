(function () {
  const script = document.currentScript;
  const businessId = script.getAttribute("data-business-id");
  const scriptSrc = script.getAttribute("src");
  const baseUrl = new URL(scriptSrc).origin;

  if (!businessId) {
    console.error("Agentify Widget: Missing data-business-id");
    return;
  }

  let config = null;
  let conversationId = localStorage.getItem(`agentify_conv_${businessId}`);
  let visitorId = localStorage.getItem("agentify_visitor_id") || "v_" + Math.random().toString(36).substring(2, 11);
  localStorage.setItem("agentify_visitor_id", visitorId);

  function formatMarkdown(text) {
    if (!text) return "";
    let escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

    escaped = escaped.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    escaped = escaped.replace(/\*(.*?)\*/g, "<em>$1</em>");
    escaped = escaped.replace(
      /\[(.*?)\]\((https?:\/\/.*?)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" style="text-decoration: underline; color: inherit; font-weight: 600;">$1</a>'
    );

    const lines = escaped.split("\n");
    let inList = false;
    const formattedLines = lines.map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        const content = trimmed.substring(2);
        let listLine = `<li>${content}</li>`;
        if (!inList) {
          inList = true;
          listLine = `<ul style="list-style-type: disc; padding-left: 20px; margin: 8px 0; display: block;">${listLine}`;
        }
        return listLine;
      } else {
        let prefix = "";
        if (inList) {
          inList = false;
          prefix = "</ul>";
        }
        return prefix + line;
      }
    });

    if (inList) {
      formattedLines.push("</ul>");
    }

    escaped = formattedLines.join("\n");
    escaped = escaped.replace(/\n\n/g, '<div style="height: 8px;"></div>');
    escaped = escaped.replace(/\n/g, "<br />");
    return escaped;
  }

  async function init() {
    try {
      const response = await fetch(`${baseUrl}/api/widget/config?businessId=${businessId}`);
      config = await response.json();

      if (!config.isEnabled) return;

      injectStyles();
      renderWidget();
    } catch (error) {
      console.error("Agentify Widget: Failed to load config", error);
    }
  }

  function injectStyles() {
    const style = document.createElement("style");
    style.innerHTML = `
      .agentify-widget-container {
        position: fixed;
        bottom: 20px;
        ${config.position === "bottom-left" ? "left: 20px;" : "right: 20px;"}
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        max-width: calc(100vw - 24px);
      }
      .agentify-bubble {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background-color: ${config.primaryColor};
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s ease;
      }
      .agentify-bubble:hover {
        transform: scale(1.05);
      }
      .agentify-bubble svg {
        width: 30px;
        height: 30px;
        fill: white;
      }
      .agentify-panel {
        position: absolute;
        bottom: 80px;
        ${config.position === "bottom-left" ? "left: 0;" : "right: 0;"}
        width: 380px;
        height: 600px;
        max-width: calc(100vw - 24px);
        max-height: calc(100vh - 80px);
        background: white;
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        display: none;
        flex-direction: column;
        overflow: hidden;
      }
      .agentify-panel.active {
        display: flex;
      }
      .agentify-header {
        background-color: ${config.primaryColor};
        color: white;
        padding: 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .agentify-header-info {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
      }
      .agentify-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        overflow: hidden;
      }
      .agentify-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .agentify-messages {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        background: #f8fafc;
      }
      .agentify-message {
        max-width: 80%;
        min-width: 0;
        padding: 10px 14px;
        border-radius: 12px;
        font-size: 14px;
        line-height: 1.5;
        overflow-wrap: anywhere;
        white-space: pre-wrap;
      }
      .agentify-message.user {
        align-self: flex-end;
        background-color: ${config.primaryColor};
        color: white;
        border-bottom-right-radius: 2px;
      }
      .agentify-message.assistant {
        align-self: flex-start;
        background-color: white;
        color: #1e293b;
        border-bottom-left-radius: 2px;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      }
      .agentify-footer {
        padding: 16px;
        background: white;
        border-top: 1px solid #e2e8f0;
      }
      .agentify-input-wrapper {
        display: flex;
        gap: 8px;
      }
      .agentify-input {
        flex: 1;
        min-width: 0;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 8px 12px;
        outline: none;
        font-size: 14px;
      }
      .agentify-input:focus {
        border-color: ${config.primaryColor};
      }
      .agentify-send {
        background-color: ${config.primaryColor};
        color: white;
        border: none;
        border-radius: 8px;
        padding: 8px 12px;
        cursor: pointer;
        font-weight: 600;
      }
      .agentify-branding {
        text-align: center;
        padding: 8px;
        font-size: 10px;
        color: #94a3b8;
      }
      .agentify-branding a {
        color: #64748b;
        text-decoration: none;
        font-weight: 600;
      }
      .agentify-suggested {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 12px;
      }
      .agentify-suggested-item {
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        padding: 4px 10px;
        font-size: 12px;
        color: #475569;
        cursor: pointer;
        transition: all 0.2s;
        overflow-wrap: anywhere;
      }
      .agentify-suggested-item:hover {
        background: #e2e8f0;
      }
      .agentify-assistant-name {
        font-weight: bold;
        font-size: 16px;
        max-width: 240px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .agentify-loading {
        display: flex;
        gap: 4px;
        padding: 10px;
      }
      .agentify-dot {
        width: 6px;
        height: 6px;
        background: #94a3b8;
        border-radius: 50%;
        animation: agentify-bounce 1.4s infinite ease-in-out both;
      }
      .agentify-dot:nth-child(1) { animation-delay: -0.32s; }
      .agentify-dot:nth-child(2) { animation-delay: -0.16s; }
      @keyframes agentify-bounce {
        0%, 80%, 100% { transform: scale(0); }
        40% { transform: scale(1.0); }
      }
      .agentify-continue-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 6px 12px;
        font-size: 12px;
        color: ${config.primaryColor};
        cursor: pointer;
        font-weight: bold;
        transition: all 0.2s;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        margin-left: 20px;
        margin-bottom: 8px;
      }
      .agentify-continue-btn:hover {
        background: #f8fafc;
        border-color: #cbd5e1;
      }
      .agentify-manual-badge {
        font-size: 10px;
        color: ${config.primaryColor};
        background: #f1f5f9;
        padding: 2px 6px;
        border-radius: 4px;
        margin-top: 4px;
        font-weight: bold;
        display: inline-block;
        width: fit-content;
      }
      @keyframes agentify-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: .5; }
      }
      @media (max-width: 480px) {
        .agentify-widget-container {
          bottom: 12px;
          left: 12px;
          right: 12px;
          display: flex;
          justify-content: ${config.position === "bottom-left" ? "flex-start" : "flex-end"};
        }
        .agentify-panel {
          position: fixed;
          left: 12px;
          right: 12px;
          bottom: 76px;
          width: calc(100vw - 24px);
          height: calc(100vh - 92px);
          max-height: 520px;
        }
        .agentify-header,
        .agentify-messages,
        .agentify-footer {
          padding-left: 14px;
          padding-right: 14px;
        }
        .agentify-assistant-name {
          max-width: calc(100vw - 150px);
        }
      }
    `;
    document.head.appendChild(style);
  }

  function renderWidget() {
    const container = document.createElement("div");
    container.className = "agentify-widget-container";
    
    const bubble = document.createElement("div");
    bubble.className = "agentify-bubble";
    bubble.innerHTML = `<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>`;
    
    const panel = document.createElement("div");
    panel.className = "agentify-panel";
    
    panel.innerHTML = `
      <div class="agentify-header">
        <div class="agentify-header-info">
          <div class="agentify-avatar">
            ${config.avatarUrl ? `<img src="${config.avatarUrl}" />` : config.assistantName[0]}
          </div>
          <div>
            <div class="agentify-assistant-name">${config.assistantName}</div>
            <div style="font-size: 12px; opacity: 0.8;">Online</div>
          </div>
        </div>
        <div style="cursor: pointer;" id="agentify-close">
          <svg width="20" height="20" fill="white" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </div>
      </div>
      <div class="agentify-messages" id="agentify-messages-list">
        <div class="agentify-message assistant">${formatMarkdown(config.welcomeText)}</div>
      </div>
      <div id="agentify-continue-container" style="display: none; background: #f8fafc;"></div>
      <div class="agentify-footer">
        <div class="agentify-suggested" id="agentify-suggested-list"></div>
        <div class="agentify-input-wrapper">
          <input type="text" class="agentify-input" id="agentify-input-field" placeholder="Type a message..." />
          <button class="agentify-send" id="agentify-send-btn">Send</button>
        </div>
        ${config.showBranding ? `<div class="agentify-branding">Powered by <a href="https://agentify.ai" target="_blank">Agentify</a></div>` : ""}
      </div>
    `;

    container.appendChild(bubble);
    container.appendChild(panel);
    document.body.appendChild(container);

    const msgList = panel.querySelector("#agentify-messages-list");
    const input = panel.querySelector("#agentify-input-field");
    const sendBtn = panel.querySelector("#agentify-send-btn");
    const suggestedList = panel.querySelector("#agentify-suggested-list");
    const closeBtn = panel.querySelector("#agentify-close");

    bubble.onclick = () => panel.classList.toggle("active");
    closeBtn.onclick = () => panel.classList.remove("active");

    // Render suggested questions
    if (config.suggestedQuestions && config.suggestedQuestions.length > 0) {
      config.suggestedQuestions.forEach(q => {
        const item = document.createElement("div");
        item.className = "agentify-suggested-item";
        item.innerText = q;
        item.onclick = () => {
          input.value = q;
          sendMessage();
        };
        suggestedList.appendChild(item);
      });
    }

    let pollingInterval = null;
    let renderedMessageCount = 0;

    function startHistoryPolling() {
      if (pollingInterval) clearInterval(pollingInterval);
      if (!conversationId) return;

      pollingInterval = setInterval(async () => {
        if (!panel.classList.contains("active")) return;

        try {
          const res = await fetch(`${baseUrl}/api/widget/chat/history?conversationId=${conversationId}&_=${Date.now()}`);
          const data = await res.json();

          if (data.messages && data.messages.length > renderedMessageCount) {
            msgList.innerHTML = `<div class="agentify-message assistant">${formatMarkdown(config.welcomeText)}</div>`;
            renderedMessageCount = 0;

            data.messages.forEach((msg) => {
              addMessage(msg.content, msg.role === "assistant" ? "assistant" : "user", msg.metadata);
            });
          }
        } catch (err) {
          console.error("Widget polling error:", err);
        }
      }, 4000);
    }

    async function sendMessage() {
      const message = input.value.trim();
      if (!message) return;

      input.value = "";
      addMessage(message, "user");

      const continueContainer = panel.querySelector("#agentify-continue-container");
      if (continueContainer) continueContainer.style.display = "none";
      
      const loading = document.createElement("div");
      loading.className = "agentify-message assistant agentify-loading";
      loading.innerHTML = `<div class="agentify-dot"></div><div class="agentify-dot"></div><div class="agentify-dot"></div>`;
      msgList.appendChild(loading);
      msgList.scrollTop = msgList.scrollHeight;

      try {
        const res = await fetch(`${baseUrl}/api/widget/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId,
            conversationId,
            visitorId,
            message,
            pageUrl: window.location.href,
          }),
        });

        const data = await res.json();
        loading.remove();

        if (data.conversationId && !conversationId) {
          conversationId = data.conversationId;
          localStorage.setItem(`agentify_conv_${businessId}`, conversationId);
          startHistoryPolling();
        }

        if (data.reply) {
          addMessage(data.reply, "assistant");
        } else if (data.isManualTakeover) {
          // AI is paused. Do nothing, wait for manual poll.
        } else {
          addMessage("Sorry, something went wrong. Please try again.", "assistant");
        }
      } catch (error) {
        loading.remove();
        addMessage("Sorry, I'm having trouble connecting right now.", "assistant");
      }
    }

    function addMessage(text, role, metadata) {
      const div = document.createElement("div");
      div.className = `agentify-message ${role}`;

      const isManual = metadata && metadata.is_manual;
      if (isManual) {
        div.classList.add("manual");
      }

      div.innerHTML = formatMarkdown(text);

      if (isManual) {
        const badge = document.createElement("div");
        badge.className = "agentify-manual-badge";
        badge.innerText = "Support Agent";
        div.appendChild(badge);
      }

      msgList.appendChild(div);
      msgList.scrollTop = msgList.scrollHeight;
      renderedMessageCount++;

      // Handle showing/hiding continue button
      const continueContainer = panel.querySelector("#agentify-continue-container");
      if (continueContainer) {
        if (role === "assistant" && !isManual) {
          continueContainer.innerHTML = `
            <button class="agentify-continue-btn" id="agentify-continue-btn">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="${config.primaryColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; display: inline-block; vertical-align: middle; animation: agentify-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z"/><path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5Z"/><path d="m19 17 1 2.5 2.5.5-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1Z"/></svg>
              Continue response
            </button>
          `;
          continueContainer.style.display = "block";
          const btn = continueContainer.querySelector("#agentify-continue-btn");
          if (btn) {
            btn.onclick = () => {
              input.value = "Continue";
              sendMessage();
            };
          }
        } else {
          continueContainer.style.display = "none";
        }
      }
    }

    input.onkeypress = (e) => {
      if (e.key === "Enter") sendMessage();
    };
    sendBtn.onclick = sendMessage;

    // Start history polling if already have a conversationId
    if (conversationId) {
      fetch(`${baseUrl}/api/widget/chat/history?conversationId=${conversationId}&_=${Date.now()}`)
        .then(res => res.json())
        .then(data => {
          if (data.messages && data.messages.length > 0) {
            msgList.innerHTML = `<div class="agentify-message assistant">${formatMarkdown(config.welcomeText)}</div>`;
            renderedMessageCount = 0;
            data.messages.forEach(msg => {
              addMessage(msg.content, msg.role === "assistant" ? "assistant" : "user", msg.metadata);
            });
          }
          startHistoryPolling();
        })
        .catch(err => {
          console.error("Widget initial load error:", err);
          startHistoryPolling();
        });
    }
  }

  init();
})();
