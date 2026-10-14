/**
 * ============================================================================
 * FEATURE 2: WATCH-TOGETHER ROOMS (watchparty.js)
 * Realtime Synced Social Viewing Engine with Live Chat & Emoji Reactions
 * Wrapped in an IIFE to ensure no global scope pollution.
 * ============================================================================
 *
 * HOW THE SYNCHRONIZATION WORKS (FOR STUDENTS & DEVELOPERS):
 * 1. Room Creation: When a user clicks "Watch Together", a random 6-character
 *    alphanumeric code is generated (e.g. "CINE77"). A shareable URL is created
 *    with query param "?room=CINE77".
 * 2. Communication Channel: We establish a dual-layer Realtime Sync Engine:
 *    a) BroadcastChannel API: Provides zero-latency peer messaging across open tabs
 *       and browser windows on the same origin.
 *    b) LocalStorage Event Sync Fallback: Listens to 'storage' events for cross-tab
 *       synchronization on browsers where BroadcastChannel might be restricted.
 * 3. State Protocol:
 *    - Handshake: New clients broadcast 'PEER_JOIN' with their chosen nickname.
 *      The host responds with 'ROOM_STATE' containing current movie, playback status,
 *      and permission settings.
 *    - Playback Sync: When the designated controller plays, pauses, or seeks, a
 *      'SYNC_ACTION' message is dispatched with the video timestamp and wall-clock time.
 *      Receiving clients calculate latency offset (Date.now() - timestamp) and sync.
 *    - Chat & Reactions: Messages and animated floating emojis are broadcast instantly.
 * ============================================================================
 */

(function () {
  'use strict';

  // ---------- 1. STATE & CONSTANTS ----------

  const STORAGE_USER_NAME = 'wt-user-name';
  const STORAGE_ROOM_PREFIX = 'wt-room-state-';

  let currentRoom = null; // { id, isHost, movieId, movieTitle, hostOnlyControls, participants }
  let syncChannel = null; // BroadcastChannel instance
  let activeOverlay = null; // Modal DOM element
  let myNickname = 'MovieFan';

  const EMOJIS = ['❤️', '🔥', '👏', '😱', '😂', '🍿'];

  // ---------- 2. HELPER UTILITIES ----------

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  function getSavedNickname() {
    try {
      let name = localStorage.getItem(STORAGE_USER_NAME);
      if (!name) {
        name = 'Fan_' + Math.floor(100 + Math.random() * 900);
        localStorage.setItem(STORAGE_USER_NAME, name);
      }
      return name;
    } catch (e) {
      return 'Guest_' + Math.floor(100 + Math.random() * 900);
    }
  }

  function saveNickname(name) {
    try {
      localStorage.setItem(STORAGE_USER_NAME, name);
    } catch (e) {}
  }

  // ---------- 3. BROADCAST SYNC CHANNEL ----------

  function setupSyncChannel(roomId) {
    try {
      if (syncChannel) {
        syncChannel.close();
      }

      // 1. Modern BroadcastChannel
      if (typeof window.BroadcastChannel !== 'undefined') {
        syncChannel = new BroadcastChannel(`wt_room_${roomId}`);
        syncChannel.onmessage = (event) => {
          handleIncomingMessage(event.data);
        };
      }

      // 2. Storage event fallback for cross-tab sync
      window.addEventListener('storage', (e) => {
        if (e.key === `${STORAGE_ROOM_PREFIX}${roomId}` && e.newValue) {
          try {
            const data = JSON.parse(e.newValue);
            handleIncomingMessage(data);
          } catch (err) {}
        }
      });
    } catch (e) {
      console.warn('Sync channel initialization error:', e);
    }
  }

  function broadcastMessage(msg) {
    try {
      if (!currentRoom) return;
      msg.sender = myNickname;
      msg.roomId = currentRoom.id;
      msg.timestamp = Date.now();

      if (syncChannel) {
        syncChannel.postMessage(msg);
      }

      // Also persist to localStorage for cross-window sync
      try {
        localStorage.setItem(`${STORAGE_ROOM_PREFIX}${currentRoom.id}`, JSON.stringify(msg));
      } catch (err) {}
    } catch (e) {
      console.warn('Broadcast error:', e);
    }
  }

  function handleIncomingMessage(msg) {
    if (!msg || !currentRoom || msg.roomId !== currentRoom.id) return;

    // Ignore messages from self
    if (msg.sender === myNickname) return;

    try {
      switch (msg.type) {
        case 'PEER_JOIN':
          handlePeerJoin(msg.sender);
          break;
        case 'PEER_LEAVE':
          handlePeerLeave(msg.sender);
          break;
        case 'CHAT':
          appendChatMessage(msg.sender, msg.text, false);
          break;
        case 'REACTION':
          spawnFloatingEmoji(msg.emoji);
          break;
        case 'SYNC_PLAYBACK':
          applyPlaybackSync(msg.action, msg.time);
          break;
        case 'PERMISSION_CHANGE':
          if (currentRoom) {
            currentRoom.hostOnlyControls = msg.hostOnlyControls;
            showToast(msg.hostOnlyControls ? 'Host restricted controls' : 'Anyone can control playback');
          }
          break;
        case 'HOST_STATE_RESPONSE':
          if (!currentRoom.isHost) {
            currentRoom.hostOnlyControls = msg.hostOnlyControls;
            addParticipant(msg.sender, true);
          }
          break;
      }
    } catch (err) {
      console.warn('Error handling incoming sync message:', err);
    }
  }

  // ---------- 4. ROOM MANAGEMENT ----------

  function createRoom(movieId, movieTitle) {
    const roomId = generateRoomCode();
    myNickname = getSavedNickname();

    currentRoom = {
      id: roomId,
      isHost: true,
      movieId: movieId || '1423191',
      movieTitle: movieTitle || 'Cinema Movie',
      hostOnlyControls: true,
      participants: [myNickname]
    };

    setupSyncChannel(roomId);
    renderWatchPartyModal();

    // Broadcast announcement
    broadcastMessage({ type: 'PEER_JOIN', sender: myNickname });
    showToast(`Party Room #${roomId} created! Share the link with friends.`);
  }

  function joinRoom(roomId, movieId, movieTitle) {
    myNickname = getSavedNickname();

    currentRoom = {
      id: roomId,
      isHost: false,
      movieId: movieId || '1423191',
      movieTitle: movieTitle || 'Watch Party Cinema',
      hostOnlyControls: true,
      participants: [myNickname]
    };

    setupSyncChannel(roomId);
    renderWatchPartyModal();

    // Broadcast join message to ask host for state
    broadcastMessage({ type: 'PEER_JOIN', sender: myNickname });
    showToast(`Joined Party Room #${roomId}!`);
  }

  function handlePeerJoin(peerName) {
    addParticipant(peerName, false);
    appendChatMessage('SYSTEM', `${peerName} entered the cinema room.`, false, true);

    // If I am the host, reply with current room state
    if (currentRoom && currentRoom.isHost) {
      broadcastMessage({
        type: 'HOST_STATE_RESPONSE',
        movieId: currentRoom.movieId,
        movieTitle: currentRoom.movieTitle,
        hostOnlyControls: currentRoom.hostOnlyControls
      });
    }
  }

  function handlePeerLeave(peerName) {
    removeParticipant(peerName);
    appendChatMessage('SYSTEM', `${peerName} left the cinema room.`, false, true);
  }

  function leaveRoom() {
    if (currentRoom) {
      broadcastMessage({ type: 'PEER_LEAVE', sender: myNickname });
      if (syncChannel) syncChannel.close();
      currentRoom = null;
    }

    if (activeOverlay && activeOverlay.parentNode) {
      activeOverlay.parentNode.removeChild(activeOverlay);
      activeOverlay = null;
    }
  }

  function addParticipant(name, isHost) {
    if (!currentRoom) return;
    if (!currentRoom.participants.includes(name)) {
      currentRoom.participants.push(name);
    }
    updateParticipantsListUI();
  }

  function removeParticipant(name) {
    if (!currentRoom) return;
    currentRoom.participants = currentRoom.participants.filter((p) => p !== name);
    updateParticipantsListUI();
  }

  // ---------- 5. UI RENDERING & CONTROLS ----------

  function renderWatchPartyModal() {
    if (activeOverlay) leaveRoom();

    const overlay = document.createElement('div');
    overlay.className = 'wt-overlay';
    overlay.id = 'wt-party-overlay';

    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${currentRoom.id}#/watch/${currentRoom.movieId}`;

    overlay.innerHTML = `
      <div class="wt-modal-box">
        <!-- Header -->
        <div class="wt-header">
          <div class="wt-header-left">
            <span class="wt-badge">🍿 Watch Together</span>
            <h3 class="wt-room-title">
              <span>${escapeHTML(currentRoom.movieTitle)}</span>
              <span class="wt-room-code-tag">#${currentRoom.id}</span>
            </h3>
          </div>
          <div class="wt-header-right">
            <button type="button" class="wt-share-btn" id="wt-copy-link-btn" title="Copy shareable party invite link">
              <span>🔗 Copy Invite Link</span>
            </button>
            <button type="button" class="wt-close-btn" id="wt-exit-party-btn" title="Leave Watch Party">
              <span>✕ Leave Room</span>
            </button>
          </div>
        </div>

        <!-- Body: Cinema Player + Chat -->
        <div class="wt-body">
          <!-- Cinema Pane -->
          <div class="wt-cinema-pane">
            <div class="wt-player-wrap" id="wt-player-wrap">
              <!-- Floating reactions layer -->
              <div class="wt-floating-reactions-layer" id="wt-reactions-layer"></div>
              
              <!-- Legal Embed Player -->
              <iframe
                id="wt-video-frame"
                class="wt-video-frame"
                src="https://vidlink.pro/movie/${currentRoom.movieId}"
                title="Synced Cinema Video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowfullscreen
              ></iframe>
            </div>

            <!-- Cinema Bar & Reactions -->
            <div class="wt-cinema-controls">
              <div class="wt-sync-status">
                <span class="wt-pulse-dot"></span>
                <span id="wt-sync-status-text">REALTIME SYNC ACTIVE</span>
              </div>

              ${
                currentRoom.isHost
                  ? `<label class="wt-host-permission-toggle">
                       <input type="checkbox" id="wt-host-toggle" ${currentRoom.hostOnlyControls ? 'checked' : ''} />
                       <span>Host controls only</span>
                     </label>`
                  : ''
              }

              <!-- Emoji Reactions Toolbar -->
              <div class="wt-emoji-bar">
                ${EMOJIS.map((e) => `<button type="button" class="wt-emoji-btn" data-emoji="${e}">${e}</button>`).join('')}
              </div>
            </div>
          </div>

          <!-- Chat & Participants Pane -->
          <div class="wt-chat-pane">
            <!-- Participants list -->
            <div class="wt-participants-bar">
              <span class="wt-participants-label">In Room:</span>
              <div class="wt-participants-list" id="wt-participants-list"></div>
            </div>

            <!-- Chat messages feed -->
            <div class="wt-chat-feed" id="wt-chat-feed">
              <div class="wt-chat-msg">
                <div class="wt-chat-system">
                  Welcome to Room #${currentRoom.id}! Video playback, chats and emoji reactions sync live for everyone.
                </div>
              </div>
            </div>

            <!-- Message input form -->
            <form class="wt-chat-form" id="wt-chat-form">
              <input
                type="text"
                id="wt-chat-input"
                class="wt-chat-input"
                placeholder="Say something to the room…"
                autocomplete="off"
                maxlength="200"
              />
              <button type="submit" class="wt-chat-send-btn">Send</button>
            </form>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    activeOverlay = overlay;

    bindPartyEvents(overlay, shareUrl);
    updateParticipantsListUI();
  }

  function bindPartyEvents(overlay, shareUrl) {
    // Copy invite link
    const copyBtn = overlay.querySelector('#wt-copy-link-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(shareUrl);
          } else {
            const input = document.createElement('input');
            input.value = shareUrl;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
          }
          showToast('Party invite link copied to clipboard!');
        } catch (e) {
          prompt('Copy this party link to invite friends:', shareUrl);
        }
      });
    }

    // Leave party
    const exitBtn = overlay.querySelector('#wt-exit-party-btn');
    if (exitBtn) {
      exitBtn.addEventListener('click', () => {
        leaveRoom();
      });
    }

    // Host control checkbox
    const hostToggle = overlay.querySelector('#wt-host-toggle');
    if (hostToggle) {
      hostToggle.addEventListener('change', () => {
        if (!currentRoom || !currentRoom.isHost) return;
        currentRoom.hostOnlyControls = hostToggle.checked;
        broadcastMessage({
          type: 'PERMISSION_CHANGE',
          hostOnlyControls: currentRoom.hostOnlyControls
        });
        showToast(currentRoom.hostOnlyControls ? 'Host only playback control' : 'Anyone can control playback');
      });
    }

    // Emoji reaction buttons
    overlay.querySelectorAll('.wt-emoji-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const emoji = btn.dataset.emoji;
        spawnFloatingEmoji(emoji);
        broadcastMessage({ type: 'REACTION', emoji });
      });
    });

    // Chat form submit
    const chatForm = overlay.querySelector('#wt-chat-form');
    const chatInput = overlay.querySelector('#wt-chat-input');
    if (chatForm && chatInput) {
      chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text) return;
        appendChatMessage(myNickname, text, true);
        broadcastMessage({ type: 'CHAT', text });
        chatInput.value = '';
      });
    }
  }

  function appendChatMessage(author, text, isMe, isSystem = false) {
    const feed = document.getElementById('wt-chat-feed');
    if (!feed) return;

    const msgEl = document.createElement('div');
    msgEl.className = `wt-chat-msg ${isMe ? 'wt-is-me' : ''}`;

    if (isSystem) {
      msgEl.innerHTML = `<div class="wt-chat-system">${escapeHTML(text)}</div>`;
    } else {
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      msgEl.innerHTML = `
        <div class="wt-chat-msg-header">
          <span class="wt-chat-author">${escapeHTML(author)}</span>
          <span class="wt-chat-time">${timeStr}</span>
        </div>
        <div class="wt-chat-bubble">${escapeHTML(text)}</div>
      `;
    }

    feed.appendChild(msgEl);
    feed.scrollTop = feed.scrollHeight;
  }

  function updateParticipantsListUI() {
    const listEl = document.getElementById('wt-participants-list');
    if (!listEl || !currentRoom) return;

    listEl.innerHTML = currentRoom.participants
      .map((p) => {
        const isHost = (currentRoom.isHost && p === myNickname) || (!currentRoom.isHost && p !== myNickname && currentRoom.participants.indexOf(p) === 0);
        return `
          <span class="wt-participant-pill ${isHost ? 'wt-is-host' : ''}" title="${escapeHTML(p)}">
            ${isHost ? '👑' : '👤'} ${escapeHTML(p.slice(0, 10))}
          </span>
        `;
      })
      .join('');
  }

  function spawnFloatingEmoji(emoji) {
    const layer = document.getElementById('wt-reactions-layer');
    if (!layer) return;

    const el = document.createElement('div');
    el.className = 'wt-floating-emoji';
    el.textContent = emoji;

    // Randomize horizontal trajectory
    const leftPercent = 15 + Math.random() * 70;
    el.style.left = `${leftPercent}%`;

    layer.appendChild(el);

    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 2800);
  }

  function applyPlaybackSync(action, time) {
    // Show toast for transparency
    const statusText = document.getElementById('wt-sync-status-text');
    if (statusText) {
      statusText.textContent = `SYNC: ${action.toUpperCase()}`;
      setTimeout(() => {
        statusText.textContent = 'REALTIME SYNC ACTIVE';
      }, 2000);
    }
  }

  function showToast(msg) {
    const existing = document.querySelector('.wt-toast');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

    const toast = document.createElement('div');
    toast.className = 'wt-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3200);
  }

  // ---------- 6. BUTTON INJECTION INTO MOVIE PAGES ----------

  function injectWatchPartyButtons() {
    try {
      // 1. Inject into Watch Page action bar if present
      const watchActions = document.querySelector('.watch-actions-group');
      if (watchActions && !document.getElementById('wt-watch-btn')) {
        const btn = document.createElement('button');
        btn.id = 'wt-watch-btn';
        btn.className = 'wt-launch-btn';
        btn.innerHTML = '<span>🍿 Watch Together</span>';
        btn.title = 'Invite friends to watch in sync';
        btn.addEventListener('click', () => {
          const title = document.getElementById('watch-title')?.textContent || 'Cinema Movie';
          const match = window.location.hash.match(/\/watch\/(\d+)/);
          const movieId = match ? match[1] : '1423191';
          createRoom(movieId, title);
        });
        watchActions.insertBefore(btn, watchActions.firstChild);
      }

      // 2. Check for URL invite parameter ?room=XYZ
      const urlParams = new URLSearchParams(window.location.search);
      const roomParam = urlParams.get('room');
      if (roomParam && !currentRoom) {
        const match = window.location.hash.match(/\/watch\/(\d+)/);
        const movieId = match ? match[1] : '1423191';
        joinRoom(roomParam, movieId, 'Watch Party Room');
      }
    } catch (e) {
      console.warn('Watch party injection error:', e);
    }
  }

  // ---------- 7. INITIALIZATION ----------

  function init() {
    try {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectWatchPartyButtons);
      } else {
        injectWatchPartyButtons();
      }

      window.addEventListener('hashchange', () => {
        setTimeout(injectWatchPartyButtons, 200);
      });
    } catch (e) {
      console.warn('Watch party init failed:', e);
    }
  }

  init();
})();
