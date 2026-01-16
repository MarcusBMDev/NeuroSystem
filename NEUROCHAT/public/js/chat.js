// public/js/chat.js - V115 - Fix filterContacts Order & Ghost Notif
var socket = io();

// 1. SESSÃO
const userSession = localStorage.getItem('neurochat_user');
if (!userSession) window.location.href = '/';
let currentUser = JSON.parse(userSession);

let allUsers=[], allGroups=[], onlineIds=[], currentChatId=null, currentChatType=null, replyingTo=null;
let activeTab='users', chatOffset=0, isUploading=false, pinnedMessagesList=[], pinnedIndex=0;
let originalTitle=document.title, blinkInterval=null, unreadCountGlobal=0, searchResults=[], searchIndex=-1;

const notificationSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

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
            localStorage.setItem('chatUser', JSON.stringify(currentUser)); 
            window.updateMyInfo(); 
            const b = document.querySelector('.new-group-btn');
            if(b) b.style.display = currentUser.is_super_admin ? 'block' : 'none';
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
    await window.loadChatHistory(false);
    window.loadPinnedMessages(id, type);
    window.scrollToBottom();
    setTimeout(window.scrollToBottom, 100);
    setTimeout(window.scrollToBottom, 300);
};

window.loadChatHistory = async (isLoadMore=false) => {
    if(!currentChatId) return;
    if(isLoadMore) chatOffset+=30; else chatOffset=0;
    try {
        const res = await fetch(`/history/${currentUser.id}/${currentChatId}/${currentChatType}?offset=${chatOffset}`);
        const msgs = await res.json();
        const container = document.getElementById('messages');
        if(!container) return;

        const oldBtn = document.getElementById('btn-load-more');
        if(oldBtn) oldBtn.remove();
        if(msgs.length===0 && isLoadMore) return;
        
        const oldScroll = container.scrollHeight;
        const render = (m, top) => window.addMessageToScreen({ ...m, userId: m.user_id, msgType: m.msg_type, fileName: m.file_name, raw_time: m.timestamp, reactions: m.reactions||[], is_read: m.is_read }, top);
        
        if(!isLoadMore) msgs.forEach(m => render(m, false)); else for(let i=msgs.length-1; i>=0; i--) render(msgs[i], true);

        if(msgs.length>=30) {
            const btn = document.createElement('button');
            btn.id='btn-load-more'; btn.className='load-more-btn'; btn.textContent='🔄 Mais';
            btn.onclick = () => window.loadChatHistory(true);
            container.insertBefore(btn, container.firstChild);
        }
        
        if(!isLoadMore) {
            window.scrollToBottom();
            setTimeout(window.scrollToBottom, 200); 
        } else {
            container.scrollTop = container.scrollHeight - oldScroll;
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
            content = `<div class="image-wrapper"><img src="${url}" class="chat-image-preview" onclick="event.stopPropagation(); window.openImageZoom('${url}')" onload="window.scrollToBottom()"><a href="${url}" download="${data.fileName}" class="download-btn-overlay">⬇️ Baixar</a></div>`;
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
            reactionsHtml += `<span class="reaction-bubble" title="${people}">${txt}</span>`; 
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
socket.on('error message', (msg) => { try { notificationSound.play().catch(e => {}) } catch(e){} alert(msg); if(currentChatId) window.loadChatHistory(false); });

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
            // Notifica
            try { notificationSound.play().catch(()=>{}) } catch(e){}
            
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
        // Se a mensagem fixada pertence ao chat que estou vendo agora
        if (data.targetId == currentChatId && data.targetType == currentChatType) {
            const el = document.getElementById(`msg-${data.messageId}`);
            if (el) {
                if (data.action === 'pin') el.classList.add('pinned-message');
                else el.classList.remove('pinned-message');
            }
        }
    });
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
        
        // Toca um som ou notificação leve se quiser
        try { notificationSound.play().catch(()=>{}) } catch(e){}
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
window.notifyUser=(d)=>{try{notificationSound.play().catch(()=>{})}catch(e){}if(document.hidden){unreadCountGlobal++;if(!blinkInterval)blinkInterval=setInterval(()=>{document.title=document.title===originalTitle?`(${unreadCountGlobal}) Nova Msg!`:originalTitle},1000);if("Notification"in window&&Notification.permission==="granted"){new Notification("NeuroChat",{body:d.targetType==='group'?'Grupo':d.user,icon:'/avatar.png',silent:true}).onclick=function(){window.focus();this.close()}}}};
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
window.cancelReply=()=>{replyingTo=null;document.getElementById('reply-area').style.display='none'};window.closeChat=()=>{document.body.classList.remove('mobile-active');document.getElementById('welcome-screen').style.display='flex';document.getElementById('chat-interface').style.display='none';currentChatId=null};window.logout=()=>{localStorage.removeItem('chatUser');location.href='/'};window.stopBlinking=()=>{clearInterval(blinkInterval);blinkInterval=null;unreadCountGlobal=0;document.title=originalTitle};document.addEventListener('visibilitychange',()=>{if(!document.hidden)window.stopBlinking()});
window.loadPinnedMessages=async function(tid,type){if(tid!=currentChatId)return;try{const r=await fetch('/chat/get-pinned',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({myId:currentUser.id,targetId:tid,type})});const d=await r.json();pinnedMessagesList=d.pinnedMessages||[];if(pinnedIndex>=pinnedMessagesList.length)pinnedIndex=0;window.updatePinUI()}catch(e){}};
window.updatePinUI=function(){const b=document.getElementById('pinned-bar');b.style.display='none';b.innerHTML='';if(pinnedMessagesList.length>0){b.style.display='flex';const m=pinnedMessagesList[pinnedIndex];const t=(m.msgType==='file')?'📎':m.text;const n=pinnedMessagesList.length>1?`<span onclick="prevPin()" style="cursor:pointer;margin-right:10px;">❮</span> ${pinnedIndex+1}/${pinnedMessagesList.length} <span onclick="nextPin()" style="cursor:pointer;margin-left:10px;">❯</span>`:'';b.innerHTML=`<div style="flex:1;cursor:pointer;" onclick="scrollToMsg(${m.id})">${n} <b>${m.username}:</b> ${t}</div><button onclick="event.stopPropagation(); unpinMessage(${m.id})">✕</button>`}};window.nextPin=()=>{pinnedIndex=(pinnedIndex+1)%pinnedMessagesList.length;window.updatePinUI()};window.prevPin=()=>{pinnedIndex=(pinnedIndex-1+pinnedMessagesList.length)%pinnedMessagesList.length;window.updatePinUI()};
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
window.openProfileModal = function() { document.getElementById('profile-username').value = currentUser.username; const s = document.getElementById('profile-department'); if(s) s.value = currentUser.department || ""; document.getElementById('profile-password').value = ''; document.getElementById('profile-photo-input').value = ''; document.getElementById('profile-modal').style.display = 'flex'; };
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
            localStorage.setItem('chatUser', JSON.stringify(currentUser));
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
window.createGroup = async function() { const n = document.getElementById('new-group-name').value; const ib = document.getElementById('is-broadcast').checked; const m = Array.from(document.querySelectorAll('.user-sel:checked')).map(x => x.value); if(!n || m.length === 0) return alert('Preencha tudo.'); await fetch('/create-group', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name:n, creatorId:currentUser.id, members:m, isBroadcast:ib }) }); document.getElementById('group-modal').style.display = 'none'; };
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

// INIT
document.addEventListener('DOMContentLoaded',()=>{
    console.log("Chat V115 - Fix Order & filterContacts Error");
    socket.emit('i am online',currentUser.id);
    window.loadData();
    window.switchTab('users');
    
    if ("Notification" in window && Notification.permission !== "granted") Notification.requestPermission();
    
    const f=document.getElementById('file-input');if(f)f.onchange=()=>window.uploadFile();
    const i=document.getElementById('input');if(i)i.addEventListener('paste',e=>{const it=(e.clipboardData||e.originalEvent.clipboardData).items;for(let x in it)if(it[x].kind==='file')window.uploadFile(it[x].getAsFile())});
    if(window.EmojiButton){
        const p=new EmojiButton({position:'top-start',rootElement:document.body,theme:'light',autoHide:false,zIndex:999999});
        const t=document.getElementById('emoji-btn');
        p.on('emoji',s=>{i.value+=(s.emoji||s);i.focus()});
        if(t)t.addEventListener('click',()=>p.togglePicker(t))
    }

    // Função para sair do sistema (chamada pelo botão no HTML)
function logout() {
    // 1. Pergunta de segurança (Opcional, mas boa prática)
    if (confirm("Tens a certeza que queres sair?")) {
        
        // 2. Limpar os dados guardados no navegador
        // Remove o nome do utilizador ou token de sessão
        localStorage.removeItem('usuarioNome'); 
        localStorage.removeItem('usuarioSala');
        
        // Se usares sessionStorage também:
        sessionStorage.clear();

        // 3. Redirecionar para a página de login
        // Ajusta o caminho conforme as tuas pastas. 
        // Se o login for a raiz, usa apenas '/'
        window.location.href = '/index.html'; 
    }
}
});