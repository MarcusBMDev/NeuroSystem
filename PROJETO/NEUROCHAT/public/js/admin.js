// admin.js - Controle Administrativo do NeuroChat
let currentUser = null;
let cachedSectors = [];
let allUsersList = [];
let allGroupsList = [];

document.addEventListener('DOMContentLoaded', () => {
    // 1. Verifica autenticação de Super Admin
    currentUser = JSON.parse(localStorage.getItem('neurochat_user'));
    if (!currentUser || currentUser.is_super_admin !== 1) {
        alert('Acesso restrito. Apenas administradores do sistema.');
        window.location.href = '/chat.html';
        return;
    }

    document.getElementById('adminName').textContent = currentUser.username;

    // 2. Inicializa dados do Dashboard
    switchTab('dashboard');
});

// Alterna entre abas
function switchTab(tabId) {
    // Remove active de todas as abas do menu
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');

    // Oculta todas as views
    document.querySelectorAll('.admin-view').forEach(view => view.classList.remove('active'));
    document.getElementById(`view-${tabId}`).classList.add('active');

    // Carrega dados específicos da aba
    if (tabId === 'dashboard') {
        carregarKPIs();
    } else if (tabId === 'users') {
        carregarSectores().then(() => carregarUsuarios());
    } else if (tabId === 'groups') {
        carregarGrupos();
    } else if (tabId === 'sectors') {
        carregarSectoresCompleto();
    } else if (tabId === 'audit') {
        carregarSectores().then(() => inicializarAuditoria());
    } else if (tabId === 'files') {
        carregarArquivosAuditados();
    }
}

// Retorna à tela do chat comum
function voltarAoChat() {
    window.location.href = '/chat.html';
}

// 1. Carrega Indicadores (KPIs)
async function carregarKPIs() {
    try {
        const res = await fetch(`/api/admin/kpis?adminId=${currentUser.id}`);
        const kpis = await res.json();
        
        document.getElementById('kpiUsers').textContent = kpis.usersCount;
        document.getElementById('kpiUsersInativos').textContent = kpis.usersInativosCount;
        document.getElementById('kpiGroups').textContent = kpis.groupsCount;
        document.getElementById('kpiMessages').textContent = kpis.messagesCount;
        document.getElementById('kpiFiles').textContent = kpis.filesCount;
    } catch (e) {
        console.error(e);
    }
}

// Busca todos os setores reais do banco de dados
async function carregarSectores() {
    try {
        const res = await fetch(`/api/admin/sectors?adminId=${currentUser.id}`);
        cachedSectors = await res.json();
        
        // Popula os selects das modais
        const selectModal = document.getElementById('changeSectorSelect');
        const selectNew = document.getElementById('newSetorSelect');
        
        const optionsHtml = cachedSectors.map(s => `<option value="${s.id}">${s.nome}</option>`).join('');
        
        selectModal.innerHTML = '<option value="" disabled selected>Selecione um Setor</option>' + optionsHtml + '<option value="">Sem Setor</option>';
        selectNew.innerHTML = '<option value="" disabled selected>Selecione um Setor</option>' + optionsHtml + '<option value="">Sem Setor</option>';
    } catch (e) {
        console.error(e);
    }
}

// 2. Carrega lista de Usuários
async function carregarUsuarios() {
    try {
        const res = await fetch(`/api/admin/users?adminId=${currentUser.id}&includeInactive=true`);
        allUsersList = await res.json();
        
        const filterVal = document.getElementById('userStatusFilter').value || 'ativos';
        filtrarUsuariosTabela(filterVal);
    } catch (e) {
        console.error(e);
    }
}

// Filtra e renderiza a tabela de colaboradores por status e termo de busca
function filtrarUsuariosTabela() {
    const filterValue = document.getElementById('userStatusFilter')?.value || 'ativos';
    const searchVal = (document.getElementById('userSearchInput')?.value || '').toLowerCase().trim();

    const tbody = document.querySelector('#usersTable tbody');
    tbody.innerHTML = '';

    const filtered = allUsersList.filter(u => {
        let matchStatus = true;
        if (filterValue === 'ativos') matchStatus = (u.is_active === 1);
        else if (filterValue === 'inativos') matchStatus = (u.is_active === 0);

        let matchSearch = true;
        if (searchVal) {
            const name = (u.username || '').toLowerCase();
            const sector = (u.setor_nome || '').toLowerCase();
            matchSearch = name.includes(searchVal) || sector.includes(searchVal);
        }

        return matchStatus && matchSearch;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding:24px;">Nenhum colaborador encontrado para os filtros selecionados.</td></tr>`;
        return;
    }

    filtered.forEach(u => {
        const tr = document.createElement('tr');
        
        let badge = '';
        let actions = '';
        let nameStyle = '';

        if (u.is_active === 0) {
            badge = '<span class="badge badge-danger">Inativo</span>';
            nameStyle = 'style="text-decoration: line-through; color: var(--text-muted);"';
            actions = `<button class="btn btn-primary" style="background:#2e7d32; border:none;" onclick="reativarColaborador(${u.id})"><i class="fa-solid fa-user-plus"></i> Ativar</button>`;
        } else {
            badge = u.is_super_admin === 1 
                ? '<span class="badge badge-danger"><i class="fa-solid fa-crown"></i> Admin</span>' 
                : '<span class="badge badge-info">Colaborador</span>';
            actions = `
                <div style="display:flex; gap: 8px;">
                    <button class="btn btn-secondary" onclick="abrirModalSetor(${u.id}, '${u.username}', ${u.setor_id || 'null'})"><i class="fa-solid fa-building"></i> Setor</button>
                    <button class="btn btn-secondary" onclick="abrirModalResetSenha(${u.id}, '${u.username}')"><i class="fa-solid fa-key"></i> Senha</button>
                    <button class="btn btn-secondary" onclick="alternarPapelAdmin(${u.id})"><i class="fa-solid fa-shuffle"></i> Cargo</button>
                    <button class="btn btn-danger" onclick="excluirColaborador(${u.id})"><i class="fa-solid fa-trash"></i> Excluir</button>
                </div>
            `;
        }

        tr.innerHTML = `
            <td><strong ${nameStyle}>${u.username}</strong></td>
            <td>${u.setor_nome || '<span style="color:var(--text-muted);font-style:italic;">Sem Setor</span>'}</td>
            <td>${badge}</td>
            <td>${actions}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Modal Reset Senha
function abrirModalResetSenha(id, name) {
    document.getElementById('resetTargetUserId').value = id;
    document.getElementById('resetTargetUserName').value = name;
    document.getElementById('resetNewPassword').value = '';
    document.getElementById('modalResetPassword').classList.add('active');
}

function fecharModalResetPassword() {
    document.getElementById('modalResetPassword').classList.remove('active');
}

async function confirmarResetSenha() {
    const id = document.getElementById('resetTargetUserId').value;
    const pwd = document.getElementById('resetNewPassword').value.trim();

    if (!pwd) return alert('Digite a nova senha.');

    try {
        const response = await fetch('/api/admin/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                adminId: currentUser.id,
                targetUserId: id,
                newPassword: pwd
            })
        });

        if (response.ok) {
            alert('✅ Senha alterada com sucesso!');
            fecharModalResetPassword();
        }
    } catch (e) {
        console.error(e);
    }
}

// Modal Mudar Setor
function abrirModalSetor(id, name, currentSetorId) {
    document.getElementById('changeSectorUserId').value = id;
    document.getElementById('changeSectorUserName').value = name;
    document.getElementById('changeSectorSelect').value = currentSetorId || '';
    document.getElementById('modalChangeSector').classList.add('active');
}

function fecharModalChangeSector() {
    document.getElementById('modalChangeSector').classList.remove('active');
}

async function confirmarAlterarSetor() {
    const id = document.getElementById('changeSectorUserId').value;
    const sectorId = document.getElementById('changeSectorSelect').value;

    try {
        const response = await fetch('/admin/update-sector', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                adminId: currentUser.id,
                targetUserId: id,
                setorId: sectorId ? parseInt(sectorId) : null
            })
        });

        const data = await response.json();

        if (data.success) {
            alert('✅ Setor atualizado com sucesso!');
            fecharModalChangeSector();
            carregarUsuarios();
        } else {
            alert('Erro: ' + data.message);
        }
    } catch (e) {
        console.error(e);
    }
}

// Alternar papel administrador
async function alternarPapelAdmin(targetId) {
    if (!confirm('Deseja alternar o cargo de administrador deste usuário?')) return;

    try {
        const response = await fetch('/admin/toggle-admin-role', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                adminId: currentUser.id,
                targetUserId: targetId
            })
        });

        if (response.ok) {
            alert('Cargo atualizado!');
            carregarUsuarios();
        }
    } catch (e) {
        console.error(e);
    }
}

// Excluir Usuário
async function excluirColaborador(targetId) {
    if (!confirm('ATENÇÃO: Excluir o usuário removerá seu acesso e o inativará no sistema do NeuroChat. Deseja prosseguir?')) return;

    try {
        const response = await fetch('/admin/delete-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                adminId: currentUser.id,
                targetUserId: targetId
            })
        });

        if (response.ok) {
            alert('Colaborador inativado!');
            carregarUsuarios();
        }
    } catch (e) {
        console.error(e);
    }
}

// Modal Criar Novo Usuário
function abrirNovoUsuarioModal() {
    document.getElementById('newUsername').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('newSetorSelect').value = '';
    document.getElementById('modalNewUser').classList.add('active');
}

function fecharNovoUsuarioModal() {
    document.getElementById('modalNewUser').classList.remove('active');
}

async function salvarNovoUsuario(e) {
    e.preventDefault();
    const username = document.getElementById('newUsername').value.trim();
    const pwd = document.getElementById('newPassword').value.trim();
    const sectorId = document.getElementById('newSetorSelect').value;

    try {
        const response = await fetch('/api/admin/create-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                adminId: currentUser.id,
                username: username,
                password: pwd,
                setorId: sectorId ? parseInt(sectorId) : null
            })
        });

        const data = await response.json();

        if (response.ok) {
            alert('✅ Colaborador cadastrado com sucesso!');
            fecharNovoUsuarioModal();
            carregarUsuarios();
        } else {
            alert('Erro: ' + (data.error || 'Falha ao registrar.'));
        }
    } catch (e) {
        console.error(e);
    }
}

// 3. Carrega Grupos
async function carregarGrupos() {
    try {
        const res = await fetch(`/api/admin/groups?adminId=${currentUser.id}`);
        allGroupsList = await res.json();

        const tbody = document.querySelector('#groupsTable tbody');
        tbody.innerHTML = '';

        if (allGroupsList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding:24px;">Nenhum grupo ativo.</td></tr>`;
            return;
        }

        allGroupsList.forEach(g => {
            const tr = document.createElement('tr');
            
            const badgeType = g.is_broadcast === 1
                ? '<span class="badge badge-danger">📢 Transmissão</span>'
                : '<span class="badge badge-success">💬 Geral</span>';

            tr.innerHTML = `
                <td><strong>${g.name}</strong></td>
                <td>${badgeType}</td>
                <td>${g.creator_name || 'Sistema'}</td>
                <td>
                    <button class="btn btn-danger" onclick="excluirGrupoAPI(${g.id})"><i class="fa-solid fa-trash"></i> Excluir</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error(e);
    }
}

// Criação de Grupo
async function criarGrupoAPI(e) {
    e.preventDefault();
    const nome = document.getElementById('grupoNome').value.trim();
    const tipo = parseInt(document.getElementById('grupoTipo').value);

    try {
        const response = await fetch('/api/admin/create-group', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                adminId: currentUser.id,
                name: nome,
                isBroadcast: tipo === 1
            })
        });

        if (response.ok) {
            alert('✅ Grupo criado com sucesso!');
            document.getElementById('grupoForm').reset();
            carregarGrupos();
        }
    } catch (e) {
        console.error(e);
    }
}

// Exclusão de Grupo
async function excluirGrupoAPI(groupId) {
    if (!confirm('Deseja excluir permanentemente este grupo e todo o seu histórico de mensagens?')) return;

    try {
        const response = await fetch('/api/admin/delete-group', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                adminId: currentUser.id,
                groupId: groupId
            })
        });

        if (response.ok) {
            alert('Grupo excluído.');
            carregarGrupos();
        }
    } catch (e) {
        console.error(e);
    }
}

// 4. Auditoria de Chats
async function inicializarAuditoria() {
    try {
        // Popula seletores de auditoria
        // Buscamos a lista de usuários
        const uRes = await fetch(`/api/admin/users?adminId=${currentUser.id}&includeInactive=true`);
        const users = await uRes.json();
        
        const sel1 = document.getElementById('auditUser1Select');
        const sel2 = document.getElementById('auditUser2Select');
        
        let usersHtml = '<option value="" disabled selected>Selecione o Usuário</option>';
        users.forEach(u => {
            const suffix = u.is_active === 0 ? ' (Inativo)' : '';
            usersHtml += `<option value="${u.id}">${u.username}${suffix}</option>`;
        });
        
        sel1.innerHTML = usersHtml;
        sel2.innerHTML = usersHtml;

        // Buscamos a lista de grupos
        const gRes = await fetch(`/api/admin/groups?adminId=${currentUser.id}`);
        const groups = await gRes.json();
        
        const gSel = document.getElementById('auditGroupSelect');
        let groupsHtml = '<option value="" disabled selected>Selecione o Grupo</option>';
        groups.forEach(g => {
            groupsHtml += `<option value="${g.id}">${g.name}</option>`;
        });
        gSel.innerHTML = groupsHtml;

    } catch (e) {
        console.error(e);
    }
}

// Alterna entre seletor privado e grupo na auditoria
function toggleAuditSelection() {
    const type = document.getElementById('auditType').value;
    
    const pContainer = document.getElementById('auditPrivateSelectorContainer');
    const gContainer = document.getElementById('auditGroupSelectorContainer');
    
    if (type === 'private') {
        pContainer.style.display = 'block';
        gContainer.style.display = 'none';
    } else {
        pContainer.style.display = 'none';
        gContainer.style.display = 'block';
    }
    
    document.getElementById('auditMessagesHistory').innerHTML = '<p style="text-align: center; color: var(--text-muted); margin-top: 150px;">Selecione os destinos para auditar.</p>';
}

// Carrega as mensagens na caixa de auditoria
async function carregarAuditoriaMensagens() {
    const type = document.getElementById('auditType').value;
    const historyBox = document.getElementById('auditMessagesHistory');
    
    let url = `/api/admin/audit/messages?adminId=${currentUser.id}&type=${type}`;

    if (type === 'group') {
        const groupId = document.getElementById('auditGroupSelect').value;
        if (!groupId) return;
        url += `&targetId=${groupId}`;
    } else {
        const u1 = document.getElementById('auditUser1Select').value;
        const u2 = document.getElementById('auditUser2Select').value;
        if (!u1 || !u2) return;
        if (u1 === u2) {
            historyBox.innerHTML = '<p style="text-align: center; color: var(--danger); margin-top: 150px;">Selecione dois usuários diferentes.</p>';
            return;
        }
        url += `&senderId=${u1}&targetId=${u2}`;
    }

    try {
        historyBox.innerHTML = '<p style="text-align: center; color: var(--text-muted); margin-top: 150px;">Buscando histórico...</p>';
        
        const response = await fetch(url);
        const messages = await response.json();

        historyBox.innerHTML = '';
        if (messages.length === 0) {
            historyBox.innerHTML = '<p style="text-align: center; color: var(--text-muted); margin-top: 150px;">Nenhuma mensagem registrada nesta conversa.</p>';
            return;
        }

        messages.forEach(msg => {
            const div = document.createElement('div');
            div.style.marginBottom = '12px';
            div.style.padding = '8px';
            div.style.borderRadius = '6px';
            div.style.backgroundColor = '#fff';
            div.style.border = '1px solid #e2e8f0';

            const time = new Date(msg.timestamp).toLocaleString('pt-BR');
            
            let content = msg.text;
            if (msg.msg_type === 'file' || msg.file_name) {
                content = `📎 Arquivo Compartilhado: <a href="uploads/${msg.file_name}" target="_blank" style="color:var(--accent); font-weight:600;">${msg.file_name}</a>`;
            }

            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-muted); margin-bottom:4px; border-bottom: 1px dashed #eee; padding-bottom:2px;">
                    <strong>${msg.username}</strong>
                    <span>${time}</span>
                </div>
                <div style="word-break:break-all;">${content}</div>
            `;
            historyBox.appendChild(div);
        });

        // Rola até o final
        historyBox.scrollTop = historyBox.scrollHeight;

    } catch (e) {
        console.error(e);
    }
}

// 5. Carrega arquivos auditados
async function carregarArquivosAuditados() {
    try {
        const res = await fetch(`/api/admin/audit/files?adminId=${currentUser.id}`);
        const files = await res.json();

        const tbody = document.querySelector('#auditFilesTable tbody');
        tbody.innerHTML = '';

        if (files.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding:24px;">Nenhum arquivo compartilhado.</td></tr>`;
            return;
        }

        files.forEach(f => {
            const tr = document.createElement('tr');
            const time = new Date(f.timestamp).toLocaleString('pt-BR');

            tr.innerHTML = `
                <td>${time}</td>
                <td><strong>${f.username}</strong></td>
                <td style="word-break: break-all;">${f.file_name}</td>
                <td><span class="badge ${f.target_type === 'group' ? 'badge-info' : 'badge-success'}">${f.target_type === 'group' ? 'Grupo' : 'Privado'}</span></td>
                <td>
                    <a href="uploads/${f.file_name}" target="_blank" class="btn btn-secondary" style="padding:4px 8px; font-size:11px;"><i class="fa-solid fa-download"></i> Baixar</a>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error(e);
    }
}

// 6. Gerenciamento Completo de Setores e Subgrupos
async function carregarSectoresCompleto() {
    try {
        const res = await fetch(`/api/admin/sectors-with-count?adminId=${currentUser.id}`);
        const sectors = await res.json();

        if (!Array.isArray(sectors)) {
            console.error('Resposta inválida ao listar setores:', sectors);
            return;
        }

        // Atualiza os dropdowns de seleção de Grupo Pai (no cadastro e na edição)
        const parentSelect = document.getElementById('setorParentSelect');
        const editParentSelect = document.getElementById('editSectorParentSelect');
        
        let parentOptions = '<option value="">🏷️ Nenhum (Grupo Principal)</option>';
        // Filtra apenas grupos principais para serem opções de pai
        const mainGroups = sectors.filter(s => !s.parent_id);
        mainGroups.forEach(g => {
            parentOptions += `<option value="${g.id}">🏷️ ${g.nome}</option>`;
        });

        if (parentSelect) parentSelect.innerHTML = parentOptions;
        if (editParentSelect) editParentSelect.innerHTML = parentOptions;

        const tbody = document.querySelector('#sectorsTable tbody');
        tbody.innerHTML = '';

        sectors.forEach(s => {
            const tr = document.createElement('tr');
            
            let btnEdit = '';
            let btnDelete = '';

            if (s.is_default === 1) {
                // Setores padrões do sistema: Completamente bloqueados para editar ou excluir
                btnEdit = `<button class="btn btn-secondary" disabled title="Setores do sistema não podem ser editados" style="cursor:not-allowed; opacity:0.5;"><i class="fa-solid fa-lock"></i> Bloqueado</button>`;
                btnDelete = `<button class="btn btn-secondary" disabled title="Setores do sistema não podem ser excluídos" style="cursor:not-allowed; opacity:0.5;"><i class="fa-solid fa-lock"></i> Bloqueado</button>`;
            } else {
                // Setores criados pelo painel: Podem ser editados e excluídos (se não houver usuários vinculados)
                btnEdit = `<button class="btn btn-secondary" onclick="abrirModalEditarSetor(${s.id}, '${s.nome.replace(/'/g, "\\'")}', '${(s.descricao||'').replace(/'/g, "\\'")}', ${s.parent_id || 'null'})"><i class="fa-solid fa-pen-to-square"></i> Editar</button>`;
                
                btnDelete = s.user_count > 0 
                    ? `<button class="btn btn-secondary" disabled title="Não é possível excluir setores com usuários ativos" style="cursor:not-allowed; opacity:0.5;"><i class="fa-solid fa-lock"></i> Bloqueado</button>`
                    : `<button class="btn btn-danger" onclick="excluirSetorAPI(${s.id})"><i class="fa-solid fa-trash"></i> Excluir</button>`;
            }

            // Formatação visual da hierarquia de Subgrupos
            let setorColHtml = `<strong>🏷️ ${s.nome}</strong>`;
            if (s.parent_id) {
                setorColHtml = `<div style="padding-left: 16px;"><i class="fa-solid fa-arrow-turn-up" style="transform: rotate(90deg); color: var(--primary); margin-right: 6px;"></i> <strong>${s.nome}</strong> <span class="badge badge-info" style="font-size:10px;">Subgrupo</span></div>`;
            } else {
                setorColHtml = `<strong>🏷️ ${s.nome}</strong> <span class="badge badge-success" style="font-size:10px;">Grupo Principal</span>`;
            }

            const parentColHtml = s.parent_nome 
                ? `<span style="font-weight:600; color:#334155;"><i class="fa-solid fa-folder"></i> ${s.parent_nome}</span>`
                : `<span style="color:var(--text-muted); font-style:italic;">-</span>`;

            tr.innerHTML = `
                <td>${setorColHtml}</td>
                <td>${parentColHtml}</td>
                <td>${s.descricao || '<span style="color:var(--text-muted);font-style:italic;">Sem descrição</span>'}</td>
                <td><span class="badge ${s.user_count > 0 ? 'badge-success' : 'badge-info'}">${s.user_count} colaborador(es)</span></td>
                <td>
                    <div style="display:flex; gap: 8px;">
                        ${btnEdit}
                        ${btnDelete}
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error(e);
    }
}

// Criar Setor / Subgrupo
async function criarSetorAPI(e) {
    e.preventDefault();
    const nome = document.getElementById('setorNome').value.trim();
    const descricao = document.getElementById('setorDescricao').value.trim();
    const parentId = document.getElementById('setorParentSelect').value;

    try {
        const response = await fetch('/api/admin/create-sector', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                adminId: currentUser.id,
                nome: nome,
                descricao: descricao,
                parentId: parentId ? parseInt(parentId) : null
            })
        });

        const data = await response.json();

        if (response.ok) {
            alert('✅ Setor / Subgrupo criado com sucesso!');
            document.getElementById('setorForm').reset();
            carregarSectoresCompleto();
        } else {
            alert('Erro: ' + (data.error || 'Falha ao salvar setor.'));
        }
    } catch (e) {
        console.error(e);
    }
}

// Excluir Setor
async function excluirSetorAPI(sectorId) {
    if (!confirm('Deseja excluir permanentemente este setor / subgrupo?')) return;

    try {
        const response = await fetch('/api/admin/delete-sector', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                adminId: currentUser.id,
                sectorId: sectorId
            })
        });

        const data = await response.json();

        if (response.ok) {
            alert('Setor / Subgrupo excluído com sucesso!');
            carregarSectoresCompleto();
        } else {
            alert('Erro: ' + (data.error || 'Falha ao excluir setor.'));
        }
    } catch (e) {
        console.error(e);
    }
}

// Modal Editar Setor
function abrirModalEditarSetor(id, nome, descricao, parentId) {
    document.getElementById('editSectorId').value = id;
    document.getElementById('editSectorNome').value = nome;
    document.getElementById('editSectorDescricao').value = descricao;
    
    const parentSelect = document.getElementById('editSectorParentSelect');
    if (parentSelect) {
        parentSelect.value = parentId ? parentId.toString() : '';
    }
    
    document.getElementById('modalEditSector').classList.add('active');
}

function fecharModalEditSector() {
    document.getElementById('modalEditSector').classList.remove('active');
}

async function confirmarEditarSetor() {
    const id = document.getElementById('editSectorId').value;
    const nome = document.getElementById('editSectorNome').value.trim();
    const descricao = document.getElementById('editSectorDescricao').value.trim();
    const parentId = document.getElementById('editSectorParentSelect').value;

    if (!nome) return alert('O nome do setor é obrigatório.');

    try {
        const response = await fetch('/api/admin/edit-sector', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                adminId: currentUser.id,
                sectorId: id,
                nome: nome,
                descricao: descricao,
                parentId: parentId ? parseInt(parentId) : null
            })
        });

        const data = await response.json();

        if (response.ok) {
            alert('✅ Setor / Subgrupo atualizado com sucesso!');
            fecharModalEditSector();
            carregarSectoresCompleto();
        } else {
            alert('Erro: ' + (data.error || 'Falha ao atualizar setor.'));
        }
    } catch (e) {
        console.error(e);
    }
}

// Reativar Colaborador Inativo
async function reativarColaborador(targetId) {
    if (!confirm('Deseja reativar o acesso deste colaborador no NeuroChat?')) return;

    try {
        const response = await fetch('/api/admin/restore-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                adminId: currentUser.id,
                targetUserId: targetId
            })
        });

        if (response.ok) {
            alert('✅ Colaborador reativado com sucesso!');
            carregarUsuarios();
        }
    } catch (e) {
        console.error(e);
    }
}

// Download do backup completo em formato SQL (.sql)
function baixarBackupBanco() {
    if (!confirm('Deseja iniciar o download do backup completo do banco de dados (.sql)?\nIsso salvará todos os históricos, grupos e usuários.')) return;
    window.open(`/api/admin/backup?adminId=${currentUser.id}`);
}

// KPI Dashboard: Clique para filtrar usuários
function verUsuariosFiltrados(status) {
    switchTab('users');
    const filter = document.getElementById('userStatusFilter');
    if (filter) {
        filter.value = status;
        filtrarUsuariosTabela(status);
    }
}
