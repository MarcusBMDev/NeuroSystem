// public/js/neurocar.js

let currentUser = null;

// INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', () => {
    const storedUser = localStorage.getItem('neuroCarUser');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        mostrarDashboard();
    } else {
        mostrarLogin();
    }
});

function mostrarLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-content').style.display = 'none';
}

function mostrarDashboard() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-content').style.display = 'flex';
    document.getElementById('app-content').style.flexDirection = 'column';
    document.getElementById('user-display').innerText = `Olá, ${currentUser.username}`;
    carregarStatus();
    carregarHistorico();
    setInterval(carregarStatus, 5000);
}

async function fazerLogin(event) {
    event.preventDefault();
    const btn = event.target.querySelector('button');
    const txt = btn.innerText;
    btn.innerText = "Entrando..."; btn.disabled = true;

    const userVal = document.getElementById('username').value;
    const passVal = document.getElementById('password').value;

    try {
        const res = await fetch('/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: userVal, password: passVal })
        });
        const data = await res.json();
        if (data.success) {
            localStorage.setItem('neuroCarUser', JSON.stringify(data.user));
            currentUser = data.user;
            mostrarDashboard();
        } else { alert('Dados incorretos.'); }
    } catch (e) { alert('Erro no servidor.'); } 
    finally { btn.innerText = txt; btn.disabled = false; }
}

function logout() {
    localStorage.removeItem('neuroCarUser');
    location.reload();
}

// --- LÓGICA DO CARRO ---
let carData = null;

async function carregarStatus() {
    try {
        const res = await fetch('/api/car/status');
        carData = await res.json();
        renderCard(carData);
    } catch (e) { console.error(e); }
}

function renderCard(car) {
    const container = document.getElementById('car-display');
    const carImageHtml = `<img src="neurocar.png" class="car-photo" alt="Foto do Veículo">`;

    if (car.is_available) {
        container.innerHTML = `
            <div class="car-card status-livre" onclick="realizarCheckout()">
                ${carImageHtml}
                <div class="car-plate">${car.plate}</div>
                
                <div class="info-box">
                    <span class="info-label">KM ATUAL:</span>
                    <span class="info-value" style="color:#27ae60;">${car.current_km} km</span>
                    <hr style="border:0; border-top:1px solid #ddd; margin:10px 0;">
                    <span class="info-label">ÚLTIMO CONDUTOR:</span>
                    <span class="info-value">${car.last_driver_name}</span>
                </div>
                <button class="btn-action btn-green">🔑 PEGAR VEÍCULO</button>
            </div>`;
    } else {
        const trip = car.current_trip;
        if(!trip) return;
        const hora = new Date(trip.start_time).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
        
        container.innerHTML = `
            <div class="car-card status-ocupado" onclick="abrirModalCheckin(${trip.user_id})">
                ${carImageHtml}
                <div class="car-plate">${car.plate}</div>
                
                <div class="info-box" style="background:#fff;">
                    <span class="info-label">CONDUTOR:</span> <span class="info-value" style="color:#c0392b;">${trip.user_name}</span>
                    <span class="info-label">SAÍDA:</span> <span class="info-value">${hora} - ${trip.start_km} km</span>
                </div>
                <button class="btn-action btn-red">🛑 DEVOLVER</button>
            </div>`;
    }
}

async function realizarCheckout() {
    if(!confirm(`Retirar o veículo como ${currentUser.username}?`)) return;
    try {
        await fetch('/api/car/checkout', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ userId: currentUser.id, userName: currentUser.username })
        });
        carregarStatus();
    } catch (e) { alert('Erro.'); }
}

function abrirModalCheckin(driverId) {
    if (currentUser.id !== driverId && !currentUser.is_super_admin) {
        return alert("⛔ Somente o condutor ou Admin pode devolver.");
    }
    document.getElementById('modal-checkin').style.display = 'flex';
}

async function confirmarCheckin() {
    const km = document.getElementById('input-km').value;
    const obs = document.getElementById('input-obs').value;
    if(!km) return alert("Informe o KM!");
    
    try {
        const res = await fetch('/api/car/checkin', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ userId: currentUser.id, finalKm: km, notes: obs, isAdmin: currentUser.is_super_admin })
        });
        const d = await res.json();
        if(d.success) { fecharModal(); carregarStatus(); carregarHistorico(); }
        else { alert(d.message); }
    } catch (e) { alert('Erro.'); }
}

function fecharModal() { document.getElementById('modal-checkin').style.display = 'none'; }

// --- HISTÓRICO COM CÁLCULO DE TEMPO ---
async function carregarHistorico() {
    const res = await fetch('/api/car/history');
    const lista = await res.json();
    const tbody = document.querySelector('#history-table tbody');
    tbody.innerHTML = '';
    
    lista.forEach(t => {
        const data = new Date(t.start_time).toLocaleDateString('pt-BR');
        
        // Formatar Horas
        const horaSaida = new Date(t.start_time).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
        const horaChegada = t.end_time ? new Date(t.end_time).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}) : '-';
        
        // Calcular Duração
        let duracao = '-';
        if (t.end_time) {
            const diff = new Date(t.end_time) - new Date(t.start_time);
            const diffMin = Math.floor(diff / 60000);
            const h = Math.floor(diffMin / 60);
            const m = diffMin % 60;
            duracao = `${h}h ${m}m`;
        }

        tbody.innerHTML += `
            <tr>
                <td>${data}</td>
                <td><strong>${t.user_name}</strong></td>
                <td>${horaSaida} <small>(${t.start_km}km)</small></td>
                <td>${horaChegada} <small>(${t.end_km}km)</small></td>
                <td>${duracao}</td>
            </tr>`;
    });
}