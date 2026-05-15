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
        max-height: calc(100vh - 120px);
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
        padding: 10px 14px;
        border-radius: 12px;
        font-size: 14px;
        line-height: 1.5;
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
      }
      .agentify-suggested-item:hover {
        background: #e2e8f0;
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
      @media (max-width: 480px) {
        .agentify-panel {
          width: calc(100vw - 40px);
          height: calc(100vh - 100px);
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
            <div style="font-weight: bold; font-size: 16px;">${config.assistantName}</div>
            <div style="font-size: 12px; opacity: 0.8;">Online</div>
          </div>
        </div>
        <div style="cursor: pointer;" id="agentify-close">
          <svg width="20" height="20" fill="white" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </div>
      </div>
      <div class="agentify-messages" id="agentify-messages-list">
        <div class="agentify-message assistant">${config.welcomeText}</div>
      </div>
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

    async function sendMessage() {
      const message = input.value.trim();
      if (!message) return;

      input.value = "";
      addMessage(message, "user");
      
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

        if (data.reply) {
          addMessage(data.reply, "assistant");
          if (data.conversationId) {
            conversationId = data.conversationId;
            localStorage.setItem(`agentify_conv_${businessId}`, conversationId);
          }
        } else {
          addMessage("Sorry, something went wrong. Please try again.", "assistant");
        }
      } catch (error) {
        loading.remove();
        addMessage("Sorry, I'm having trouble connecting right now.", "assistant");
      }
    }

    function addMessage(text, role) {
      const div = document.createElement("div");
      div.className = `agentify-message ${role}`;
      div.innerText = text;
      msgList.appendChild(div);
      msgList.scrollTop = msgList.scrollHeight;
    }

    input.onkeypress = (e) => {
      if (e.key === "Enter") sendMessage();
    };
    sendBtn.onclick = sendMessage;
  }

  init();
})();
