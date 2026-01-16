// public/js/login.js

async function login() {
    const u = document.getElementById('user').value;
    const p = document.getElementById('pass').value;
    
    const btn = document.querySelector('button');
    const originalText = btn.innerText;
    
    // Feedback visual
    btn.innerText = 'Entrando...';
    btn.disabled = true;
    
    try {
        const res = await fetch('/api/login', {
            method: 'POST', 
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ username: u, password: p })
        });
        const data = await res.json();
        
        if(data.success) {
            localStorage.setItem('mktUser', JSON.stringify(data.user));
            location.href = '/solicitar.html'; 
        } else { 
            alert(data.message); 
            btn.innerText = originalText;
            btn.disabled = false;
        }
    } catch(e) {
        alert('Erro de conexão com o servidor');
        btn.innerText = originalText;
        btn.disabled = false;
    }
}