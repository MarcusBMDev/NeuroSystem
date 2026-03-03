const currentUser = JSON.parse(localStorage.getItem('agendaUser'));
const roomConfig = {
    1: { // Sala de Reuniões
        duration: 60, // minutos
        start: "08:00",
        end: "18:00",
        lunchStart: "12:00",
        lunchEnd: "14:00" // Retorna às 14h
    },
    2: { // NeuroCopa
        duration: 40, // minutos
        start: "08:00",
        end: "18:00",
        lunchStart: "12:00",
        lunchEnd: "14:00"
    }
};

// Função auxiliar para somar minutos a um horário "HH:MM"
function addMinutes(timeStr, minutes) {
    const [h, m] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m, 0, 0);
    date.setMinutes(date.getMinutes() + minutes);
    return date.toTimeString().slice(0, 5); // Retorna "HH:MM"
}

// Função para gerar slots dinamicamente
function generateSlots(roomId) {
    const config = roomConfig[roomId];
    const slots = [];
    let currentTime = config.start;

    while (currentTime < config.end) {
        // Calcula quando este slot terminaria
        const nextTime = addMinutes(currentTime, config.duration);

        // Verifica se o slot cai no horário de almoço
        // Regra: O slot deve terminar antes ou às 12:00, OU começar às 14:00 ou depois
        const isLunchTime = (currentTime >= config.lunchStart && currentTime < config.lunchEnd);
        const endsInLunch = (nextTime > config.lunchStart && nextTime <= config.lunchEnd);

        if (!isLunchTime && !endsInLunch) {
            // Se o término ultrapassar o fim do dia, paramos
            if (nextTime > config.end) break;
            
            slots.push(currentTime);
        }

        // Se estivermos na hora do almoço, saltamos direto para o fim do almoço
        if (currentTime >= config.lunchStart && currentTime < config.lunchEnd) {
            currentTime = config.lunchEnd;
        } else {
            currentTime = nextTime;
        }
    }
    return slots;
}
// INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('login-form')) {
        if (currentUser) window.location.href = 'agenda.html';
    } else if (document.getElementById('agenda-app')) {
        if (!currentUser) window.location.href = 'index.html';
        else initAgenda();
    }
});

const materialsRoom1 = ["TV", "Notebook", "Som", "Quadro Branco", "Projetor"]; 
const materialsRoom2 = ["Fogão", "Geladeira", "Microondas", "Utensílios", "Mesas"]; 

// --- LOGIN ---
async function login(event) {
    event.preventDefault();
    const btn = event.target.querySelector('button');
    btn.innerText = 'Entrando...'; btn.disabled = true;
    const userVal = document.getElementById('username').value;
    const passVal = document.getElementById('password').value;

    try {
        const res = await fetch(`login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: userVal, password: passVal })
        });
        const data = await res.json();
        if (data.success) {
            localStorage.setItem('agendaUser', JSON.stringify(data.user));
            window.location.href = 'agenda.html';
        } else { alert('Usuário ou senha incorretos.'); }
    } catch (error) { alert('Erro ao conectar.'); } 
    finally { btn.innerText = 'Entrar'; btn.disabled = false; }
}

function logout() { localStorage.removeItem('agendaUser'); window.location.href = 'index.html'; }

// --- AGENDA PRINCIPAL ---
let currentRoom = 1;
let currentDate = new Date().toISOString().split('T')[0];
let selectedTimeSlot = null;
let refreshInterval = null; // Variável para controlar a atualização

function initAgenda() {
    const adminLabel = currentUser.is_super_admin ? ' (Admin)' : '';
    document.getElementById('user-name-display').innerText = `Olá, ${currentUser.username}${adminLabel}`;
    
    // Adiciona botão Admin se for super admin
    if (currentUser.is_super_admin) {
        const headerDiv = document.querySelector('.app-header div:last-child');
        const adminBtn = document.createElement('a');
        adminBtn.href = '/admin';
        adminBtn.innerHTML = '<i class="fa-solid fa-gauge"></i> Painel Admin';
        adminBtn.style = 'background-color: #2e7d32; color: white; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; font-size: 0.9rem; box-shadow: 0 2px 5px rgba(0,0,0,0.2); margin-right: 15px;';
        headerDiv.insertBefore(adminBtn, headerDiv.firstChild);
    }

    const dateInput = document.getElementById('date-picker');
    dateInput.value = currentDate;
    if (!currentUser.is_super_admin) dateInput.min = currentDate; 
    
    // Carrega a primeira vez
    loadSlots();

    // 🔄 ATUALIZAÇÃO AUTOMÁTICA (A CADA 5 SEGUNDOS)
    // Isso resolve o problema de "não ver o agendamento do outro"
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(() => {
        // Só atualiza se o modal de reserva estiver FECHADO (para não atrapalhar quem está digitando)
        const modal = document.getElementById('booking-modal');
        if (modal.style.display === 'none' || modal.style.display === '') {
            loadSlots(true); // Passamos true para saber que é atualização silenciosa
        }
    }, 5000);
}

function selectRoom(roomId, element) {
    currentRoom = roomId;
    document.querySelectorAll('.room-btn').forEach(btn => btn.classList.remove('active'));
    element.classList.add('active');
    loadSlots();
}

// CARREGAR DADOS
async function loadSlots(isAutoRefresh = false) {
    const dateVal = document.getElementById('date-picker').value;
    currentDate = dateVal;
    
    const roomName = currentRoom === 1 ? "Sala de Reuni\u00F5es" : "NeuroCopa";
    document.getElementById('grid-title').innerText = `Disponibilidade: ${roomName} (${dateVal.split('-').reverse().join('/')})`;

    try {
        // Truque do TIMESTAMP para evitar cache e mostrar dados na hora
        const timestamp = new Date().getTime();
        const res = await fetch(`api/bookings?t=${timestamp}`);
        const allBookings = await res.json();
        
        const dayBookings = allBookings.filter(b => 
            (b.room_id == currentRoom) && (b.date_str === dateVal)
        );
        
        renderGrid(dayBookings);
        
        // Atualiza a lista lateral também
        loadMyBookings();
        
    } catch (error) { 
        if(!isAutoRefresh) console.error("Erro:", error); 
    }
}

function renderGrid(bookings) {
    const container = document.getElementById('slots-container');
    container.innerHTML = '';

    // GERA OS HORÁRIOS BASEADO NA SALA ATUAL
    const times = generateSlots(currentRoom);

    times.forEach(time => {
        const booking = bookings.find(b => b.time_str === time);
        const div = document.createElement('div');
        div.className = 'time-slot';

        if (booking) {
            div.classList.add('taken');
            
            if (booking.title === "BLOQUEADO") {
                div.style.backgroundColor = "#555";
                div.style.color = "#fff";
                div.innerHTML = `🔒 BLOQUEADO`;
            } else {
                div.innerHTML = `🚫 ${time}<br><span class="taken-info">${booking.username}<br>${booking.title || ''}</span>`;
            }
            
            if (currentUser.is_super_admin || booking.user_id === currentUser.id) {
                div.style.cursor = 'pointer';
                div.onclick = () => openAdminCancelModal(booking);
            }
        } else {
            div.innerHTML = `✅ ${time}`;
            div.onclick = () => openBookingModal(time);
        }
        container.appendChild(div);
    });
}

// --- MODAIS ---
function openBookingModal(time) {
    selectedTimeSlot = time;
    const roomName = currentRoom === 1 ? "Sala de Reuni\u00F5es" : "NeuroCopa";
    document.getElementById('modal-title').innerText = "Nova Reserva";
    document.getElementById('modal-details').innerText = `${roomName} - ${time}`;

    const setor = currentUser.department || "Geral";
    document.getElementById('user-info-readonly').value = `${currentUser.username} - ${setor}`;
    document.getElementById('booking-role').value = '';
    document.getElementById('booking-reason').value = '';

    const matContainer = document.getElementById('materials-container');
    matContainer.innerHTML = '';
    const items = currentRoom === 1 ? materialsRoom1 : materialsRoom2;
    items.forEach(item => {
        matContainer.innerHTML += `<label class="checkbox-item"><input type="checkbox" value="${item}" class="mat-check"> ${item}</label>`;
    });

    document.getElementById('booking-form').style.display = 'block';
    document.getElementById('btn-confirm-booking').style.display = 'inline-block';
    
    // Esconde botões de ação
    const btnBlock = document.getElementById('btn-block-slot');
    const btnCancel = document.getElementById('btn-force-cancel');
    if(btnBlock) btnBlock.style.display = currentUser.is_super_admin ? 'inline-block' : 'none';
    if(btnCancel) btnCancel.style.display = 'none';

    document.getElementById('booking-modal').style.display = 'flex';
}

function openAdminCancelModal(booking) {
    document.getElementById('modal-title').innerText = "Gerenciar Horário";
    
    let html = "";
    if (booking.title === "BLOQUEADO") {
        html = `
            <div style="background:#eee; padding:10px; border-radius:5px; text-align:center;">
                <h3 style="color:#555; margin:0;">🔒 HORÁRIO BLOQUEADO</h3>
                <small>Ninguém pode reservar este horário.</small>
            </div>`;
    } else {
        html = `
            <div style="text-align:left; font-size:0.95rem; line-height:1.6;">
                <strong>👤 Responsável:</strong> ${booking.username}<br>
                <strong>🏢 Setor:</strong> ${booking.department || 'N/A'}<br>
                <strong>💼 Cargo/Função:</strong> ${booking.role || 'Não informado'}<br>
                <hr style="border:0; border-top:1px solid #ddd; margin:8px 0;">
                <strong>📌 Finalidade:</strong> ${booking.title}<br>
                <strong>📦 Materiais:</strong> ${booking.materials || '<span style="color:#999">Nenhum</span>'}
            </div>`;
    }
    
    document.getElementById('modal-details').innerHTML = html;
    document.getElementById('booking-form').style.display = 'none';
    document.getElementById('btn-confirm-booking').style.display = 'none';
    
    const btnBlock = document.getElementById('btn-block-slot');
    if(btnBlock) btnBlock.style.display = 'none';
    
    const btnCancel = document.getElementById('btn-force-cancel');
    btnCancel.style.display = 'inline-block';

    if (booking.title === "BLOQUEADO") {
        btnCancel.innerText = "🔓 DESBLOQUEAR";
        btnCancel.style.backgroundColor = "#2e7d32";
    } else {
        btnCancel.innerText = "🚨 CANCELAR RESERVA";
        btnCancel.style.backgroundColor = "#c62828";
    }
    
    btnCancel.onclick = () => forceCancel(booking.id);
    document.getElementById('booking-modal').style.display = 'flex';
}

function closeBookingModal() { document.getElementById('booking-modal').style.display = 'none'; }

// --- AÇÕES ---
async function blockSlot() {
    if(!confirm("Bloquear este horário?")) return;
    sendBookingData("BLOQUEADO", "Admin", "Bloqueio");
}

async function confirmBooking() {
    const role = document.getElementById('booking-role').value;
    const reason = document.getElementById('booking-reason').value;
    const checked = Array.from(document.querySelectorAll('.mat-check:checked')).map(c => c.value);
    
    if(!role || !reason) return alert("Preencha Cargo e Finalidade.");
    sendBookingData(reason, role, checked.join(', '));
}

async function sendBookingData(title, role, materials) {
    // Pega a duração correta da sala atual
    const duration = roomConfig[currentRoom].duration;
    
    // Cria data de início
    const startISO = `${currentDate}T${selectedTimeSlot}:00`;
    
    // Calcula data de fim usando a função auxiliar que criamos ou lógica de Date
    // Aqui faremos manual para garantir o formato ISO correto para o MySQL
    const [h, m] = selectedTimeSlot.split(':').map(Number);
    const endDateObj = new Date();
    endDateObj.setHours(h, m + duration, 0, 0); // Soma os 40 ou 60 minutos
    
    // Formata para HH:MM para montar a string ISO
    const endH = endDateObj.getHours().toString().padStart(2, '0');
    const endM = endDateObj.getMinutes().toString().padStart(2, '0');
    
    const endISO = `${currentDate}T${endH}:${endM}:00`;

    try {
        const res = await fetch(`api/bookings`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                roomId: currentRoom, userId: currentUser.id,
                start: startISO, end: endISO, 
                title: title, role: role, materials: materials
            })
        });
        const result = await res.json();
        if (result.success) { 
            closeBookingModal(); 
            loadSlots(); // Força atualização imediata
        } else { alert(result.message); }
    } catch (e) { alert("Erro ao salvar."); }
}

async function forceCancel(id) {
    if(!confirm("Confirmar exclusão/desbloqueio?")) return;
    try {
        await fetch(`api/bookings/delete`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ id })
        });
        closeBookingModal(); 
        loadSlots(); // Força atualização imediata
    } catch (e) { alert("Erro ao cancelar."); }
}

// --- MEUS AGENDAMENTOS ---
async function loadMyBookings() {
    try {
        // Truque ANTI-CACHE também aqui na lateral
        const timestamp = new Date().getTime();
        const res = await fetch(`api/my-bookings?t=${timestamp}`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ userId: currentUser.id })
        });
        const list = await res.json();
        const container = document.getElementById('my-bookings-list');
        container.innerHTML = '';
        if (list.length === 0) { container.innerHTML = '<small>Nenhum.</small>'; return; }
        
        list.forEach(b => {
            const d = new Date(b.start_time);
            const correctRoomName = (b.room_id == 1) ? "Sala de Reuni\u00F5es" : "NeuroCopa";
            const title = b.title === "BLOQUEADO" ? "🔒 Bloqueio" : correctRoomName;
            
            container.innerHTML += `
                <div class="booking-item" style="border-left-color: ${b.room_id==1?'#0d47a1':'#e65100'}">
                    <div><strong>${title}</strong><br>${d.toLocaleDateString()} - ${d.toLocaleTimeString().slice(0,5)}</div>
                    <button class="btn-delete" onclick="forceCancel(${b.id})">✖</button>
                </div>`;
        });
    } catch (e) { console.error(e); }
}