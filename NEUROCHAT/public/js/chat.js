// public/js/chat.js - V53 - Full Restoration + Fixes
var socket = io();

// 1. SESSÃO
const userSession = localStorage.getItem('chatUser');
if (!userSession) window.location.href = '/';
let currentUser = JSON.parse(userSession);

// Configs
function getAvatarUrl(photoName) { return (photoName && photoName !== 'NULL') ? `/uploads/${photoName}` : '/avatar.png'; }
const notificationSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

// Estado
let allUsers = [], allGroups = [], onlineIds = [];
let currentChatId = null, currentChatType = null;
let pinnedMessagesList = [], pinnedIndex = 0, replyingTo = null;
let originalTitle = document.title, blinkInterval = null, unreadCountGlobal = 0;
let isUploading = false;

// Variáveis de Pesquisa e Paginação
let chatOffset = 0; 
let searchResults = [];
let searchIndex = -1;

// 2. FUNÇÕES GLOBAIS

window.loadData = async function() {
    try {
        const res = await fetch(`/data-sync/${currentUser.id}`);
        const data = await res.json();
        if(data.error) { alert("Sessão inválida."); window.logout(); return; }
        if(data.me) { 
            currentUser = {...currentUser, ...data.me}; 
            localStorage.setItem('chatUser', JSON.stringify(currentUser)); 
            window.updateMyInfo(); 
        }
        allUsers = (data.users || []).map(u => ({
            ...u, 
            last_activity: u.last_interaction // A data real do banco!
        })); 
        allGroups = data.groups || [];
        window.renderLists();
        allGroups.forEach(g => socket.emit('join group room', g.id));
    } catch(e) { console.error("Erro loadData", e); }
};

window.renderLists = function() {
    // --- 1. ORDENAÇÃO DE USUÁRIOS (CRONOLÓGICA) ---
    allUsers.sort((a, b) => {
        // 1. Mensagens NÃO LIDAS continuam no topo absoluto para chamar atenção
        if (b.unread > 0 && a.unread === 0) return 1;
        if (a.unread > 0 && b.unread === 0) return -1;

        // 2. Data da Última Mensagem (O que você pediu)
        const dateA = a.last_activity ? new Date(a.last_activity).getTime() : 0;
        const dateB = b.last_activity ? new Date(b.last_activity).getTime() : 0;

        // Se um deles tiver data (já conversaram), o mais recente ganha
        if (dateB !== dateA) {
            return dateB - dateA; 
        }

        // 3. Só usa ordem alfabética se NUNCA conversaram (ambos com data 0)
        // Isso mantém o fim da lista organizado, mas não atrapalha as conversas.
        return a.username.localeCompare(b.username);
    });

    const ulUsers = document.getElementById('users-list');
    if(ulUsers) {
        ulUsers.innerHTML = '';
        allUsers.forEach(u => {
            if(u.id == currentUser.id) return; 
            
            const isOnline = onlineIds.includes(u.id);
            const badge = u.unread > 0 ? 'block' : 'none';
            
            // Botões de Admin
            let adminActions = ''; 
            if (currentUser.is_super_admin) { 
                const icon = u.is_super_admin ? '👑' : '☆'; 
                const style = u.is_super_admin ? 'color:gold;' : 'color:#ccc;';
                const btnSuper = `<button onclick="event.stopPropagation(); toggleSuper(${u.id})" style="background:none;border:none;cursor:pointer;font-size:1.2rem;${style}" title="Admin">${icon}</button>`;
                const btnDelete = `<button onclick="event.stopPropagation(); deleteUserBtn(${u.id}, '${u.username}')" style="background:none;border:none;cursor:pointer;font-size:1.2rem;color:red;margin-left:5px;" title="Excluir">🗑️</button>`;
                adminActions = `<div style="display:flex;">${btnSuper}${btnDelete}</div>`; 
            }

            const li = document.createElement('li');
            if(u.unread > 0) li.style.backgroundColor = '#e8f5e9';

            li.innerHTML = `
                <div class="contact-left">
                    <div class="avatar-wrapper">
                        <img src="${getAvatarUrl(u.photo)}" class="list-avatar" onclick="event.stopPropagation(); window.openImageZoom(this.src)">
                        <div class="${isOnline?'status-dot online':'status-dot'}"></div>
                    </div>
                    <div class="contact-info">
                        <span class="contact-name" style="${u.unread > 0 ? 'font-weight:bold;color:#2e7d32;' : ''}">${u.username}</span>
                        <span class="contact-dept">${u.department||''}</span>
                    </div>
                </div>
                ${adminActions} 
                <div class="unread-badge" style="display:${badge}">${u.unread}</div>
            `;
            li.onclick = () => window.openChat('private', u.id, u.username, li);
            ulUsers.appendChild(li);
        });
    }

    // --- 2. ORDENAÇÃO DE GRUPOS (IGUAL) ---
    const ulGroups = document.getElementById('groups-list');
    if(ulGroups) {
        allGroups.sort((a, b) => {
            if (b.unread > 0 && a.unread === 0) return 1;
            if (a.unread > 0 && b.unread === 0) return -1;
            
            // Ordena grupos por atividade também
            const dA = a.last_activity ? new Date(a.last_activity).getTime() : 0;
            const dB = b.last_activity ? new Date(b.last_activity).getTime() : 0;
            if (dB !== dA) return dB - dA;

            return a.name.localeCompare(b.name);
        });

        ulGroups.innerHTML = '';
        allGroups.forEach(g => {
            const badge = g.unread > 0 ? 'block' : 'none';
            const icon = g.is_broadcast ? '📢' : '#';
            const li = document.createElement('li');
            if(g.unread > 0) li.style.backgroundColor = '#e8f5e9';

            li.innerHTML = `<div style="display:flex;align-items:center;"><b style="font-size:1.2rem;margin-right:10px;color:#555;">${icon}</b><span style="${g.unread > 0 ? 'font-weight:bold;color:#2e7d32;' : ''}">${g.name}</span></div><div class="unread-badge" style="display:${badge}">${g.unread}</div>`;
            li.onclick = () => window.openChat('group', g.id, g.name, li);
            ulGroups.appendChild(li);
        });
    }
};

window.updateMyInfo = function() {
    document.getElementById('user-name').textContent = currentUser.username;
    document.getElementById('user-dept').textContent = currentUser.department;
    document.getElementById('my-avatar-img').src = getAvatarUrl(currentUser.photo);
    const b1 = document.getElementById('btn-audit'), b2 = document.getElementById('btn-new-group');
    if(b1) b1.style.display = currentUser.is_super_admin ? 'block' : 'none';
    if(b2) b2.style.display = currentUser.is_super_admin ? 'inline-block' : 'none';
};

// --- PAGINAÇÃO ---
window.loadChatHistory = async function(isLoadMore = false) {
    if (!currentChatId) return;
    
    if (!isLoadMore) {
        chatOffset = 0;
        document.getElementById('messages').innerHTML = '';
    } else {
        chatOffset += 30;
    }

    try {
        const res = await fetch(`/history/${currentUser.id}/${currentChatId}/${currentChatType}?offset=${chatOffset}`);
        const newMessages = await res.json();
        
        const container = document.getElementById('messages');
        const oldBtn = document.getElementById('btn-load-more');
        if(oldBtn) oldBtn.remove();

        if (newMessages.length === 0 && isLoadMore) {
            return;
        }

        const oldHeight = container.scrollHeight;
        
        newMessages.forEach(m => {
            if (isLoadMore) {
                // Tratado abaixo
            } else {
                window.addMessageToScreen({ ...m, userId: m.user_id, msgType: m.msg_type, fileName: m.file_name, raw_time: m.timestamp }, false);
            }
        });
        
        if (isLoadMore) {
            for (let i = newMessages.length - 1; i >= 0; i--) {
                const m = newMessages[i];
                window.addMessageToScreen({ ...m, userId: m.user_id, msgType: m.msg_type, fileName: m.file_name, raw_time: m.timestamp }, true);
            }
        }

        if (newMessages.length >= 30) {
            const btn = document.createElement('button');
            btn.id = 'btn-load-more';
            btn.className = 'load-more-btn';
            btn.textContent = '🔄 Carregar mensagens anteriores';
            btn.onclick = () => window.loadChatHistory(true);
            container.insertBefore(btn, container.firstChild);
        }

        if (!isLoadMore) {
            container.scrollTop = container.scrollHeight;
        } else {
            container.scrollTop = container.scrollHeight - oldHeight;
            // Atualiza busca se existir
            const searchInput = document.getElementById('chat-search-input');
            if(searchInput && searchInput.value.trim() !== '') {
                window.searchInChat(searchInput.value);
            }
        }

    } catch(e) { console.error("Erro histórico", e); }
};

window.openChat = async function(type, id, name, el) {
    document.body.classList.add('mobile-active');
    document.getElementById('welcome-screen').style.display = 'none';
    document.getElementById('chat-interface').style.display = 'flex';
    document.getElementById('chat-title').textContent = name;
    
    const searchInput = document.getElementById('chat-search-input');
    if(searchInput) searchInput.value = '';
    window.searchInChat('');

    currentChatType = type; currentChatId = id; pinnedMessagesList = [];
    document.getElementById('messages').innerHTML = ''; 
    document.getElementById('pinned-bar').style.display = 'none';
    window.cancelReply();
    
    document.querySelectorAll('li').forEach(x => x.classList.remove('active'));
    if(el) el.classList.add('active');
    
    const imgH = document.getElementById('chat-header-img'); 
    const btnG = document.getElementById('group-settings-btn'); 
    const form = document.getElementById('form'); 
    const note = document.getElementById('broadcast-notice');
    const deptSpan = document.getElementById('chat-dept');

    if(type === 'group') {
        imgH.style.display = 'none'; btnG.style.display = 'block';
        if(deptSpan) deptSpan.textContent = "Grupo";
        const g = allGroups.find(x => x.id == id);
        if(g) { g.unread = 0; window.renderLists(); }
        if(g && g.is_broadcast && !g.is_admin && !currentUser.is_super_admin) { form.style.display = 'none'; note.style.display = 'block'; } else { form.style.display = 'flex'; note.style.display = 'none'; }
    } else {
        imgH.style.display = 'block'; btnG.style.display = 'none'; form.style.display = 'flex'; note.style.display = 'none';
        const u = allUsers.find(x => x.id == id); 
        if(u) { imgH.src = getAvatarUrl(u.photo); if(deptSpan) deptSpan.textContent = u.department || ''; }
        window.markAsRead(id); const myU = allUsers.find(x=>x.id==id); if(myU) { myU.unread=0; window.renderLists(); }
    }
    
    await window.loadChatHistory(false);
    window.loadPinnedMessages(id, type);
};

window.addMessageToScreen = function(data, prepend = false) {
    if (document.getElementById(`msg-${data.id}`)) return;
    
    // --- FIX 1: DEFINIÇÃO SEGURA DO NOME (Para o botão Responder funcionar sempre) ---
    const displayName = data.user || data.username || 'Desconhecido';
    
    const div = document.createElement('div');
    const isMine = data.userId == currentUser.id;
    div.className = isMine ? 'msg-container mine' : 'msg-container other';
    div.id = `msg-${data.id}`;
    
    // --- FIX 2: DATA PARA O SEPARADOR (Estilo WhatsApp) ---
    if(data.raw_time) div.setAttribute('data-date', data.raw_time);
    // -----------------------------------------------------

    // Mantém o menu de opções no mobile (clique na mensagem)
    div.onclick = function(e) {
        if (e.target.closest('.msg-btn') || e.target.tagName === 'IMG') return; 
        document.querySelectorAll('.msg-container.show-menu').forEach(el => {
            if (el !== div) el.classList.remove('show-menu');
        });
        this.classList.toggle('show-menu');
    };
    
    const avatar = isMine ? '' : `<img src="${getAvatarUrl(data.photo)}" class="chat-msg-avatar" onclick="window.openImageZoom(this.src)">`;
    let content = '';
    
    // Renderiza a mensagem citada (se houver)
    if (data.reply_text && !data.is_deleted) { 
        const replyContent = (data.reply_type === 'file' || data.reply_type === 'file') ? '📎 Anexo' : formatMessage(data.reply_text);
        content += `
            <div class="quoted-msg" onclick="event.stopPropagation(); scrollToMsg(${data.reply_to_id})">
                <div class="quoted-user">${data.reply_user || 'Usuário'}</div>
                <div class="quoted-text">${replyContent}</div>
            </div>`; 
    }
    
    const finalFileName = data.fileName || data.file_name;
    
    // Lógica de Arquivos vs Texto
    if (data.is_deleted) {
        content += `<div class="deleted-content">🚫 Mensagem apagada</div>`;
    } else if (data.msgType === 'file' || data.msg_type === 'file') {
        const ext = (finalFileName||'').split('.').pop().toLowerCase();
        const path = `/uploads/${finalFileName}`;
        
        // Renderiza a Imagem/Vídeo/Arquivo
        if(['jpg','jpeg','png','gif'].includes(ext)) { 
            content += `<a href="javascript:void(0)" onclick="event.stopPropagation(); window.openImageZoom('${path}')"><img src="${path}" class="chat-image" style="max-width:250px;border-radius:10px;cursor:pointer;"></a>`; 
        }
        else if (['mp4','webm'].includes(ext)) { 
            content += `<video src="${path}" controls class="chat-video" style="max-width:300px;border-radius:10px;" onclick="event.stopPropagation()"></video>`; 
        }
        else { 
            content += `<a href="${path}" target="_blank" class="chat-file-link" style="display:block;padding:10px;background:#f0f0f0;border-radius:5px;text-decoration:none;color:#333;" onclick="event.stopPropagation()">📄 Baixar: ${finalFileName}</a>`; 
        }

        // Legenda do arquivo
        if (data.text && data.text !== finalFileName && data.text !== data.originalName) {
            content += `<div class="file-caption">${formatMessage(data.text)}</div>`;
        }

    } else { 
        // Texto normal
        content += `<span id="msg-text-${data.id}">${formatMessage(data.text)}</span>`; 
    }
    
    // Rodapé (Hora e Ticks)
    let infoHtml = `<small>${data.time}</small>`;
    if (data.is_edited) infoHtml += `<span class="edited-tag" id="edit-tag-${data.id}">(editado)</span>`;
    if (isMine) {
        const tickClass = data.is_read ? 'read-ticks read' : 'read-ticks';
        infoHtml += `<span class="${tickClass}" id="tick-${data.id}">✔✔</span>`;
    }

    const header = `<div class="msg-header"><span>${displayName}</span> <div class="msg-info-right">${infoHtml}</div></div>`;
    
    // Botões de Ação (Responder, Fixar, Apagar)
    let actions = '';
    if (!data.is_deleted) {
        // --- FIX 3: Sanitização do texto para o botão de responder não quebrar ---
        let rawText = (data.msgType === 'file' || data.msg_type === 'file') ? '📎 Arquivo' : (data.text || '');
        const safeTxt = rawText.replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, ' '); 
        // ------------------------------------------------------------------------
        
        let canPin = (currentChatType === 'private') || currentUser.is_super_admin;
        if(currentChatType === 'group') { const g = allGroups.find(x=>x.id==currentChatId); if(g && (g.is_admin || currentUser.is_super_admin)) canPin = true; }
        
        // Regra de tempo para apagar (10 minutos) ou Admin total
        let canDel = currentUser.is_super_admin || (isMine && (new Date() - new Date(data.raw_time))/60000 < 10);
        
        actions = `<div class="msg-actions">
            <button class="msg-btn reply" onclick="event.stopPropagation(); replyMessage(${data.id}, '${displayName}', '${safeTxt}')" title="Responder">↩️</button>
            ${canPin ? `<button class="msg-btn pin" onclick="event.stopPropagation(); pinMessage(${data.id})" title="Fixar">📌</button>` : ''}
            ${(canDel && isMine && (!data.msgType || data.msgType === 'text')) ? `<button class="msg-btn edit" onclick="event.stopPropagation(); editMessage(${data.id}, '${safeTxt}')" title="Editar">✏️</button>` : ''}
            ${canDel ? `<button class="msg-btn delete" onclick="event.stopPropagation(); deleteMessage(${data.id})" title="Apagar">🗑️</button>` : ''}
        </div>`;
    }
    
    div.innerHTML = isMine 
        ? `${actions}<div class="message-bubble" id="msg-bubble-${data.id}">${header}${content}</div>` 
        : `${avatar}<div class="message-bubble" id="msg-bubble-${data.id}">${header}${content}</div>${actions}`;
        
    const container = document.getElementById('messages'); 
    
    if (prepend) {
        const loadBtn = document.getElementById('btn-load-more');
        if (loadBtn && loadBtn.nextSibling) {
            container.insertBefore(div, loadBtn.nextSibling);
        } else {
            container.insertBefore(div, container.firstChild);
        }
    } else {
        container.appendChild(div); 
        const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
        if (isMine || isAtBottom) {
            container.scrollTop = container.scrollHeight;
        }
    }

    // --- FIX 4: Atualiza os separadores de data ao final ---
    setTimeout(() => window.updateDateSeparators(), 10);
};

window.searchInChat = function(term) {
    document.querySelectorAll('.msg-container').forEach(el => {
        el.querySelector('.message-bubble').style.background = ''; 
    });
    
    if (!term || term.trim() === '') {
        searchResults = [];
        searchIndex = -1;
        const countDisplay = document.getElementById('search-count-display');
        if(countDisplay) countDisplay.textContent = '';
        return;
    }

    searchResults = [];
    const t = term.toLowerCase();
    const msgs = document.querySelectorAll('.msg-container');
    
    msgs.forEach(msg => {
        const bubble = msg.querySelector('.message-bubble');
        if (bubble && bubble.textContent.toLowerCase().includes(t)) {
            searchResults.push(msg);
        }
    });

    if (searchResults.length > 0) {
        searchIndex = searchResults.length - 1; 
        updateSearchUI();
        scrollToSearchResult();
    } else {
        searchIndex = -1;
        const countDisplay = document.getElementById('search-count-display');
        if(countDisplay) countDisplay.textContent = '0/0';
    }
};

window.nextSearch = function() {
    if (searchResults.length === 0) return;
    searchIndex++;
    if (searchIndex >= searchResults.length) searchIndex = 0;
    updateSearchUI();
    scrollToSearchResult();
};

window.prevSearch = function() {
    if (searchResults.length === 0) return;
    searchIndex--;
    if (searchIndex < 0) searchIndex = searchResults.length - 1;
    updateSearchUI();
    scrollToSearchResult();
};

function updateSearchUI() {
    const total = searchResults.length;
    const current = searchIndex + 1;
    const countDisplay = document.getElementById('search-count-display');
    if(countDisplay) countDisplay.textContent = `${current}/${total}`;
}

function scrollToSearchResult() {
    const el = searchResults[searchIndex];
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const bubble = el.querySelector('.message-bubble');
        document.querySelectorAll('.message-bubble').forEach(b => b.style.background = '');
        bubble.style.background = '#fff59d'; 
    }
}

window.openUpdatesModal = function() {
    const modal = document.getElementById('updates-modal');
    if(modal) modal.style.display = 'flex';
};

// --- FORMATADOR DE TEXTO ---
function formatMessage(text) {
    if (!text) return '';
    let safe = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    safe = safe.replace(/\*(.*?)\*/g, '<b>$1</b>');
    safe = safe.replace(/\n/g, '<br>');
    return safe;
}

window.autoResize = function(el) {
    el.style.height = '45px';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
};

window.checkEnter = function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        window.sendMessage();
    }
    window.autoResize(e.target);
};

window.filterContacts = function(searchTerm) {
    const term = searchTerm.toLowerCase();
    const items = document.querySelectorAll('#users-list li');
    items.forEach(item => {
        const name = item.querySelector('.contact-info span').textContent.toLowerCase();
        if (name.includes(term)) item.style.display = 'flex';
        else item.style.display = 'none';
    });
};

window.openImageZoom = function(src) {
    const modal = document.getElementById('image-zoom-modal');
    const target = document.getElementById('img-zoom-target');
    if (modal && target) {
        target.src = src;
        modal.style.display = 'flex';
    }
};
window.closeImageZoom = function() { 
    const modal = document.getElementById('image-zoom-modal');
    if(modal) modal.style.display = 'none'; 
};

window.closeChat = function() {
    document.body.classList.remove('mobile-active');
    document.getElementById('chat-interface').style.display = 'none';
    document.getElementById('welcome-screen').style.display = 'flex';
    currentChatId = null; currentChatType = null;
    document.querySelectorAll('li').forEach(x => x.classList.remove('active'));
    try { notificationSound.pause(); notificationSound.currentTime = 0; } catch(e){}
};

window.sendMessage = function() {
    const input = document.getElementById('input');
    const text = input.value;
    if (text && currentChatId) {
        socket.emit('chat message', { userId: currentUser.id, msg: text, targetId: currentChatId, targetType: currentChatType, replyToId: replyingTo ? replyingTo.id : null });
        
        // --- ATUALIZA A LISTA IMEDIATAMENTE AO ENVIAR ---
        if (currentChatType === 'private') {
            const u = allUsers.find(x => x.id == currentChatId);
            if(u) {
                u.last_activity = new Date(); // Atualiza data
                window.renderLists(); // Reordena lista
            }
        }
        // ------------------------------------------------

        input.value = ''; 
        input.style.height = '45px'; 
        window.cancelReply(); 
        input.focus();
    }
};

/* Substitua a função window.uploadFile inteira por esta: */
/* Substitua toda a função window.uploadFile por esta: */
window.uploadFile = async function(fileFromPaste = null) {
    if(isUploading) return;
    
    // 1. Captura o arquivo (do colar ou do botão)
    let file;
    if (fileFromPaste && fileFromPaste instanceof File) {
        file = fileFromPaste;
    } else {
        const input = document.getElementById('file-input');
        if(!input || !input.files.length) return;
        file = input.files[0];
    }
    if(!file || !currentChatId) return;

    // 2. CAPTURA A LEGENDA (O que está digitado no input de texto)
    const textInput = document.getElementById('input');
    const caption = textInput.value.trim(); // Pega o texto e remove espaços extras

    isUploading = true; 
    document.body.style.cursor = 'wait'; 
    
    try {
        const fd = new FormData(); 
        fd.append('file', file);
        
        const res = await fetch('/upload', { method:'POST', body:fd });
        const data = await res.json();
        
        if(data.success) {
            // 3. ENVIA COM LEGENDA
            // Se tiver legenda (caption), usa ela. Se não, usa o nome do arquivo original.
            const msgContent = caption.length > 0 ? caption : data.originalName;

            socket.emit('chat message', { 
                userId: currentUser.id, 
                msg: msgContent, // Aqui vai a legenda!
                targetId: currentChatId, 
                targetType: currentChatType, 
                msgType: 'file', 
                fileName: data.filename 
            });
            
            // 4. LIMPA O CAMPO DE TEXTO APÓS ENVIAR
            textInput.value = '';
            textInput.style.height = '45px'; // Reseta altura se tiver crescido
        }
    } catch(e) { 
        console.error(e); 
        alert("Erro ao enviar arquivo."); 
    } finally { 
        document.body.style.cursor = 'default'; 
        const fileInput = document.getElementById('file-input');
        if(fileInput) { fileInput.value = ''; fileInput.disabled = false; }
        isUploading = false; 
    }
};

// UTILITÁRIOS
window.markAsRead = async function(sid) { await fetch('/mark-read', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({myId:currentUser.id, senderId:sid}) }); };
window.pinMessage = async function(mid) { await fetch('/message/pin', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({messageId:mid, targetId:currentChatId, targetType:currentChatType, userId:currentUser.id, action:'pin'}) }); };
window.unpinMessage = async function(mid) { await fetch('/message/pin', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({messageId:mid, targetId:currentChatId, targetType:currentChatType, userId:currentUser.id, action:'unpin'}) }); };
window.deleteMessage = async function(mid) { if(confirm('Excluir?')) await fetch('/message/delete', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({messageId:mid}) }); };
window.editMessage = function(id, txt) { const n=prompt('Editar:',txt); if(n&&n!==txt) fetch('/message/edit', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({messageId:id, userId:currentUser.id, newText:n}) }); };
window.replyMessage = function(id, user, text) { replyingTo = {id, user, text}; document.getElementById('reply-area').style.display = 'flex'; document.getElementById('reply-user').textContent = user; document.getElementById('reply-text').textContent = text; document.getElementById('input').focus(); };
window.cancelReply = function() { replyingTo = null; document.getElementById('reply-area').style.display='none'; };
window.scrollToMsg = function(id) { const el = document.getElementById(`msg-${id}`); if(el) { el.scrollIntoView({behavior:'smooth', block:'center'}); el.style.background='#fff9c4'; setTimeout(()=>el.style.background='', 1500); } };
window.logout = function() { localStorage.removeItem('chatUser'); window.location.href='/'; };
window.stopBlinking = function() { clearInterval(blinkInterval); blinkInterval=null; unreadCountGlobal=0; document.title=originalTitle; };
// Substitua a função window.notifyUser por esta:
window.notifyUser = function(data, title) {
    // 1. Tenta tocar o som (para quem tem)
    try { notificationSound.play(); } catch(e){}

    // 2. Se a aba estiver escondida/minimizada
    if(document.hidden) {
        unreadCountGlobal++;
        window.startBlinking();

        // --- NOVO: NOTIFICAÇÃO VISUAL DO WINDOWS ---
        if ("Notification" in window && Notification.permission === "granted") {
            const notificationTitle = title || "NeuroChat";
            const notificationBody = data.targetType === 'group' 
                ? `Nova mensagem no grupo ${title}` 
                : `Mensagem de ${data.user || data.username}`;

            const notif = new Notification(notificationTitle, {
                body: notificationBody,
                icon: '/avatar.png', // Ou o ícone da sua empresa
                tag: 'neurochat-msg', // Evita spam de muitas janelas, substitui a anterior
                silent: true // Já tocamos o som via JS
            });

            // Ao clicar na notificação, foca na janela do chat
            notif.onclick = function() {
                window.focus();
                this.close();
            };
        }
        // ------------------------------------------
    }
};
window.startBlinking = function() { if(!blinkInterval) blinkInterval=setInterval(()=>{ document.title = document.title===originalTitle ? `(${unreadCountGlobal}) Nova Mensagem!` : originalTitle; }, 1000); };
window.loadPinnedMessages = async function(tid, type) { if(tid != currentChatId) return; const r = await fetch('/chat/get-pinned', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({myId:currentUser.id, targetId:tid, type}) }); const d = await r.json(); pinnedMessagesList = d.pinnedMessages || []; if(pinnedIndex >= pinnedMessagesList.length) pinnedIndex = 0; window.updatePinUI(); };
window.updatePinUI = function() { const bar = document.getElementById('pinned-bar'); bar.style.display = 'none'; bar.innerHTML = ''; if(pinnedMessagesList.length > 0) { bar.style.display = 'flex'; const msg = pinnedMessagesList[pinnedIndex]; const txt = (msg.msgType === 'file' || msg.msg_type === 'file') ? '📎 Arquivo' : msg.text; const nav = pinnedMessagesList.length > 1 ? `<span onclick="prevPin()" style="cursor:pointer;margin-right:10px;">❮</span> ${pinnedIndex+1}/${pinnedMessagesList.length} <span onclick="nextPin()" style="cursor:pointer;margin-left:10px;">❯</span>` : ''; bar.innerHTML = `<div id="pinned-content" style="flex:1;display:flex;align-items:center;gap:10px;cursor:pointer;" onclick="scrollToMsg(${msg.id})">${nav} <span><b>${msg.username}:</b> ${txt}</span></div><button onclick="event.stopPropagation(); unpinMessage(${msg.id})" style="background:none;border:none;color:#555;font-weight:bold;cursor:pointer;font-size:1.2rem;padding:0 10px;">✕</button>`; } };
window.nextPin = function() { pinnedIndex = (pinnedIndex+1)%pinnedMessagesList.length; window.updatePinUI(); };
window.prevPin = function() { pinnedIndex = (pinnedIndex-1+pinnedMessagesList.length)%pinnedMessagesList.length; window.updatePinUI(); };
window.openAuditModal = function() { const a=document.getElementById('audit-user-a'), b=document.getElementById('audit-user-b'); let o='<option value="">Selecione...</option>'; allUsers.forEach(u=>o+=`<option value="${u.id}">${u.username}</option>`); a.innerHTML=o; b.innerHTML=o; document.getElementById('audit-modal').style.display='flex'; };
window.loadAuditHistory = async function() { const ua=document.getElementById('audit-user-a').value, ub=document.getElementById('audit-user-b').value; const d=document.getElementById('audit-results'); if(!ua||!ub) return alert('Selecione dois usuários'); d.innerHTML='Carregando...'; const r=await fetch('/audit/get-history',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({adminId:currentUser.id, userA:ua, userB:ub}) }); const j=await r.json(); let h=''; j.rows.forEach(m=>{h+=`<div style="background:#fff;padding:5px;margin:5px;border-radius:5px;"><b>${m.username}</b> (${m.time}): ${m.text}</div>`}); d.innerHTML=h||'Nenhuma conversa encontrada.'; };
// FUNÇÕES DE PERFIL RESTAURADAS
window.openProfileModal = function() { 
    document.getElementById('profile-username').value = currentUser.username; 
    const deptSelect = document.getElementById('profile-department'); 
    if(deptSelect) deptSelect.value = currentUser.department || ""; 
    document.getElementById('profile-password').value = ''; 
    document.getElementById('profile-photo-input').value = ''; 
    document.getElementById('profile-modal').style.display = 'flex'; 
};
window.saveProfile = async function() { const newName = document.getElementById('profile-username').value.trim(); const newDept = document.getElementById('profile-department').value; const p = document.getElementById('profile-password').value; const f = document.getElementById('profile-photo-input').files[0]; if(!newName) return alert("O nome não pode ficar vazio."); if(!newDept) return alert("Selecione um departamento."); const fd = new FormData(); fd.append('userId', currentUser.id); fd.append('username', newName); fd.append('department', newDept); if(p) fd.append('password', p); if(f) fd.append('photo', f); try { const res = await fetch('/update-profile', { method:'POST', body:fd }); const data = await res.json(); if (data.success) { alert('Perfil atualizado!'); document.getElementById('profile-modal').style.display='none'; } else { alert(data.message || "Erro ao atualizar."); } } catch(e) { console.error(e); alert("Erro de conexão."); } };

// FUNÇÕES DE GRUPO (RESTAURADAS)
window.openModalCreate = function() { const list = document.getElementById('modal-users-list'); list.innerHTML = ''; const header = document.createElement('div'); header.style.padding = '10px'; header.style.borderBottom = '1px solid #ddd'; header.style.fontWeight = 'bold'; header.innerHTML = `<input type="checkbox" id="master-check" onchange="toggleAll(this)"> Selecionar Todos`; list.appendChild(header); allUsers.forEach(u => { if(u.id !== currentUser.id) { const div = document.createElement('div'); div.className = 'user-checkbox-item'; div.innerHTML = `<input type="checkbox" class="user-sel" value="${u.id}"> ${u.username}`; list.appendChild(div); } }); document.getElementById('group-modal').style.display = 'flex'; };
window.toggleAll = function(source) { document.querySelectorAll('.user-sel').forEach(c => c.checked = source.checked); };
window.createGroup = async function() { const name = document.getElementById('new-group-name').value; const isB = document.getElementById('is-broadcast').checked; const members = Array.from(document.querySelectorAll('.user-sel:checked')).map(x => x.value); if(!name || members.length === 0) return alert('Preencha o nome e selecione membros.'); await fetch('/create-group', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, creatorId: currentUser.id, members, isBroadcast: isB }) }); document.getElementById('group-modal').style.display = 'none'; };
window.toggleSuper = async function(targetUserId) { if(!confirm("Alterar privilégio de Admin?")) return; await fetch('/toggle-super-admin', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ requesterId: currentUser.id, targetUserId }) }); };
window.openGroupSettings = function() { document.getElementById('settings-modal').style.display = 'flex'; window.loadGroupSettings(); };
window.loadGroupSettings = async function() { const list = document.getElementById('settings-members-list'); list.innerHTML = 'Carregando...'; const res = await fetch(`/group-details/${currentChatId}`); const mems = await res.json(); const meIn = mems.find(m => m.id == currentUser.id); const isAdmin = (meIn && meIn.is_admin) || currentUser.is_super_admin; const btnLeave = document.getElementById('btn-leave'); const btnDel = document.getElementById('btn-delete'); const addArea = document.getElementById('add-member-area'); if(btnLeave) btnLeave.style.display = isAdmin ? 'none' : 'block'; if(btnDel) btnDel.style.display = isAdmin ? 'block' : 'none'; if(addArea) addArea.style.display = isAdmin ? 'block' : 'none'; list.innerHTML = ''; mems.forEach(m => { const badge = m.is_admin ? '⭐' : ''; let acts = ''; if(isAdmin && m.id !== currentUser.id) acts = `<button class="btn-remove" onclick="removeMember(${m.id})">Remover</button> <button class="btn-promote" onclick="promoteMember(${m.id})">Admin</button>`; list.innerHTML += `<div class="member-item"><span>${badge} ${m.username}</span><div>${acts}</div></div>`; }); if(isAdmin) { const sel = document.getElementById('add-member-select'); sel.innerHTML = ''; allUsers.filter(u => !mems.find(m => m.id == u.id)).forEach(u => sel.innerHTML += `<option value="${u.id}">${u.username}</option>`); } };
window.addMember = async function() { const uid = document.getElementById('add-member-select').value; if(uid) { await fetch('/group/add-member', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({groupId:currentChatId, userId:uid}) }); window.loadGroupSettings(); } };
window.addNewMember = function() { window.addMember(); };
window.removeMember = async function(uid) { if(confirm('Remover?')) await fetch('/group/remove-member', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({groupId:currentChatId, userId:uid}) }); window.loadGroupSettings(); };
window.promoteMember = async function(uid) { if(confirm('Tornar admin?')) await fetch('/group/promote', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({groupId:currentChatId, userId:uid}) }); window.loadGroupSettings(); };
window.leaveGroup = async function() { if(confirm('Sair?')) { await fetch('/group/leave', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({groupId:currentChatId, userId:currentUser.id}) }); document.getElementById('settings-modal').style.display='none'; window.closeChat(); } };
window.deleteGroup = async function() { if(confirm('Excluir?')) { await fetch('/group/delete', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({groupId:currentChatId}) }); document.getElementById('settings-modal').style.display='none'; window.closeChat(); } };

// LISTENERS
socket.on('update online list', (ids) => { onlineIds = ids; window.renderLists(); });
socket.on('refresh data', () => { window.loadData(); });
socket.on('chat message', (data) => {
    data.fileName = data.fileName || data.file_name; 
    data.msgType = data.msgType || data.msg_type;
    const isMine = data.userId == currentUser.id;

    // --- LÓGICA DE ATUALIZAÇÃO DA ORDEM ---
    if (data.targetType === 'group') {
        const g = allGroups.find(x => x.id == data.targetId);
        if (g) {
            // Se estou no chat, mostro msg. Se não, aumento contador.
            if (currentChatType === 'group' && currentChatId == data.targetId) {
                window.addMessageToScreen(data);
            } else {
                g.unread++;
                if(!isMine) window.notifyUser(data, g.name);
            }
            window.renderLists(); // Reordena a lista (Grupo sobe)
        }
    } else {
        // Chat Privado
        // Se EU mandei, atualizo quem recebeu (para subir na minha lista)
        // Se EU recebi, atualizo quem mandou (para subir na minha lista)
        const interactionUserId = isMine ? data.targetId : data.userId;
        const u = allUsers.find(x => x.id == interactionUserId);
        
        if (u) {
            u.last_activity = new Date(); // Atualiza horário da última conversa
            
            // Se estou vendo o chat dessa pessoa
            if ((currentChatType === 'private' && currentChatId == data.userId) || (isMine && currentChatId == data.targetId)) {
                window.addMessageToScreen(data);
                if(!isMine) window.markAsRead(data.userId);
            } else {
                // Se não estou vendo, é não lida
                if(!isMine && data.targetId == currentUser.id) {
                    u.unread++;
                    window.renderLists(); // Reordena (Sobe para o topo)
                    window.notifyUser(data);
                }
            }
            // Garante reordenação mesmo se já estiver lido (para ficar em Recentes)
            window.renderLists(); 
        }
    }
});
socket.on('message updated', (data) => { 
    const el = document.getElementById(`msg-text-${data.messageId}`); 
    if(el) { el.innerHTML = formatMessage(data.newText); }
});
socket.on('message pinned', (data) => { setTimeout(() => { if(currentChatId) window.loadPinnedMessages(currentChatId, currentChatType); }, 200); });
socket.on('message deleted', (data) => { const b = document.getElementById(`msg-bubble-${data.messageId}`); if(b) { const h = b.querySelector('.msg-header').outerHTML; b.innerHTML = `${h}<div class="deleted-content" style="color:#aaa;font-style:italic">🚫 Mensagem apagada</div>`; const c = document.getElementById(`msg-${data.messageId}`); if(c) { const a = c.querySelector('.msg-actions'); if(a) a.remove(); } } window.loadPinnedMessages(currentChatId, currentChatType); });
socket.on('read confirmation', (data) => { if(currentChatType === 'private' && currentChatId == data.readerId) { document.querySelectorAll('.read-ticks').forEach(el => el.classList.add('read')); } });

// INIT
document.addEventListener('DOMContentLoaded', () => {
    console.log("Chat V53 - Full Restoration + Fixes");
    socket.emit('i am online', currentUser.id);
    window.loadData();
    if ("Notification" in window && Notification.permission !== "granted") Notification.requestPermission();
    const fileInput = document.getElementById('file-input');
    if(fileInput) fileInput.onchange = () => window.uploadFile();

    // EMOJI CONFIG
    if(window.EmojiButton) {
        const picker = new EmojiButton({ 
            // Alteramos de 'auto' para 'bottom-start' ou removemos a posição JS 
            // para deixar o CSS mandar, mas 'auto' com o CSS fixed acima funciona bem.
            position: 'auto', 
            rootElement: document.body,
            theme: 'light', 
            autoHide: false, 
            zIndex: 999999
        });
        const trigger = document.getElementById('emoji-btn');
        const input = document.getElementById('input');
        
        picker.on('emoji', selection => { 
            const char = (selection && selection.emoji) ? selection.emoji : selection;
            input.value += char; 
            input.focus(); 
        });
        
        if(trigger) {
            trigger.addEventListener('click', () => picker.togglePicker(trigger));
        }
    }

    // Paste
    const inputEl = document.getElementById('input');
    if(inputEl) {
        inputEl.addEventListener('paste', (event) => {
            const items = (event.clipboardData || event.originalEvent.clipboardData).items;
            for (let index in items) {
                const item = items[index];
                if (item.kind === 'file') {
                    const file = item.getAsFile();
                    window.uploadFile(file);
                }
            }
        });
    }
});

window.deleteUserBtn = async function(targetId, targetName) {
    if(!confirm(`⚠️ ATENÇÃO ⚠️\n\nTem certeza que deseja EXCLUIR DEFINITIVAMENTE o usuário:\n"${targetName}"?\n\nEssa ação não pode ser desfeita.`)) {
        return;
    }

    try {
        const res = await fetch('/admin/delete-user', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                adminId: currentUser.id, 
                targetUserId: targetId 
            })
        });
        
        const data = await res.json();
        
        if(data.success) {
            alert("Usuário excluído com sucesso.");
            // O socket.on('refresh data') vai atualizar a lista automaticamente
        } else {
            alert("Erro: " + data.message);
        }
    } catch(e) {
        console.error(e);
        alert("Erro de conexão ao tentar excluir.");
    }
};

// --- CORREÇÃO FINAL: SEPARADORES DE DATA AGRUPADOS ---

// 1. Calcula o texto bonito (Hoje, Ontem ou Data)
window.getFancyDate = function(isoDateStr) {
    if (!isoDateStr) return "";
    const d = new Date(isoDateStr);
    const now = new Date();
    
    // Zera as horas para comparar apenas os dias (Meia-noite)
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    
    // Calcula a diferença em dias
    const diffTime = today - msgDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "HOJE";
    if (diffDays === 1) return "ONTEM";
    
    // Se for mais antigo, retorna DD/MM/AAAA
    return d.toLocaleDateString('pt-BR');
};

// 2. Varre o chat e agrupa mensagens do mesmo dia
window.updateDateSeparators = function() {
    // Remove separadores antigos para não duplicar
    document.querySelectorAll('.date-separator').forEach(el => el.remove());

    const messages = document.querySelectorAll('.msg-container');
    let lastDateKey = null; // Variável para guardar o dia da mensagem anterior

    messages.forEach(msg => {
        const rawDate = msg.getAttribute('data-date'); 
        if (!rawDate) return;

        // CRUCIAL: Criamos uma chave que só muda se o DIA mudar
        // Exemplo: "05/12/2025". Ignora se é 10:00 ou 10:05.
        const d = new Date(rawDate);
        const dateKey = d.toLocaleDateString('pt-BR'); 

        // Se a chave mudou em relação à mensagem anterior, desenha o separador
        if (dateKey !== lastDateKey) {
            const sep = document.createElement('div');
            sep.className = 'date-separator';
            sep.innerHTML = `<span class="date-pill">${window.getFancyDate(rawDate)}</span>`;
            
            // Insere ANTES da mensagem atual
            msg.parentNode.insertBefore(sep, msg);
            
            // Atualiza a chave para não desenhar de novo nas próximas mensagens desse dia
            lastDateKey = dateKey;
        }
    });
};