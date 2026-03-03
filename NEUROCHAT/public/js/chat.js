// public/js/chat.js - V115 - Fix filterContacts Order & Ghost Notif
var socket = io();

// 1. SESSÃO
// 1. SESSÃO
const userSession = localStorage.getItem('neurochat_user');
if (!userSession) window.location.href = '/';

let currentUser;
try {
    currentUser = JSON.parse(userSession);
    if (!currentUser || !currentUser.id) throw new Error("Dados inválidos");
} catch (e) {
    localStorage.removeItem('neurochat_user');
    window.location.href = '/';
}

let allUsers=[], allGroups=[], onlineIds=[], currentChatId=null, currentChatType=null, replyingTo=null;
let activeTab='users', chatOffset=0, isUploading=false, pinnedMessagesList=[], pinnedIndex=0;
let originalTitle=document.title, blinkInterval=null, unreadCountGlobal=0, searchResults=[], searchIndex=-1;

// 14. SOM DE NOTIFICAÇÃO (MP3 TIPO WHATSAPP)
const notificationAudio = new Audio('/notification.mp3');
notificationAudio.volume = 1.0; 

// Desbloqueio de áudio robusto (Tenta em qualquer interação)
const unlockAudio = () => {
    notificationAudio.play().then(() => {
        notificationAudio.pause();
        notificationAudio.currentTime = 0;
        // Remove os listeners após desbloquear
        document.removeEventListener('click', unlockAudio);
        document.removeEventListener('keydown', unlockAudio);
        document.removeEventListener('touchstart', unlockAudio);
    }).catch(() => {});
};
document.addEventListener('click', unlockAudio);
document.addEventListener('keydown', unlockAudio);
document.addEventListener('touchstart', unlockAudio);

window.playNotificationSound = () => {
    try {
        // Usa cloneNode para permitir sons sobrepostos (ex: várias msgs seguidas)
        const sound = notificationAudio.cloneNode(true);
        sound.volume = 1.0;
        sound.play().catch(e => console.log("Áudio bloqueado ou erro:", e));
    } catch (e) {
        console.error("Erro ao tocar som:", e);
    }
};

// 2. HELPERS & UTILS
window.getAvatarUrl = (p) => (p && p !== 'NULL' && p !== '') ? `/uploads/${p}` : '/avatar.png';

window.formatMessage = (t) => {
    if (!t) return '';
    let safe = t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    safe = safe.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="chat-link">$1</a>');
    safe = safe.replace(/\*(.*?)\*/g, '<b>$1</b>');
    return safe.replace(/\n/g, '<br>');
};

window.getFancyDate = (s) => { if(!s)return""; const d=new Date(s),n=new Date(),t=new Date(n.getFullYear(),n.getMonth(),n.getDate()),m=new Date(d.getFullYear(),d.getMonth(),d.getDate()),diff=Math.floor((t-m)/(1000*60*60*24));return diff===0?"HOJE":diff===1?"ONTEM":d.toLocaleDateString('pt-BR'); };
window.autoResize = (el) => { el.style.height = '45px'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; };
window.checkEnter = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); window.sendMessage(); } window.autoResize(e.target); };

window.scrollToBottom = () => {
    const container = document.getElementById('messages');
    if (container) container.scrollTop = container.scrollHeight;
};

window.updateMyInfo = () => {
    if(!currentUser) return;
    document.getElementById('user-name').textContent = currentUser.username;
    document.getElementById('user-dept').textContent = currentUser.department;
    document.getElementById('my-avatar-img').src = getAvatarUrl(currentUser.photo);
};

window.updateDateSeparators = () => {
    document.querySelectorAll('.date-separator').forEach(el => el.remove());
    const msgs = document.querySelectorAll('.msg-container');
    let last = null;
    msgs.forEach(msg => {
        const r = msg.getAttribute('data-date');
        if(!r) return;
        const d = new Date(r).toLocaleDateString('pt-BR');
        if (d !== last) {
            const sep = document.createElement('div');
            sep.className = 'date-separator';
            sep.innerHTML = `<span class="date-pill">${window.getFancyDate(r)}</span>`;
            msg.parentNode.insertBefore(sep, msg);
            last = d;
        }
    });
};

// MOVIDO PARA CIMA (Correção do Erro)
window.filterContacts = (t) => {
    const term = (t||'').toLowerCase();
    const listId = activeTab==='users'?'users-list':'groups-list';
    document.querySelectorAll(`#${listId} li`).forEach(l => {
        const name = l.getAttribute('data-search-name');
        if(name && name.includes(term)) l.style.display='flex'; else l.style.display='none';
    });
};

// 3. UI & LISTAS
window.loadData = async () => {
    try {
        const res = await fetch(`/data-sync/${currentUser.id}`);
        const data = await res.json();
        if(data.error === 'BLOCKED') { alert("Conta bloqueada."); window.logout(); return; }
        if(data.error) { console.error("Erro:", data.error); return; }

        if(data.me) { 
            currentUser = {...currentUser, ...data.me}; 
            currentUser = {...currentUser, ...data.me}; 
            localStorage.setItem('neurochat_user', JSON.stringify(currentUser)); 
            window.updateMyInfo();
            window.updateMyInfo(); 
            const b = document.querySelector('.new-group-btn');
            if(b) b.style.display = currentUser.is_super_admin ? 'block' : 'none';
            const bUser = document.getElementById('btn-show-user-modal');
            if(bUser) bUser.style.display = currentUser.is_super_admin ? 'block' : 'none';
        }
        allUsers = (data.users||[]).map(u => ({...u, last_activity: u.last_interaction })); 
        allGroups = data.groups||[];
        window.renderLists();
        allGroups.forEach(g => socket.emit('join group room', g.id));
    } catch(e) { console.error(e); }
};

window.switchTab = (tab) => {
    activeTab = tab;
    document.getElementById('tab-users').classList.toggle('active', tab==='users');
    document.getElementById('tab-groups').classList.toggle('active', tab==='groups');
    document.getElementById('users-list').style.display = tab==='users'?'block':'none';
    const gc = document.getElementById('groups-container');
    if(gc) gc.style.display = tab==='groups'?'block':'none';
    else document.getElementById('groups-list').style.display = tab==='groups'?'block':'none';
    const s = document.getElementById('contact-search');
    if(s) window.filterContacts(s.value);
};

window.renderLists = () => {
    // 1. Users - Ordenação Robusta
    allUsers.sort((a,b) => {
        if ((b.unread||0) > 0 && (a.unread||0) === 0) return 1; 
        if ((a.unread||0) > 0 && (b.unread||0) === 0) return -1;
        const dA = a.last_activity ? new Date(a.last_activity).getTime() : 0; 
        const dB = b.last_activity ? new Date(b.last_activity).getTime() : 0;
        if (dB !== dA) return dB - dA;
        return a.username.localeCompare(b.username);
    });

    const ulUsers = document.getElementById('users-list');
    ulUsers.innerHTML = ''; 
    let uUnread = 0;
    
    // Deduplicação
    const uniqueUsers = Array.from(new Set(allUsers.map(a => a.id))).map(id => allUsers.find(a => a.id === id));

    uniqueUsers.forEach(u => {
        if(u.id === currentUser.id) return;
        if(u.unread > 0) uUnread += u.unread;
        const isOnline = onlineIds.includes(u.id);
        const badge = u.unread > 0 ? 'block' : 'none';
        let adminBtn = currentUser.is_super_admin ? `<button onclick="event.stopPropagation(); window.openAdminControl(${u.id})" style="background:none;border:none;cursor:pointer;color:#999;">⚙️</button>` : '';
        
        const photoUrl = getAvatarUrl(u.photo);
        const li = document.createElement('li');
        li.setAttribute('data-search-name', (u.username||'').toLowerCase());
        if(u.unread > 0) li.style.background = '#e8f5e9'; 
        
        li.innerHTML = `
        <div class="contact-left">
            <div class="avatar-wrapper">
                <img src="${photoUrl}" class="list-avatar" onclick="event.stopPropagation(); window.openImageZoom('${photoUrl}')">
                <div class="${isOnline?'status-dot online':'status-dot'}"></div>
            </div>
            <div class="contact-info">
                <span class="contact-name" style="${u.unread?'font-weight:bold;color:#2e7d32':''}">${u.username} ${u.is_super_admin?'👑':''}</span>
                <span class="contact-dept">${u.department||''}</span>
            </div>
        </div>
        <div style="display:flex;align-items:center;">
            ${adminBtn}
            <div class="unread-badge" style="display:${badge}">${u.unread}</div>
        </div>`;
        
        li.onclick = () => window.openChat('private', u.id, u.username, li);
        ulUsers.appendChild(li);
    });

    // 2. Groups
    const ulGroups = document.getElementById('groups-list');
    ulGroups.innerHTML = ''; 
    let gUnread = 0;
    
    allGroups.sort((a,b) => {
        const dA = a.last_activity ? new Date(a.last_activity).getTime() : 0; 
        const dB = b.last_activity ? new Date(b.last_activity).getTime() : 0;
        return dB - dA;
    });

    const uniqueGroups = Array.from(new Set(allGroups.map(a => a.id))).map(id => allGroups.find(a => a.id === id));

    uniqueGroups.forEach(g => {
        if(g.unread > 0) gUnread += g.unread;
        const badge = g.unread > 0 ? 'block' : 'none';
        const li = document.createElement('li');
        li.setAttribute('data-search-name', (g.name||'').toLowerCase());
        if(g.unread > 0) li.style.backgroundColor = '#e8f5e9';
        li.innerHTML = `<div style="display:flex;align-items:center;"><b style="font-size:1.2rem;margin-right:10px;color:#555;">${g.is_broadcast?'📢':'#'}</b><span style="${g.unread?'font-weight:bold;color:#2e7d32':''}">${g.name}</span></div><div class="unread-badge" style="display:${badge}">${g.unread}</div>`;
        li.onclick = () => window.openChat('group', g.id, g.name, li);
        ulGroups.appendChild(li);
    });

    const bu = document.getElementById('badge-users'); if(bu) { bu.textContent = uUnread; bu.style.display = uUnread?'inline-block':'none'; }
    const bg = document.getElementById('badge-groups'); if(bg) { bg.textContent = gUnread; bg.style.display = gUnread?'inline-block':'none'; }
    const s = document.getElementById('contact-search'); if(s && s.value) window.filterContacts(s.value);
};

// 4. CHAT
window.openChat = async (type, id, name, el) => {
    document.body.classList.add('mobile-active');
    document.getElementById('welcome-screen').style.display = 'none';
    document.getElementById('chat-interface').style.display = 'flex';
    document.getElementById('chat-title').textContent = name;
    
    document.getElementById('btn-mark-unread').style.display = (type==='private')?'block':'none';
    document.getElementById('group-settings-btn').style.display = (type==='group')?'block':'none';
    
    const sb = document.getElementById('search-box-chat'); if(sb) sb.style.display='none';
    window.searchInChat('');

    currentChatType = type; currentChatId = id; pinnedMessagesList = [];
    document.getElementById('messages').innerHTML = ''; window.cancelReply();
    
    document.querySelectorAll('li').forEach(x => x.classList.remove('active'));
    if(el) el.classList.add('active');
    
    const imgH = document.getElementById('chat-header-img'); 
    const deptSpan = document.getElementById('chat-dept');
    const form = document.getElementById('form'); 
    const note = document.getElementById('broadcast-notice');

    if(type === 'group') {
        if(imgH) imgH.style.display='none'; if(deptSpan) deptSpan.textContent="Grupo";
        fetch('/group/mark-read', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ groupId: id, userId: currentUser.id }) });
        const g = allGroups.find(x => x.id == id); if(g) { g.unread=0; window.renderLists(); }
        if(g && g.is_broadcast && !g.is_admin && !currentUser.is_super_admin) { if(form) form.style.display='none'; if(note) note.style.display='block'; } 
        else { if(form) form.style.display='flex'; if(note) note.style.display='none'; }
    } else {
        if(imgH) imgH.style.display='block'; if(form) form.style.display='flex'; if(note) note.style.display='none';
        const u = allUsers.find(x => x.id == id); if(u) { if(imgH) imgH.src=getAvatarUrl(u.photo); if(deptSpan) deptSpan.textContent=u.department||''; u.unread=0; window.renderLists(); window.markAsRead(id); }
    }
    
    chatOffset = 0;
    await window.loadChatHistory('initial');
    window.loadPinnedMessages(id, type); 
    window.scrollToBottom();
};

window.loadPinnedMessages = async function(tid, type) {
    // 1. Só carrega se ainda estivermos na mesma conversa
    if (tid != currentChatId) return;

    try {
        const r = await fetch('/chat/get-pinned', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                myId: currentUser.id, 
                targetId: tid, 
                targetType: type // <--- IMPORTANTE: Mapeamos 'type' para 'targetType'
            })
        });

        const d = await r.json();
        
        // 2. Atualiza a lista global de mensagens fixadas
        pinnedMessagesList = d.pinnedMessages || [];

        // 3. Reseta o índice se necessário (evita erros se a lista diminuiu)
        if (pinnedIndex >= pinnedMessagesList.length) pinnedIndex = 0;

        // 4. ATUALIZA A TELA (Faltava isto!)
        window.updatePinUI();

    } catch (e) {
        console.error("Erro ao carregar mensagens fixadas:", e);
    }
};
    window.scrollToBottom();
    setTimeout(window.scrollToBottom, 100);
    setTimeout(window.scrollToBottom, 300);


// 6. HISTÓRICO INTELIGENTE (DIA A DIA)
window.loadChatHistory = async (mode = 'initial') => {
    if(!currentChatId) return;
    
    let url = `/history/${currentUser.id}/${currentChatId}/${currentChatType}`;
    
    // MODO INICIAL: Carrega só HOJE (?filter=today)
    // MODO ANTIGO/SCROLL: Carrega offset normal
    
    if (mode === 'initial') {
        chatOffset = 0;
        // url += `?filter=today`; // REMOVIDO: Traz histórico padrão (últimas 30)
    } else {
        chatOffset += 30; 
        const currentCount = document.querySelectorAll('.msg-container').length;
        url += `?offset=${currentCount}`;
    }

    try {
        const res = await fetch(url);
        const msgs = await res.json();
        const container = document.getElementById('messages');
        
        if(!container) return;

        const oldBtn = document.getElementById('btn-load-more');
        if(oldBtn) oldBtn.remove();
        
        // Se for carregamento inicial e vazio
        if (msgs.length === 0 && mode === 'initial') {
            container.innerHTML = '<div style="text-align:center;color:#aaa;padding:20px;">Nenhuma mensagem encontrada.</div>';
            return;
        }

        if(msgs.length === 0 && mode !== 'initial') return;

        // --- CORREÇÃO DO SCROLL JUMP ---
        // Salvamos a altura e posição exata ANTES de inserir
        // const isAtBottom = container.scrollHeight - container.scrollTop === container.clientHeight;
        const oldScrollHeight = container.scrollHeight;
        const oldScrollTop = container.scrollTop;

        // Renderiza (sem jogar para baixo ainda)
        const render = (m, top) => window.addMessageToScreen({ ...m, userId: m.user_id, msgType: m.msg_type, fileName: m.file_name, raw_time: m.timestamp, reactions: m.reactions||[], is_read: m.is_read }, top);
        
        if (mode === 'initial') {
            // Se é inicial (Hoje), limpa tudo e desenha
            container.innerHTML = '';
            // Inverte pois vem do banco DESC (mais novo primeiro) -> mas queremos desenhar cronológico
            for(let i=msgs.length-1; i>=0; i--) render(msgs[i], false); // false = append no final
            
            // Adiciona botão "Ver Anteriores" no topo se quiser ver ontem
            const btn = document.createElement('button');
            btn.id='btn-load-more'; btn.className='load-more-btn'; btn.textContent='🔄 Ver histórico anterior';
            btn.onclick = () => window.loadChatHistory('history');
            container.insertBefore(btn, container.firstChild);

            window.updateDateSeparators();
            window.scrollToBottom();
            setTimeout(window.scrollToBottom, 100);

        } else {
            // HISTÓRICO (Carregando para cima)
            msgs.forEach(m => render(m, true));

            // Botão "Ver Mais"
            const btn = document.createElement('button');
            btn.id='btn-load-more'; btn.className='load-more-btn'; btn.textContent='🔄 Ver mais';
            btn.onclick = () => window.loadChatHistory('history');
            container.insertBefore(btn, container.firstChild);

            // Atualiza separadores (Isso adiciona altura!)
            window.updateDateSeparators();
            
            // RESTAURAÇÃO DE SCROLL (AGORA NO FINAL - CORRETO)
            // A diferença entre a NOVA altura total e a ANTIGA altura total
            // é exatamente o quanto de conteúdo foi adicionado no topo.
            // Se somarmos isso ao scroll, mantemos o usuário no mesmo ponto visual relativo ao conteúdo de baixo.
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = newScrollHeight - oldScrollHeight; 
        }

    } catch(e) { console.error(e); }
}; 



window.addMessageToScreen = (data, prepend=false) => {
    if(document.getElementById(`msg-${data.id}`)) return;
    if (data.msgType === 'system') {
        const div = document.createElement('div');
        div.className = 'system-msg-container';
        div.id = `msg-${data.id}`;
        div.innerHTML = `<span class="system-msg-pill">${data.text}</span>`;
        
        const container = document.getElementById('messages'); 
        if(prepend) { 
            const btn = document.getElementById('btn-load-more'); 
            if(btn) container.insertBefore(div, btn.nextSibling); 
            else container.insertBefore(div, container.firstChild); 
        } else { 
            container.appendChild(div); 
            container.scrollTop = container.scrollHeight; 
        }
        return; // Para por aqui, não renderiza balão normal
    }
    const div = document.createElement('div');
    const isMine = data.userId == currentUser.id;
    div.className = isMine ? 'msg-container mine' : 'msg-container other';
    div.id = `msg-${data.id}`;
    if(data.raw_time) div.setAttribute('data-date', data.raw_time);

    let editedHtml = data.is_edited ? `<small class="edited-label" style="font-size:0.7rem; color:#999; margin-left:5px;">Editada ${new Date(data.raw_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</small>` : '';
    let content = `<span id="msg-text-${data.id}" class="msg-text">${formatMessage(data.text)}</span>${editedHtml}`;
    
    if(data.reply_text) {
        content = `<div class="reply-container" onclick="window.scrollToMsg(${data.reply_to_id})"><div class="reply-author">${data.reply_user}</div><div class="reply-preview">${formatMessage(data.reply_text).substring(0,60)}...</div></div>` + content;
    }

    if(data.fileName) {
        const ext = data.fileName.split('.').pop().toLowerCase();
        const isImg = ['jpg','jpeg','png','gif','webp'].includes(ext);
        const url = `/uploads/${data.fileName}`;
        if(isImg) {
            content = `<div class="image-wrapper"><img src="${url}" class="chat-image-preview" onclick="event.stopPropagation(); window.openImageZoom('${url}')"><a href="${url}" download="${data.fileName}" class="download-btn-overlay">⬇️ Baixar</a></div>`;
            if(data.text && data.text!==data.fileName) content += `<div class="image-caption"><span id="msg-text-${data.id}">${formatMessage(data.text)}</span>${editedHtml}</div>`;
        } else {
            content = `<a href="${url}" target="_blank" class="chat-file-link">📎 ${data.fileName}</a>`;
        }
    }
    if(data.is_deleted) content = `<span class="deleted">🚫 Apagada</span>`;
    
    let reactionsHtml = `<div class="reactions-bar" id="reacts-${data.id}">`;
    if(data.reactions && data.reactions.length > 0) {
        const counts = {}; 
        const names = {};
        
        data.reactions.forEach(r => { 
            counts[r.r] = (counts[r.r] || 0) + 1; 
            const u = allUsers.find(x => x.id == r.u);
            const name = u ? u.username : 'Alguém';
            if(!names[r.r]) names[r.r] = [];
            names[r.r].push(name);
        });

        for (const [emoji, count] of Object.entries(counts)) { 
            const txt = count > 1 ? `${emoji} ${count}` : emoji; 
            const people = names[emoji].join(', ');
            reactionsHtml += `<span class="reaction-bubble" title="${people}" onclick="event.stopPropagation(); window.openReactionsModal(${data.id})">${txt}</span>`; 
        }
    }
    reactionsHtml += `</div>`;

    let menuBtn = '';
    if (!data.is_deleted) menuBtn = `<button class="msg-menu-btn" onclick="toggleMsgMenu(${data.id}, this)">⌄</button>`;

    const safeUser = (data.user||data.username||"").replace(/'/g, "\\'");
    const safeText = (data.text||"").replace(/'/g, "\\'").replace(/\n/g, " ");

    let menuHtml = `
    <div class="msg-dropdown" id="menu-${data.id}" style="display:none;">
        <div class="reaction-row">
            <span onclick="sendReaction(${data.id},'👍')">👍</span><span onclick="sendReaction(${data.id},'❤️')">❤️</span><span onclick="sendReaction(${data.id},'😂')">😂</span><span onclick="sendReaction(${data.id},'😮')">😮</span><span onclick="sendReaction(${data.id},'😢')">😢</span>
        </div>
        <div class="menu-divider"></div>
        <div class="menu-item" onclick="replyMessage(${data.id}, '${safeUser}', '${safeText.substring(0,30)}')">↩️ Responder</div>
        <div class="menu-item" onclick="openForwardModal(${data.id})">↪️ Encaminhar</div>
        ${(currentChatType === 'group') ? `<div class="menu-item" onclick="openReadersModal(${data.id})">👁️ Quem Viu</div>` : ''}
        ${(isMine) ? `<div class="menu-item" onclick="editMessage(${data.id}, '${safeText}')">✏️ Editar</div>` : ''}
        ${(currentUser.is_super_admin || isMine) ? `<div class="menu-item" onclick="deleteMessage(${data.id})">🗑️ Apagar</div>` : ''}
        <div class="menu-item" onclick="pinMessage(${data.id})">📌 Fixar</div>
    </div>`;

    let statusHtml = '';
    if(isMine) {
        const statusClass = data.is_read ? 'read' : '';
        statusHtml = `<span class="msg-status read-ticks ${statusClass}">✓✓</span>`; 
    }

    let avatarHtml = '';
    if(!isMine) {
        let photoUrl = '/avatar.png';
        const sender = allUsers.find(u => u.id == data.userId);
        if(sender) photoUrl = getAvatarUrl(sender.photo);
        else if(data.user_photo) photoUrl = getAvatarUrl(data.user_photo);
        avatarHtml = `<img src="${photoUrl}" class="chat-msg-avatar" onclick="event.stopPropagation(); window.openImageZoom('${photoUrl}')" title="${data.user||''}">`;
    }

    if(isMine) {
        div.innerHTML = `${menuBtn}<div class="message-bubble" id="msg-bubble-${data.id}"><div class="msg-header"><b>Você</b> <small>${data.time}</small></div>${content}${reactionsHtml}<div style="text-align:right; margin-top:-5px;">${statusHtml}</div></div>${menuHtml}`;
    } else {
        div.innerHTML = `${avatarHtml}<div class="message-bubble" id="msg-bubble-${data.id}"><div class="msg-header"><b>${data.user||data.username}</b> <small>${data.time}</small></div>${content}${reactionsHtml}</div>${menuBtn}${menuHtml}`;
    }
        
    const container = document.getElementById('messages'); 
    if(prepend) { const btn = document.getElementById('btn-load-more'); if(btn) container.insertBefore(div, btn.nextSibling); else container.insertBefore(div, container.firstChild); } 
    else { container.appendChild(div); if(isMine) container.scrollTop = container.scrollHeight; }
    setTimeout(() => window.updateDateSeparators(), 10);
};

window.toggleMsgMenu = (id, btnElement) => {
    const menu = document.getElementById(`menu-${id}`);
    if(!menu) return;
    const isVisible = menu.style.display === 'block';
    document.querySelectorAll('.msg-dropdown').forEach(m => m.style.display='none');
    if(!isVisible) {
        menu.style.display = 'block';
        if(btnElement) {
            const rect = btnElement.getBoundingClientRect();
            if(window.innerHeight - rect.bottom < 200) menu.classList.add('upwards'); else menu.classList.remove('upwards');
        }
        setTimeout(() => { document.addEventListener('click', function close(e) { if(!e.target.closest(`#menu-${id}`) && !e.target.closest(`.msg-menu-btn`)) { menu.style.display='none'; document.removeEventListener('click', close); } }); }, 10);
    }
};

window.sendMessage = () => {
    const input = document.getElementById('input');
    if(input.value.trim() && currentChatId) {
        socket.emit('chat message', { 
            userId: currentUser.id, 
            msg: input.value, 
            targetId: currentChatId, 
            targetType: currentChatType, 
            replyToId: replyingTo ? replyingTo.id : null 
        });
        if(currentChatType === 'private') { const u = allUsers.find(x => x.id == currentChatId); if(u) { u.last_activity = new Date(); window.renderLists(); } }
        input.value = ''; window.cancelReply();
    }
};

// 5. SOCKET LISTENERS
socket.on('error message', (msg) => { window.playNotificationSound(); alert(msg); if(currentChatId) window.loadChatHistory('initial'); });

socket.on('chat message', (data) => {
        // LÓGICA DE VISIBILIDADE:
        // A mensagem deve aparecer na tela SE:
        // 1. É um GRUPO e eu estou com esse grupo aberto.
        // 2. É PRIVADO e eu estou falando com quem enviou.
        // 3. É PRIVADO e EU enviei (de outra aba/celular), independente de para quem foi.

        let isChatOpen = false;

        if (currentChatType === 'group' && data.targetType === 'group') {
            // Se estou no grupo certo
            if (currentChatId == data.targetId) isChatOpen = true;
        } 
        else if (currentChatType === 'private' && data.targetType === 'private') {
            // Se recebi de quem estou falando (data.userId) 
            // OU se eu mandei (data.userId == eu) e estou no chat com o destino (data.targetId)
            if (data.userId == currentChatId || (data.userId == currentUser.id && data.targetId == currentChatId)) {
                isChatOpen = true;
            }
        }

        if (isChatOpen) {
            // TOCA SOM TAMBÉM (Se não fui eu)
            if (data.userId !== currentUser.id) window.playNotificationSound();

            // Mostra a mensagem
            addMessageToScreen(data);
            scrollToBottom();
            
            // Marca como lido se não fui eu que mandei
            if (data.userId !== currentUser.id && data.targetType === 'private') {
                fetch('/mark-read', { 
                    method:'POST', 
                    headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ myId: currentUser.id, targetId: data.userId })
                });
            }
        } else {
            // --- CORREÇÃO AQUI ---
            // Chamamos a função mestre que toca som, pisca a aba e manda notificação do Windows
            window.notifyUser(data); 
            // --------------------- 
            // ---------------------
            
            // Atualiza contadores na lista lateral
            if (data.targetType === 'group') {
                const g = allGroups.find(x => x.id == data.targetId);
                if (g) { g.unread = (g.unread||0)+1; g.last_activity = new Date(); }
            } else {
                // No privado, quem mandou foi 'data.userId', então procuro ele na minha lista
                const senderId = data.userId;
                // Se FUI EU que mandei (de outra aba), não notifica a mim mesmo
                if (senderId !== currentUser.id) {
                    const u = allUsers.find(x => x.id == senderId);
                    if (u) { u.unread = (u.unread||0)+1; u.last_interaction = new Date(); }
                }
            }
            renderLists();
        }
    });

socket.on('update online list', (ids) => { onlineIds = ids; window.renderLists(); });
socket.on('refresh data', () => window.loadData());

socket.on('message updated', (d) => { 
    const e = document.getElementById(`msg-text-${d.messageId}`); 
    if(e) {
        // Atualiza o texto
        e.innerHTML = formatMessage(d.newText);
        
        // Verifica se já tem a etiqueta de "Editada"
        const parent = e.parentNode; // .message-bubble ou .image-caption
        const existingLabel = parent.querySelector('.edited-label');
        
        if (d.isEdited) {
            const timeString = d.editedTime || new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
            const labelText = `Editada às ${timeString}`;

            if (!existingLabel) {
                const label = document.createElement('small');
                label.className = 'edited-label';
                label.style.cssText = "font-size:0.65rem; color:#757575; font-style:italic; margin-left:5px; display:block; text-align:right;";
                label.textContent = labelText;
                // Insere logo após o texto
                e.insertAdjacentElement('afterend', label);
            } else {
                existingLabel.textContent = labelText;
            }
        }
    } 
});

socket.on('message pinned', (data) => {
    // 1. Verifica se o evento pertence ao chat que estou a ver agora
    let isForCurrentChat = false;

    if (currentChatType === 'group' && data.targetType === 'group') {
        // Se for grupo, o ID do grupo tem de bater
        if (data.targetId == currentChatId) isForCurrentChat = true;
    } 
    else if (currentChatType === 'private' && data.targetType === 'private') {
        // Se for privado, serve se:
        // A) O 'targetId' do evento for quem eu estou vendo (eu fixei pra ele)
        // B) O 'userId' do evento for quem eu estou vendo (ele fixou pra mim)
        if (data.targetId == currentChatId || data.userId == currentChatId) {
            isForCurrentChat = true;
        }
    }

    if (isForCurrentChat) {
        // 2. ATUALIZA A BARRA AMARELA NO TOPO (Fundamental!)
        // Isto vai buscar a lista atualizada ao servidor e mostrar a barra
        window.loadPinnedMessages(currentChatId, currentChatType);

        // 3. Atualiza o estilo visual da bolha da mensagem (borda/cor)
        const el = document.getElementById(`msg-${data.messageId}`);
        if (el) {
            if (data.action === 'pin') el.classList.add('pinned-message');
            else el.classList.remove('pinned-message');
        }
    }
});
// --- NAVEGAÇÃO ENTRE MENSAGENS FIXADAS ---

window.nextPin = function() {
    // Se não tiver lista ou só tiver 1 mensagem, não faz nada
    if (!pinnedMessagesList || pinnedMessagesList.length <= 1) return;
    
    // Avança o índice
    pinnedIndex++;
    
    // Se passar do fim, volta para o começo (Loop)
    if (pinnedIndex >= pinnedMessagesList.length) pinnedIndex = 0;
    
    // Atualiza a barra com a nova mensagem
    window.updatePinUI();
};

window.prevPin = function() {
    if (!pinnedMessagesList || pinnedMessagesList.length <= 1) return;
    
    // Recua o índice
    pinnedIndex--;
    
    // Se for menor que 0, vai para a última mensagem (Loop reverso)
    if (pinnedIndex < 0) pinnedIndex = pinnedMessagesList.length - 1;
    
    window.updatePinUI();
};
socket.on('message deleted', (d) => { const b = document.getElementById(`msg-bubble-${d.messageId}`); if(b) { const h = b.querySelector('.msg-header').outerHTML; b.innerHTML = `${h}<div class="deleted-content" style="color:#aaa;font-style:italic">🚫 Mensagem apagada</div>`; const c = document.getElementById(`msg-${d.messageId}`); if(c) { const a = c.querySelector('.msg-actions'); if(a) a.remove(); } } window.loadPinnedMessages(currentChatId, currentChatType); });
socket.on('read confirmation', (d) => { if(currentChatType === 'private' && currentChatId == d.readerId) document.querySelectorAll('.read-ticks').forEach(e => e.classList.add('read')); });

socket.on('message reaction', (data) => {
    const bubble = document.getElementById(`msg-bubble-${data.messageId}`);
    if (bubble) {
        let bar = document.getElementById(`reacts-${data.messageId}`);
        if (!bar) { bar = document.createElement('div'); bar.className = 'reactions-bar'; bar.id = `reacts-${data.messageId}`; bubble.appendChild(bar); }
        let existingBubble = null;
        Array.from(bar.children).forEach(child => { if(child.textContent.includes(data.reaction)) existingBubble = child; });

        const u = allUsers.find(x => x.id == data.userId);
        const newName = u ? u.username : 'Alguém';

        if(data.action === 'add') {
            if(existingBubble) {
                const parts = existingBubble.textContent.split(' ');
                let count = 1; if(parts.length > 1) count = parseInt(parts[1]) || 1;
                count++; existingBubble.textContent = `${data.reaction} ${count}`;
                let currentTitle = existingBubble.getAttribute('title') || "";
                existingBubble.setAttribute('title', currentTitle + ", " + newName);
            } else {
                const span = document.createElement('span'); 
                span.className = 'reaction-bubble'; 
                span.textContent = data.reaction; 
                span.setAttribute('title', newName);
                bar.appendChild(span);
            }
        } else {
            if(existingBubble) {
                const parts = existingBubble.textContent.split(' ');
                let count = 1; if(parts.length > 1) count = parseInt(parts[1]) || 1;
                if(count > 1) { count--; existingBubble.textContent = (count > 1) ? `${data.reaction} ${count}` : data.reaction; } else { existingBubble.remove(); }
            }
        }
        // Atualiza o onclick caso mude o autor da reação
        existingBubble = null;
        Array.from(bar.children).forEach(child => { if(child.textContent.includes(data.reaction)) existingBubble = child; });
        if(existingBubble) existingBubble.onclick = (e) => { e.stopPropagation(); window.openReactionsModal(data.messageId); };
    }
});

socket.on('refresh group members', () => {
        // Se a janelinha de configurações estiver aberta neste grupo, recarrega a lista
        const settingsModal = document.getElementById('settings-modal');
        if (settingsModal.style.display === 'flex' && currentChatType === 'group') {
            window.loadGroupSettings();
        }
    });

    socket.on('group deleted', () => {
        if (currentChatType === 'group') {
            alert('Este grupo foi excluído.');
            window.closeChat();
            window.loadData(); // Recarrega a lista lateral
        }
    });

    socket.on('you were added', () => {
        // Recarrega a lista do servidor (vai trazer o grupo novo)
        // O loadData já cuida de entrar na sala do socket automaticamente
        window.loadData();
        
        // Toca o som de notificação
        window.playNotificationSound();
    });

    socket.on('you were removed', (data) => {
        // Se eu estiver com esse chat aberto, fecha na cara!
        if (currentChatType === 'group' && currentChatId == data.groupId) {
            alert('Você foi removido deste grupo.');
            window.closeChat();
        }
        // Atualiza a lista lateral para o grupo sumir
        window.loadData();
    });

// OUTROS
window.uploadFile=async function(f=null){if(isUploading)return;let file=f instanceof File?f:document.getElementById('file-input').files[0];if(!file||!currentChatId)return;const caption=document.getElementById('input').value.trim();isUploading=true;document.body.style.cursor='wait';try{const fd=new FormData();fd.append('file',file);const r=await fetch('/upload',{method:'POST',body:fd});const d=await r.json();if(d.success){socket.emit('chat message',{userId:currentUser.id,msg:caption.length>0?caption:d.originalName,targetId:currentChatId,targetType:currentChatType,msgType:'file',fileName:d.filename});document.getElementById('input').value=''}}catch(e){alert("Erro upload")}finally{document.body.style.cursor='default';document.getElementById('file-input').value='';isUploading=false}};
window.openAdminControl=async function(tid){
    const m=document.getElementById('admin-control-modal');
    if(!m)return;
    document.getElementById('admin-target-name').textContent="Carregando...";
    m.style.display='flex';
    
    let btnDel = document.getElementById('btn-admin-delete-user');
    if(!btnDel) {
        const container = m.querySelector('.modal');
        btnDel = document.createElement('button');
        btnDel.id = 'btn-admin-delete-user';
        btnDel.style.cssText = "background: #d32f2f; color: white; width: 100%; padding: 10px; border: none; border-radius: 5px; margin-top: 10px; cursor: pointer;";
        btnDel.textContent = "🗑️ Excluir Usuário Permanentemente";
        const actions = m.querySelector('.modal-actions');
        container.insertBefore(btnDel, actions);
    }
    btnDel.onclick = () => window.deleteUser(tid);

    const r=await fetch('/admin/user-control-data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({adminId:currentUser.id,targetUserId:tid})});
    const d=await r.json();
    if(d.success){
        document.getElementById('admin-target-name').textContent=d.user.username;
        document.getElementById('admin-target-id').value=d.user.id;
        const b=document.getElementById('btn-admin-promote');
        if(b)b.textContent=d.user.is_super_admin?"🔽 Remover Admin":"👑 Tornar Admin";
        const l=document.getElementById('admin-sector-list');
        l.innerHTML="";
        (d.availableSectors||[]).sort().forEach(s=>{l.innerHTML+=`<div><input type="checkbox" ${d.restrictedList.includes(s)?'checked':''} onchange="toggleRestriction('${s}',this.checked)"> ${s}</div>`})
    }
};
window.deleteUser = async function(tid) {
    if(confirm("ATENÇÃO: Isso apagará o usuário e todas as mensagens dele. Tem certeza?")) {
        const reason = prompt("Digite 'DELETAR' para confirmar:");
        if(reason === 'DELETAR') {
            await fetch('/admin/delete-user', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({adminId:currentUser.id, targetUserId:tid})});
            document.getElementById('admin-control-modal').style.display='none';
            alert("Usuário excluído.");
            window.loadData();
        }
    }
};
window.toggleRestriction=async function(d,c){await fetch('/admin/toggle-restriction',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({adminId:currentUser.id,targetUserId:document.getElementById('admin-target-id').value,department:d,action:c?'add':'remove'})})};
window.toggleAdminRole=async function(){if(confirm("Mudar Admin?"))await fetch('/admin/toggle-admin-role',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({adminId:currentUser.id,targetUserId:document.getElementById('admin-target-id').value})});window.openAdminControl(document.getElementById('admin-target-id').value)};
window.openFullAudit=function(){window.open(`/audit.html?target=${document.getElementById('admin-target-id').value}`,'_blank')};

// --- NOVAS FUNÇÕES DE CRIAÇÃO DE USUÁRIO (ADMIN) ---
window.openUserModal = async function() {
    document.getElementById('user-modal').style.display = 'flex';
    const select = document.getElementById('new-user-department');
    select.innerHTML = '<option value="" disabled selected>Carregando...</option>';
    
    try {
        const res = await fetch('/api/departments');
        const depts = await res.json();
        select.innerHTML = '<option value="" disabled selected>Selecionar Departamento</option>';
        depts.forEach(cat => {
            const group = document.createElement('optgroup');
            group.label = cat.category;
            cat.departments.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d; opt.textContent = d;
                group.appendChild(opt);
            });
            select.appendChild(group);
        });
    } catch (e) { console.error("Erro ao carregar departamentos", e); }
};

window.createUser = async function() {
    const u = document.getElementById('new-user-username').value.trim();
    const p = document.getElementById('new-user-password').value.trim();
    const d = document.getElementById('new-user-department').value;
    
    if(!u || !p || !d) return alert("Preencha todos os campos.");
    
    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ username: u, password: p, department: d, adminId: currentUser.id })
        });
        const data = await res.json();
        if(data.success) {
            alert("Usuário criado com sucesso!");
            document.getElementById('user-modal').style.display = 'none';
            document.getElementById('new-user-username').value = '';
            document.getElementById('new-user-password').value = '';
            window.loadData();
        } else {
            alert(data.message || "Erro ao criar usuário.");
        }
    } catch (e) { console.error(e); alert("Erro de conexão."); }
};
// --- GALERIA DE MÍDIA ---
window.openMediaGallery = async function() {
    if(!currentChatId) return;
    const modal = document.getElementById('media-modal');
    const container = document.getElementById('media-gallery-content');
    modal.style.display = 'flex';
    container.innerHTML = '<div style="color:#666; padding:20px; text-align:center; width:100%;">Carregando mídias...</div>';

    try {
        const res = await fetch(`/chat/get-media/${currentUser.id}/${currentChatId}/${currentChatType}`);
        const data = await res.json();
        
        if(!data.success || !data.media || data.media.length === 0) {
            container.innerHTML = '<div style="color:#aaa; padding:20px; text-align:center; width:100%;">Nenhuma mídia encontrada nesta conversa.</div>';
            return;
        }

        container.innerHTML = '';
        data.media.forEach(m => {
            const ext = m.file_name.split('.').pop().toLowerCase();
            const isImg = ['jpg','jpeg','png','gif','webp'].includes(ext);
            const url = `/uploads/${m.file_name}`;

            const item = document.createElement('div');
            item.className = 'media-item';
            
            if(isImg) {
                item.innerHTML = `
                    <img src="${url}" onclick="window.openImageZoom('${url}')" title="${m.text || m.file_name}">
                    <div class="media-info">${new Date(m.timestamp).toLocaleDateString()}</div>
                `;
            } else {
                item.innerHTML = `
                    <div class="file-icon" onclick="window.open('${url}', '_blank')">📄</div>
                    <div class="file-name" title="${m.file_name}">${m.file_name}</div>
                    <div class="media-info">${new Date(m.timestamp).toLocaleDateString()}</div>
                `;
            }
            container.appendChild(item);
        });
    } catch (e) {
        console.error("Erro ao carregar galeria:", e);
        container.innerHTML = '<div style="color:red; padding:20px; text-align:center; width:100%;">Erro ao carregar mídias.</div>';
    }
};

window.notifyUser=(d)=>{if(d.userId!==currentUser.id)window.playNotificationSound();if(document.hidden && d.userId!==currentUser.id){unreadCountGlobal++;if(!blinkInterval)blinkInterval=setInterval(()=>{document.title=document.title===originalTitle?`(${unreadCountGlobal}) Nova Msg!`:originalTitle},1000);if("Notification"in window&&Notification.permission==="granted"){new Notification("NeuroChat",{body:d.targetType==='group'?'Grupo':d.user,icon:'/avatar.png',silent:true}).onclick=function(){window.focus();this.close()}}}};
window.markAsRead=async(sid)=>{await fetch('/mark-read',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({myId:currentUser.id,senderId:sid})})};
// --- CORREÇÃO: Atualiza a lista ANTES de perder a referência do ID ---
window.markChatUnread = async () => {
    // 1. Salva o ID e Tipo antes de fechar a janela
    const targetId = currentChatId;
    const targetType = currentChatType;

    if (targetId && targetType === 'private') {
        try {
            // 2. Manda para o servidor
            await fetch('/chat/mark-unread', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ myId: currentUser.id, targetId: targetId })
            });

            // 3. Fecha a janela de chat
            window.closeChat();

            // 4. Atualiza a lista VISUALMENTE agora (sem esperar reload)
            const u = allUsers.find(x => x.id == targetId);
            if (u) {
                // Soma 1 ou define como 1 se estiver zerado
                u.unread = (u.unread || 0) + 1; 
                // Força o usuário a ir para o topo da lista
                u.last_activity = new Date(); 
                window.renderLists();
            }

        } catch (e) {
            console.error(e);
        }
    }
};
window.sendReaction = async (mid, r) => {
    document.getElementById(`menu-${mid}`).style.display='none';
    await fetch('/message/react', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
            messageId: mid,
            userId: currentUser.id,
            reaction: r,
            targetId: currentChatId,   // <--- IMPORTANTE
            targetType: currentChatType // <--- IMPORTANTE
        })
    });
};
window.replyMessage=(id,user,text)=>{replyingTo={id,user,text};document.getElementById('reply-area').style.display='flex';document.getElementById('reply-user').textContent=user;document.getElementById('reply-text').textContent=text;document.getElementById('input').focus()};
window.cancelReply=()=>{replyingTo=null;document.getElementById('reply-area').style.display='none'};window.closeChat=()=>{document.body.classList.remove('mobile-active');document.getElementById('welcome-screen').style.display='flex';document.getElementById('chat-interface').style.display='none';currentChatId=null};
// Função de Logout Global (Substitui a da linha 426)
window.logout = () => {
    if (confirm("Deseja realmente sair?")) {
        // Limpa TUDO o que é do sistema (Chat, Financeiro, Login)
        localStorage.clear(); 
        sessionStorage.clear();
        
        // Desconecta o socket para não ficar "fantasma" online
        if (socket) socket.disconnect();

        // Manda para a tela de login
        window.location.href = '/index.html'; 
    }
};
window.stopBlinking=()=>{clearInterval(blinkInterval);blinkInterval=null;unreadCountGlobal=0;document.title=originalTitle};document.addEventListener('visibilitychange',()=>{if(!document.hidden)window.stopBlinking()});
window.loadPinnedMessages = async function(tid, type) {
    // 1. Segurança: Só carrega se ainda estivermos com este chat aberto
    if (tid != currentChatId) return; 

    try {
        const r = await fetch('/chat/get-pinned', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                myId: currentUser.id, 
                targetId: tid, 
                
                // --- CORREÇÃO IMPORTANTE ---
                // O Controller espera 'targetType', então mapeamos a variável 'type' para esse nome
                targetType: type 
            })
        });

        const d = await r.json();
        
        // Atualiza a lista global
        pinnedMessagesList = d.pinnedMessages || [];

        // Reseta o índice se a lista diminuiu (para não dar erro de índice inválido)
        if (pinnedIndex >= pinnedMessagesList.length) pinnedIndex = 0;

        // --- FALTAVA ESTA LINHA ---
        // Chama a função que desenha a barra amarela na tela
        window.updatePinUI();

    } catch (e) {
        console.error("Erro ao carregar mensagens fixadas:", e);
    }
};

window.updatePinUI = function() {
    const b = document.getElementById('pinned-bar');
    if (!b) return;

    // Reseta visualmente
    b.style.display = 'none';
    b.innerHTML = '';

    if (pinnedMessagesList && pinnedMessagesList.length > 0) {
        // Garante que o índice é válido
        if (pinnedIndex >= pinnedMessagesList.length) pinnedIndex = 0;
        
        const m = pinnedMessagesList[pinnedIndex];
        
        // Define o texto (se for arquivo, mostra ícone)
        const displayText = (m.msgType === 'file' || m.file_name) 
            ? `📎 Arquivo: ${m.fileName || m.text}` 
            : m.text;

        // Navegação (se tiver mais de uma mensagem fixada)
        const navArrows = pinnedMessagesList.length > 1 
            ? `<span onclick="event.stopPropagation(); prevPin()" style="cursor:pointer;margin-right:10px;font-weight:bold;">❮</span> 
               <small>${pinnedIndex + 1}/${pinnedMessagesList.length}</small> 
               <span onclick="event.stopPropagation(); nextPin()" style="cursor:pointer;margin-left:10px;font-weight:bold;">❯</span>` 
            : '';

        // Monta o HTML com as classes CSS que criámos
        b.innerHTML = `
            <div class="pinned-content" onclick="scrollToMsg(${m.id})">
                ${navArrows} 
                <span style="margin-left:10px;">
                    <b>📌 ${m.username || 'Alguém'}:</b> ${displayText}
                </span>
            </div>
            <button class="pinned-close-btn" onclick="event.stopPropagation(); unpinMessage(${m.id})" title="Desafixar">✕</button>
        `;
        
        // FORÇA O DISPLAY FLEX
        b.style.display = 'flex';
        console.log("📌 Barra Atualizada e Exibida:", m.text); // Log para confirmar
    }
};
window.pinMessage = async (mid) => {
    await fetch('/message/pin', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
            messageId: mid,
            targetId: currentChatId,
            targetType: currentChatType,
            userId: currentUser.id,
            action: 'pin'
        })
    });
};
window.unpinMessage=async(mid)=>{await fetch('/message/pin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messageId:mid,targetId:currentChatId,targetType:currentChatType,userId:currentUser.id,action:'unpin'})})};
window.deleteMessage=async(mid)=>{if(confirm('Excluir?'))await fetch('/message/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messageId:mid})})};
window.editMessage = (id, txt) => {
    const n = prompt('Editar mensagem:', txt);
    if (n && n !== txt) {
        fetch('/message/edit', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ 
                messageId: id, 
                userId: currentUser.id, 
                newText: n 
            })
        })
        .then(res => res.json())
        .then(data => {
            if(!data.success) {
                alert("❌ Erro: " + (data.message || "Não foi possível editar."));
            }
        });
    }
};
// Exemplo de como usar a rota de admin
window.viewAdminHistory = async (targetUserId) => {
    const res = await fetch('/admin/history', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ adminId: currentUser.id, targetUserId: targetUserId })
    });
    const data = await res.json();
    if(data.success) {
        console.log("Histórico:", data.messages);
        alert("Histórico carregado no Console do Navegador (F12)!");
    } else {
        alert("Erro ao carregar histórico: " + data.message);
    }
};
window.toggleChatSearch = function() { const box = document.getElementById('search-box-chat'); if(box.style.display === 'none') { box.style.display = 'flex'; document.getElementById('chat-search-input').focus(); } else { box.style.display = 'none'; window.searchInChat(''); } };
window.searchInChat = function(t) { document.querySelectorAll('.msg-container').forEach(e => e.querySelector('.message-bubble').style.background = ''); if (!t || !t.trim()) { searchResults = []; searchIndex = -1; document.getElementById('search-count-display').textContent = ''; return; } searchResults = []; const term = t.toLowerCase(); document.querySelectorAll('.msg-container').forEach(m => { if (m.querySelector('.message-bubble').textContent.toLowerCase().includes(term)) searchResults.push(m); }); if (searchResults.length > 0) { searchIndex = searchResults.length - 1; updateSearchUI(); scrollToSearchResult(); } else { searchIndex = -1; document.getElementById('search-count-display').textContent = '0/0'; } };
window.updateSearchUI = function() { document.getElementById('search-count-display').textContent = `${searchIndex + 1}/${searchResults.length}`; };
window.scrollToSearchResult = function() { const el = searchResults[searchIndex]; if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.querySelector('.message-bubble').style.background = '#fff59d'; } };
window.nextSearch = function() { if (searchResults.length === 0) return; searchIndex++; if (searchIndex >= searchResults.length) searchIndex = 0; updateSearchUI(); scrollToSearchResult(); };
window.prevSearch = function() { if (searchResults.length === 0) return; searchIndex--; if (searchIndex < 0) searchIndex = searchResults.length - 1; updateSearchUI(); scrollToSearchResult(); };
window.loadDepartmentsForProfile = async function() {
    try {
        const res = await fetch('/api/departments');
        const depts = await res.json();
        const select = document.getElementById('profile-department');
        
        // Salva o valor atual caso já tenha selecionado algo ou esteja editando
        const currentVal = select.getAttribute('data-value') || select.value;
        
        select.innerHTML = '<option value="" disabled selected>Carregando...</option>';
        
        // Remove optgroups antigos se tiver (mas estamos reescrevendo innerHTML)
        select.innerHTML = '<option value="" disabled>Selecione seu Departamento</option>';

        depts.forEach(cat => {
            const group = document.createElement('optgroup');
            group.label = cat.category;
            cat.departments.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d;
                opt.textContent = d;
                if(d === currentVal) opt.selected = true;
                group.appendChild(opt);
            });
            select.appendChild(group);
        });

        // Se o currentVal não bateu com nenhum, reseta (ou mantém se for texto livre antigo)
        if(currentVal && select.value !== currentVal) {
             // Opcional: Adicionar o valor antigo como opção extra se não existir na lista nova
             const opt = document.createElement('option');
             opt.value = currentVal;
             opt.textContent = currentVal + " (Antigo)";
             opt.selected = true;
             select.appendChild(opt);
        }

    } catch (error) {
        console.error("Erro ao carregar departamentos:", error);
    }
};

window.openProfileModal = function() { 
    document.getElementById('profile-username').value = currentUser.username; 
    
    // Store current dept to set as selected after loading
    const s = document.getElementById('profile-department');
    if(s) s.setAttribute('data-value', currentUser.department || "");
    
    document.getElementById('profile-password').value = ''; 
    document.getElementById('profile-photo-input').value = ''; 
    document.getElementById('profile-modal').style.display = 'flex';
    
    // Carrega dinâmico
    window.loadDepartmentsForProfile();
};
window.saveProfile = async function() {
    const n = document.getElementById('profile-username').value.trim();
    const d = document.getElementById('profile-department').value;
    const p = document.getElementById('profile-password').value;
    const f = document.getElementById('profile-photo-input').files[0];

    if (!n) return alert("Nome não pode ser vazio.");
    if (!d) return alert("Selecione um departamento.");

    const fd = new FormData();
    fd.append('userId', currentUser.id);
    fd.append('username', n);
    fd.append('department', d);
    if (p) fd.append('password', p);
    if (f) fd.append('photo', f); 

    const btn = document.querySelector('#profile-modal .btn-create');
    btn.textContent = "Salvando...";
    btn.disabled = true;

    try {
        const res = await fetch('/update-profile', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.success) {
            alert('✅ Perfil atualizado com sucesso!');
            currentUser.username = n;
            currentUser.department = d;
            if (data.photo) currentUser.photo = data.photo; 
            if (data.photo) currentUser.photo = data.photo; 
            localStorage.setItem('neurochat_user', JSON.stringify(currentUser));
            window.updateMyInfo();
            window.updateMyInfo();
            document.getElementById('profile-modal').style.display = 'none';
        } else {
            alert("❌ Erro: " + (data.message || "Falha ao atualizar."));
        }
    } catch (e) { console.error(e); alert("❌ Erro de conexão."); } finally { btn.textContent = "Salvar"; btn.disabled = false; }
};
window.openUpdatesModal = function() { document.getElementById('updates-modal').style.display = 'flex'; };
window.openImageZoom = function(src) { document.getElementById('img-zoom-target').src = src; document.getElementById('image-zoom-modal').style.display = 'flex'; };
window.closeImageZoom = function() { document.getElementById('image-zoom-modal').style.display = 'none'; };
window.openModalCreate = function() { const l = document.getElementById('modal-users-list'); l.innerHTML = ''; const h = document.createElement('div'); h.innerHTML = `<input type="checkbox" onchange="toggleAll(this)"> Selecionar Todos`; l.appendChild(h); allUsers.forEach(u => { if(u.id !== currentUser.id) { l.innerHTML += `<div class="user-checkbox-item"><input type="checkbox" class="user-sel" value="${u.id}"> ${u.username}</div>`; } }); document.getElementById('group-modal').style.display = 'flex'; };
window.toggleAll = function(s) { document.querySelectorAll('.user-sel').forEach(c => c.checked = s.checked); };
window.createGroup = async function() {
    const n = document.getElementById('new-group-name').value;
    const ib = document.getElementById('is-broadcast').checked;
    const m = Array.from(document.querySelectorAll('.user-sel:checked')).map(x => x.value);

    // Permite criar grupo sem membros (só o nome é obrigatório)
    if (!n) return alert('Digite o nome do grupo.');

    try {
        const res = await fetch('/create-group', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: n, creatorId: currentUser.id, members: m, isBroadcast: ib })
        });
        
        const data = await res.json();

        if (data.success) {
            document.getElementById('group-modal').style.display = 'none';
            // Limpa o form
            document.getElementById('new-group-name').value = '';
            document.querySelectorAll('.user-sel').forEach(x => x.checked = false);
            
            // ATUALIZA A LISTA IMEDIATAMENTE
            window.loadData();
            alert('Grupo criado com sucesso!');
        } else {
            alert('Erro ao criar grupo: ' + (data.message || 'Erro desconhecido'));
        }
    } catch (e) {
        console.error(e);
        alert('Erro de conexão ao criar grupo.');
    }
};
window.openGroupSettings = function() { document.getElementById('settings-modal').style.display = 'flex'; window.loadGroupSettings(); };
// --- FUNÇÃO ATUALIZADA: LISTA DE MEMBROS BONITA (V116) ---
window.loadGroupSettings = async function() {
    const l = document.getElementById('settings-members-list');
    l.innerHTML = '<div style="padding:20px;text-align:center;color:#888;">Carregando membros...</div>';
    
    try {
        const r = await fetch(`/group-details/${currentChatId}`);
        const m = await r.json();
        
        // Verifica se EU sou admin ou Super Admin
        const me = m.find(x => x.id == currentUser.id);
        const amIAdmin = (me && me.is_admin) || currentUser.is_super_admin;

        // Botões gerais do grupo
        const bl = document.getElementById('btn-leave');
        const bd = document.getElementById('btn-delete');
        const addArea = document.getElementById('add-member-area');

        if(bl) bl.style.display = amIAdmin ? 'none' : 'inline-block'; // Se sou admin, não "saio", eu deleto ou passo o bastão (simplificado)
        if(bd) bd.style.display = amIAdmin ? 'inline-block' : 'none';
        if(addArea) addArea.style.display = amIAdmin ? 'block' : 'none';

        l.innerHTML = '';
        
        if(m.length === 0) {
            l.innerHTML = '<div style="padding:15px;">Nenhum membro encontrado.</div>';
            return;
        }

        m.forEach(x => {
            const isMe = x.id === currentUser.id;
            const photo = getAvatarUrl(x.photo);
            const adminBadge = x.is_admin ? `<span class="admin-badge">ADM</span>` : '';
            
            let actionsHtml = '';
            
            // Só mostro botões de ação se EU for admin e o alvo não for eu mesmo
            if (amIAdmin && !isMe) {
                // Botão de Promover/Rebaixar (Visualmente muda a cor da coroa)
                const crownColor = x.is_admin ? 'is-admin' : '';
                const crownTitle = x.is_admin ? 'Remover Admin' : 'Tornar Admin';
                
                // Botão Remover
                actionsHtml = `
                    <div class="member-actions">
                        <button class="action-icon-btn promote ${crownColor}" onclick="promoteMember(${x.id})" title="${crownTitle}">👑</button>
                        <button class="action-icon-btn remove" onclick="removeMember(${x.id})" title="Remover do Grupo">🚫</button>
                    </div>
                `;
            }

            l.innerHTML += `
            <div class="member-item">
                <div class="member-info">
                    <img src="${photo}" class="member-avatar">
                    <div>
                        <div class="member-name">${x.username} ${isMe ? '(Você)' : ''}</div>
                        ${adminBadge}
                    </div>
                </div>
                ${actionsHtml}
            </div>`;
        });

        // Preenche o Select de Adicionar novos membros (filtra quem já está)
        if(amIAdmin) {
            const s = document.getElementById('add-member-select');
            s.innerHTML = '<option value="">Selecione para adicionar...</option>';
            // Pega todos os usuários globais e tira quem já está no grupo
            const existingIds = m.map(y => y.id);
            const available = allUsers.filter(u => !existingIds.includes(u.id));
            
            available.sort((a,b) => a.username.localeCompare(b.username));
            
            available.forEach(u => {
                s.innerHTML += `<option value="${u.id}">${u.username} - ${u.department}</option>`;
            });
        }

    } catch(e) {
        console.error(e);
        l.innerHTML = '<div style="color:red;padding:10px;">Erro ao carregar membros.</div>';
    }
};
window.addNewMember = async function() { 
    const u = document.getElementById('add-member-select').value; 
    if(u) { 
        // Incluímos adminId: currentUser.id
        await fetch('/group/add-member', { 
            method:'POST', 
            headers:{'Content-Type':'application/json'}, 
            body:JSON.stringify({groupId:currentChatId, userId:u, adminId: currentUser.id}) 
        }); 
        window.loadGroupSettings(); 
    } 
};

window.removeMember = async function(u) { 
    if(confirm('Remover?')) 
        await fetch('/group/remove-member', { 
            method:'POST', 
            headers:{'Content-Type':'application/json'}, 
            body:JSON.stringify({groupId:currentChatId, userId:u, adminId: currentUser.id}) 
        }); 
    window.loadGroupSettings(); 
};
window.promoteMember = async function(u) { if(confirm('Admin?')) await fetch('/group/promote', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({groupId:currentChatId, userId:u}) }); window.loadGroupSettings(); };
window.leaveGroup = async function() { if(confirm('Sair?')) { await fetch('/group/leave', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({groupId:currentChatId, userId:currentUser.id}) }); document.getElementById('settings-modal').style.display='none'; window.closeChat(); } };
window.deleteGroup = async function() { if(confirm('Excluir?')) { await fetch('/group/delete', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({groupId:currentChatId}) }); document.getElementById('settings-modal').style.display='none'; window.closeChat(); } };
window.scrollToMsg = function(id) { const el = document.getElementById(`msg-${id}`); if(el) { el.scrollIntoView({behavior:'smooth', block:'center'}); el.style.background='#fff9c4'; setTimeout(()=>el.style.background='', 1500); } };

// --- FEATURES: ENCAMINHAR & QUEM VIU (V120) ---
let messageToForwardId = null;
let forwardSelection = []; // array de {id, type}

window.openForwardModal = function(msgId) {
    messageToForwardId = msgId;
    forwardSelection = [];
    const searchInput = document.getElementById('forward-search-input');
    if(searchInput) searchInput.value = '';
    document.getElementById('forward-modal').style.display = 'flex';
    renderForwardList();
};

window.closeForwardModal = function() {
    document.getElementById('forward-modal').style.display = 'none';
    messageToForwardId = null;
};

window.renderForwardList = function() {
    const list = document.getElementById('forward-list');
    list.innerHTML = '';

    // Grupos
    allGroups.forEach(g => {
        list.innerHTML += `
            <div class="forward-item" data-name="${(g.name||'').toLowerCase()}" onclick="toggleForwardTarget('${g.id}', 'group', this)">
                <input type="checkbox" class="forward-checkbox" pointer-events="none" ${(forwardSelection.some(x => x.id == g.id && x.type === 'group')) ? 'checked' : ''}>
                <span class="forward-name">👥 ${g.name}</span>
            </div>`;
    });

    // Separador
    list.innerHTML += '<div class="forward-divider" style="margin:10px 0; border-bottom:1px solid #eee;"></div>';

    // Usuários
    allUsers.forEach(u => {
        if(u.id !== currentUser.id) {
            list.innerHTML += `
            <div class="forward-item" data-name="${(u.username||'').toLowerCase()}" onclick="toggleForwardTarget('${u.id}', 'private', this)">
                <input type="checkbox" class="forward-checkbox" pointer-events="none" ${(forwardSelection.some(x => x.id == u.id && x.type === 'private')) ? 'checked' : ''}>
                <span class="forward-name">👤 ${u.username}</span>
            </div>`;
        }
    });

    const term = document.getElementById('forward-search-input')?.value;
    if(term) window.filterForwardList(term);
};

window.filterForwardList = function(term) {
    const t = (term || '').toLowerCase();
    const items = document.querySelectorAll('.forward-item');
    items.forEach(el => {
        const name = el.getAttribute('data-name');
        if(name && name.includes(t)) el.style.display = 'flex';
        else el.style.display = 'none';
    });
    
    // Esconde o divisor se estiver pesquisando
    const divider = document.querySelector('.forward-divider');
    if(divider) divider.style.display = t ? 'none' : 'block';
};

window.toggleForwardTarget = function(id, type, el) {
    const cb = el.querySelector('input');
    cb.checked = !cb.checked;
    
    if(cb.checked) {
        forwardSelection.push({id, type});
        el.style.background = '#e3f2fd';
    } else {
        forwardSelection = forwardSelection.filter(x => !(x.id == id && x.type == type));
        el.style.background = '';
    }
    
    const btn = document.getElementById('btn-confirm-forward');
    btn.textContent = `Enviar para (${forwardSelection.length})`;
    btn.disabled = forwardSelection.length === 0;
};

window.confirmForward = async function() {
    if(!messageToForwardId || forwardSelection.length === 0) return;

    const btn = document.getElementById('btn-confirm-forward');
    btn.textContent = "Enviando...";
    btn.disabled = true;

    try {
        // Agora usamos o backend para processar em lote (Mil vezes mais robusto)
        // Rota corrigida: no chat.routes.js está como '/forward' e o server.js monta na raiz.
        const res = await fetch('/forward', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUser.id,
                messageId: messageToForwardId,
                targets: forwardSelection
            })
        });

        const data = await res.json();

        if (data.success) {
            alert(`✅ Mensagem encaminhada para ${data.result.successCount} destinatários!`);
            window.closeForwardModal();
        } else {
            alert("❌ Erro ao encaminhar: " + (data.message || "Falha no servidor."));
        }
    } catch (e) {
        console.error(e);
        alert("❌ Erro de conexão ao encaminhar.");
    } finally {
        if(document.getElementById('forward-modal').style.display !== 'none') {
             btn.textContent = "Enviar";
             btn.disabled = false;
        }
    }
};


// --- QUEM VIU ---
window.openReadersModal = async function(msgId) {
    document.getElementById('readers-modal').style.display = 'flex';
    const list = document.getElementById('readers-list');
    list.innerHTML = '<div style="padding:20px; text-align:center">Carregando...</div>';

    try {
        const res = await fetch(`/readers/${msgId}`);
        const data = await res.json();
        
        if(data.success) {
            list.innerHTML = '';
            if(data.readers.length === 0) {
                list.innerHTML = '<div style="padding:15px">Ninguém visualizou ainda.</div>';
                return;
            }

            data.readers.forEach(r => {
                const photo = getAvatarUrl(r.photo);
                const time = new Date(r.last_view).toLocaleString();
                list.innerHTML += `
                    <div class="reader-item">
                        <img src="${photo}" class="reader-avatar">
                        <div class="reader-info">
                            <b>${r.username}</b>
                            <span class="reader-time">Visto após: ${time}</span>
                        </div>
                    </div>
                `;
            });
        } else {
            list.innerHTML = 'Erro ao carregar.';
        }
    } catch(e) {
        console.error(e);
        list.innerHTML = 'Erro de conexão.';
    }
};

window.closeReadersModal = function() {
    document.getElementById('readers-modal').style.display = 'none';
};

// --- REAÇÕES ---
window.openReactionsModal = async function(msgId) {
    document.getElementById('reactions-modal').style.display = 'flex';
    const list = document.getElementById('reactions-list');
    list.innerHTML = '<div style="padding:20px; text-align:center">Carregando...</div>';

    try {
        const res = await fetch(`/message/reactions/${msgId}`);
        const data = await res.json();
        
        if(data.success) {
            list.innerHTML = '';
            if(data.reactions.length === 0) {
                list.innerHTML = '<div style="padding:15px">Nenhuma reação.</div>';
                return;
            }

            data.reactions.forEach(r => {
                const photo = getAvatarUrl(r.photo);
                list.innerHTML += `
                    <div class="reader-item">
                        <img src="${photo}" class="reader-avatar">
                        <div class="reader-info">
                            <b>${r.username}</b>
                            <span class="reader-time">Reagiu com ${r.reaction}</span>
                        </div>
                        <div style="font-size: 1.5rem;">${r.reaction}</div>
                    </div>
                `;
            });
        } else {
            list.innerHTML = 'Erro ao carregar.';
        }
    } catch(e) {
        console.error(e);
        list.innerHTML = 'Erro de conexão.';
    }
};

window.closeReactionsModal = function() {
    document.getElementById('reactions-modal').style.display = 'none';
};

// INIT
document.addEventListener('DOMContentLoaded',()=>{
    console.log("Chat V115 - Fix Order & filterContacts Error");
    socket.emit('i am online',currentUser.id);
    window.loadData();
    window.switchTab('users');
    
    if ("Notification" in window && Notification.permission !== "granted") Notification.requestPermission();
    
    const f=document.getElementById('file-input');if(f)f.onchange=()=>window.uploadFile();
    const i=document.getElementById('input');if(i)i.addEventListener('paste',e=>{const it=(e.clipboardData||e.originalEvent.clipboardData).items;for(let x in it)if(it[x].kind==='file')window.uploadFile(it[x].getAsFile())});
    
    // --- FUNÇÃO ESC PARA FECHAR TUDO (Modais e Chat) ---
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // 1. Tenta fechar modais primeiro
            const modals = document.querySelectorAll('.modal-overlay, .modal-zoom, .forward-modal, .readers-modal');
            let modalClosed = false;
            
            modals.forEach(m => {
                if (m.style.display === 'flex' || m.style.display === 'block') {
                    m.style.display = 'none';
                    modalClosed = true;
                }
            });

            // Fecha especificamente os novos modais se abertos
            if (document.getElementById('reactions-modal').style.display === 'flex') {
                document.getElementById('reactions-modal').style.display = 'none';
                modalClosed = true;
            }

            // 2. Se não fechou nenhum modal, fecha a conversa atual
            if (!modalClosed && currentChatId) {
                window.closeChat();
            }
        }
    });

    if(window.EmojiButton){
        const p=new EmojiButton({position:'top-start',rootElement:document.body,theme:'light',autoHide:false,zIndex:999999});
        const t=document.getElementById('emoji-btn');
        p.on('emoji',s=>{i.value+=(s.emoji||s);i.focus()});
        if(t)t.addEventListener('click',()=>p.togglePicker(t))
    }


});

