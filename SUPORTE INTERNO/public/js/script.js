const API_URL = '/api/chamados';

function mudarFormulario() {
    const tipo = document.getElementById('tipo').value;
    const camposSuporte = document.getElementById('campos-suporte');
    const camposProjeto = document.getElementById('campos-projeto');
    const lblTestes = document.getElementById('lblTestes');
    const grupoTestes = document.getElementById('grupo-testes');

    if (tipo === 'projeto') {
        camposSuporte.style.display = 'none';
        camposProjeto.style.display = 'block';
        // Esconde a área de testes de suporte para projetos
        grupoTestes.style.display = 'none';
        
        document.getElementById('objetivo').required = true;
    } else {
        camposSuporte.style.display = 'block';
        camposProjeto.style.display = 'none';
        grupoTestes.style.display = 'block';
        lblTestes.innerText = "Testes Realizados (Marque o que já tentou):";

        document.getElementById('objetivo').required = false;
    }
}

function mudarCategoria() {
    const categoria = document.getElementById('categoria_demanda').value;
    const campoOutros = document.getElementById('campo-outros');
    if (categoria === 'Outros') {
        campoOutros.style.display = 'block';
        document.getElementById('detalhes_outros').required = true;
    } else {
        campoOutros.style.display = 'none';
        document.getElementById('detalhes_outros').required = false;
    }
}

async function carregarFila() {
    try {
        const res = await fetch(API_URL);
        const dados = await res.json();
        const pendentes = dados.filter(c => c.status !== 'concluido' && c.status !== 'rejeitado');
        const div = document.getElementById('fila');
        
        if (pendentes.length === 0) {
            div.innerHTML = `<div style="text-align:center; padding:20px; color:#999;">
                <span style="font-size:2rem;">✅</span><br>Tudo tranquilo!
            </div>`;
            return;
        }

        div.innerHTML = '';
        pendentes.forEach(c => {
            let cor = `borda-${c.urgencia}`;
            let statusText = 'Aguardando';
            let statusColor = '#888';
            
            if(c.status === 'analise') { 
                cor = 'borda-analise'; 
                statusText = '🧐 Em Análise'; 
                statusColor = '#6f42c1';
            }
            if(c.status === 'andamento') { 
                statusText = '⚡ Em Atendimento'; 
                statusColor = '#fd7e14';
            }

            div.innerHTML += `
                <div class="chamado-item ${cor}">
                    <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:#666; margin-bottom:5px;">
                        <strong>#${c.id} - ${c.setor}</strong>
                        <span style="color:${statusColor}; font-weight:bold;">${statusText}</span>
                    </div>
                    <div style="font-weight:bold; color:#333;">${c.solicitante}</div>
                    <div style="font-size:0.9rem; color:#555; margin-top:5px;">${c.descricao}</div>
                </div>`;
        });
    } catch (e) { console.error("Erro fila:", e); }
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    
    // Configura o evento do formulário
    document.getElementById('formChamado').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.querySelector('.btn-submit');
        const textoOriginal = btn.innerText;
        
        btn.disabled = true; 
        btn.innerText = "Enviando...";

        // Coletar Testes (Checkboxes)
        const checkboxes = document.querySelectorAll('input[name="checkTeste"]:checked');
        let testesString = Array.from(checkboxes).map(cb => cb.value).join(', ');
        const outrosTestes = document.getElementById('testes_outros').value;
        if(outrosTestes) {
            testesString += (testesString ? ', ' : '') + outrosTestes;
        }
        if(!testesString && document.getElementById('tipo').value === 'suporte') {
            testesString = "Nenhum teste informado";
        }

        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tipo: document.getElementById('tipo').value,
                    solicitante: document.getElementById('solicitante').value,
                    setor: document.getElementById('setor').value,
                    urgencia: document.getElementById('urgencia').value,
                    descricao: document.getElementById('descricao').value,
                    testes_realizados: testesString,
                    // Novos Campos
                    software: document.getElementById('software') ? document.getElementById('software').value : '',
                    objetivo: document.getElementById('objetivo') ? document.getElementById('objetivo').value : '',
                    prazo_desejado: document.getElementById('prazo_desejado') ? document.getElementById('prazo_desejado').value : '',
                    impacto_esperado: document.getElementById('impacto_esperado') ? document.getElementById('impacto_esperado').value : '',
                    categoria_demanda: document.getElementById('categoria_demanda').value,
                    detalhes_outros: document.getElementById('detalhes_outros').value
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Erro desconhecido no servidor.');
            }
            
            document.getElementById('formChamado').reset();
            mudarFormulario(); // Reseta estados visuais
            alert('Solicitação enviada com sucesso!');
            carregarFila();
        } catch (error) {
            console.error(error);
            alert('Erro ao enviar: ' + error.message);
        } finally {
            btn.disabled = false; 
            btn.innerText = textoOriginal;
        }
    });

    // Inicia o polling
    setInterval(carregarFila, 5000);
    carregarFila();
});
