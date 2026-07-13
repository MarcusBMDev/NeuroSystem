-- SQL Migration para Tabelas de Setores e Permissões do NeuroControl

-- 1. Criação das tabelas
CREATE TABLE IF NOT EXISTS neurocontrol_setores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) UNIQUE NOT NULL,
    descricao VARCHAR(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS neurocontrol_permissoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) UNIQUE NOT NULL,
    descricao VARCHAR(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS neurocontrol_setores_permissoes (
    setor_id INT NOT NULL,
    permissao_id INT NOT NULL,
    PRIMARY KEY (setor_id, permissao_id),
    FOREIGN KEY (setor_id) REFERENCES neurocontrol_setores(id) ON DELETE CASCADE,
    FOREIGN KEY (permissao_id) REFERENCES neurocontrol_permissoes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 2. Limpeza opcional para evitar duplicados em inserções repetidas
DELETE FROM neurocontrol_setores_permissoes;
DELETE FROM neurocontrol_setores;
DELETE FROM neurocontrol_permissoes;

-- 3. Inserção dos Setores Reais da clínica
INSERT INTO neurocontrol_setores (id, nome, descricao) VALUES
(1, 'Diretoria geral', 'Acesso irrestrito a todos os painéis e relatórios'),
(2, 'Coordenação Faturamento e Solicitação', 'Responsável operacional pela equipe de faturamento e emissões'),
(3, 'Faturamento', 'Analistas responsáveis por conferência final e digitação nos planos'),
(4, 'Solicitação', 'Operadores que cadastram guias autorizadas e verificam SLA'),
(5, 'Coordenação de agendamento e recepção', 'Coordena as secretárias e marcações'),
(6, 'Recepção Unidade 1', 'Recepção e recepção física de pacientes Unidade 1'),
(7, 'Recepção Unidade 2', 'Recepção e recepção física de pacientes Unidade 2'),
(8, 'Recepção Unidade 3', 'Recepção e recepção física de pacientes Unidade 3'),
(9, 'Supervisão recepção', 'Supervisora operacional da recepção e secretárias'),
(10, 'Agendamento', 'Camila, Bruno e Petrônio - Responsáveis por agendas e protocolos'),
(11, 'Diretoria financeira e de controle interno', 'Gestão estratégica de custos, receitas e auditoria de guias'),
(12, 'Financeiro', 'Gestão de tabela de preços e negociações directas'),
(13, 'Controle interno', 'Auditoria física e sistêmica de guias do CI (Talita/Natan)');

-- 4. Inserção das Permissões de Acesso
INSERT INTO neurocontrol_permissoes (id, nome, descricao) VALUES
(1, 'ver_painel_geral', 'Visualizar o dashboard de faturamento e KPIs'),
(2, 'faturar_guias', 'Aprovar e alterar status final de guias para faturado'),
(3, 'cadastrar_guias', 'Acessar tela de cadastro de novas guias e conferir previsões'),
(4, 'gerar_protocolos', 'Visualizar checklist e emitir protocolos digitais para o CI'),
(5, 'auditar_protocolos', 'Aceitar ou rejeitar guias físicas enviadas via protocolo no CI'),
(6, 'override_assinaturas', 'Liberar guias para faturamento sem assinatura (Bypass CI)'),
(7, 'visualizar_risco', 'Visualizar tabela de risco diário (Hoje)'),
(8, 'assinar_sessoes', 'Registrar presença física e assinatura de guias do dia na recepção'),
(9, 'sinalizar_problemas', 'Gerar alertas urgentes de falha/falta de guia para o CI'),
(10, 'ver_profissionais', 'Acessar e visualizar tela de produtividade de profissionais'),
(11, 'gerenciar_valores', 'Configurar tabelas de preços de planos e acordos de pacientes');

-- 5. Associação de Permissões aos Setores (Mapeamento Funcional)

-- Diretoria Geral (Acesso Completo)
INSERT INTO neurocontrol_setores_permissoes (setor_id, permissao_id)
SELECT 1, id FROM neurocontrol_permissoes;

-- Diretoria Financeira e Controle Interno (Acesso Completo)
INSERT INTO neurocontrol_setores_permissoes (setor_id, permissao_id)
SELECT 11, id FROM neurocontrol_permissoes;

-- Coordenação Faturamento e Solicitação
INSERT INTO neurocontrol_setores_permissoes (setor_id, permissao_id) VALUES
(2, 1), -- ver_painel_geral
(2, 2), -- faturar_guias
(2, 3), -- cadastrar_guias
(2, 10), -- ver_profissionais
(2, 11); -- gerenciar_valores

-- Faturamento
INSERT INTO neurocontrol_setores_permissoes (setor_id, permissao_id) VALUES
(3, 1), -- ver_painel_geral
(3, 2), -- faturar_guias
(3, 10); -- ver_profissionais

-- Solicitação
INSERT INTO neurocontrol_setores_permissoes (setor_id, permissao_id) VALUES
(4, 3), -- cadastrar_guias
(4, 10); -- ver_profissionais

-- Coordenação de agendamento e recepção
INSERT INTO neurocontrol_setores_permissoes (setor_id, permissao_id) VALUES
(5, 4), -- gerar_protocolos
(5, 7), -- visualizar_risco
(5, 8), -- assinar_sessoes
(5, 9), -- sinalizar_problemas
(5, 10); -- ver_profissionais

-- Recepção Unidades 1, 2 e 3
INSERT INTO neurocontrol_setores_permissoes (setor_id, permissao_id) VALUES
(6, 7), (6, 8), (6, 9),
(7, 7), (7, 8), (7, 9),
(8, 7), (8, 8), (8, 9);

-- Supervisão recepção
INSERT INTO neurocontrol_setores_permissoes (setor_id, permissao_id) VALUES
(9, 7), -- visualizar_risco
(9, 8), -- assinar_sessoes
(9, 9), -- sinalizar_problemas
(9, 10); -- ver_profissionais

-- Agendamento
INSERT INTO neurocontrol_setores_permissoes (setor_id, permissao_id) VALUES
(10, 4), -- gerar_protocolos
(10, 10); -- ver_profissionais

-- Financeiro
INSERT INTO neurocontrol_setores_permissoes (setor_id, permissao_id) VALUES
(12, 1), -- ver_painel_geral
(12, 10), -- ver_profissionais
(12, 11); -- gerenciar_valores

-- Controle interno
INSERT INTO neurocontrol_setores_permissoes (setor_id, permissao_id) VALUES
(13, 5), -- auditar_protocolos
(13, 6), -- override_assinaturas
(13, 7), -- visualizar_risco
(13, 10); -- ver_profissionais
