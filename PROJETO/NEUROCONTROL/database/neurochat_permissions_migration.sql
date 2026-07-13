-- 1. Remoção das tabelas criadas anteriormente em agendamentos_clinica_dev para não deixar lixo
DROP TABLE IF EXISTS agendamentos_clinica_dev.neurocontrol_setores_permissoes;
DROP TABLE IF EXISTS agendamentos_clinica_dev.neurocontrol_setores;
DROP TABLE IF EXISTS agendamentos_clinica_dev.neurocontrol_permissoes;

-- 2. Criação das tabelas de Setores e Permissões diretamente no banco neurochat_db
CREATE TABLE IF NOT EXISTS neurochat_db.setores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) UNIQUE NOT NULL,
    descricao VARCHAR(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS neurochat_db.permissoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) UNIQUE NOT NULL,
    descricao VARCHAR(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS neurochat_db.setores_permissoes (
    setor_id INT NOT NULL,
    permissao_id INT NOT NULL,
    PRIMARY KEY (setor_id, permissao_id),
    FOREIGN KEY (setor_id) REFERENCES neurochat_db.setores(id) ON DELETE CASCADE,
    FOREIGN KEY (permissao_id) REFERENCES neurochat_db.permissoes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 3. Adiciona a coluna setor_id na tabela users do neurochat_db (se ela não existir)
-- Nota: Usando um bloco ou comando direto. Como em algumas versões do MySQL o "IF NOT EXISTS" no ALTER TABLE não é suportado,
-- nós rodamos de forma segura. Se a coluna já existir, ele apenas ignora.
SET @dbname = 'neurochat_db';
SET @tablename = 'users';
SET @columnname = 'setor_id';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_schema = @dbname 
     AND table_name = @tablename 
     AND column_name = @columnname) > 0,
  'SELECT 1',
  'ALTER TABLE neurochat_db.users ADD COLUMN setor_id INT DEFAULT NULL, ADD CONSTRAINT fk_users_setores FOREIGN KEY (setor_id) REFERENCES neurochat_db.setores(id) ON DELETE SET NULL'
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Limpeza e Recarga dos Setores e Permissões no neurochat_db
DELETE FROM neurochat_db.setores_permissoes;
DELETE FROM neurochat_db.setores;
DELETE FROM neurochat_db.permissoes;

INSERT INTO neurochat_db.setores (id, nome, descricao) VALUES
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

INSERT INTO neurochat_db.permissoes (id, nome, descricao) VALUES
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

-- Mapeia Permissões no neurochat_db

-- Diretoria Geral (Acesso Completo)
INSERT INTO neurochat_db.setores_permissoes (setor_id, permissao_id)
SELECT 1, id FROM neurochat_db.permissoes;

-- Diretoria Financeira e Controle Interno (Acesso Completo)
INSERT INTO neurochat_db.setores_permissoes (setor_id, permissao_id)
SELECT 11, id FROM neurochat_db.permissoes;

-- Coordenação Faturamento e Solicitação
INSERT INTO neurochat_db.setores_permissoes (setor_id, permissao_id) VALUES
(2, 1), (2, 2), (2, 3), (2, 10), (2, 11);

-- Faturamento
INSERT INTO neurochat_db.setores_permissoes (setor_id, permissao_id) VALUES
(3, 1), (3, 2), (3, 10);

-- Solicitação
INSERT INTO neurochat_db.setores_permissoes (setor_id, permissao_id) VALUES
(4, 3), (4, 10);

-- Coordenação de agendamento e recepção
INSERT INTO neurochat_db.setores_permissoes (setor_id, permissao_id) VALUES
(5, 4), (5, 7), (5, 8), (5, 9), (5, 10);

-- Recepção Unidade 1, 2 e 3
INSERT INTO neurochat_db.setores_permissoes (setor_id, permissao_id) VALUES
(6, 7), (6, 8), (6, 9),
(7, 7), (7, 8), (7, 9),
(8, 7), (8, 8), (8, 9);

-- Supervisão recepção
INSERT INTO neurochat_db.setores_permissoes (setor_id, permissao_id) VALUES
(9, 7), (9, 8), (9, 9), (9, 10);

-- Agendamento
INSERT INTO neurochat_db.setores_permissoes (setor_id, permissao_id) VALUES
(10, 4), (10, 10);

-- Financeiro
INSERT INTO neurochat_db.setores_permissoes (setor_id, permissao_id) VALUES
(12, 1), (12, 10), (12, 11);

-- Controle interno
INSERT INTO neurochat_db.setores_permissoes (setor_id, permissao_id) VALUES
(13, 5), (13, 6), (13, 7), (13, 10);

-- 5. Atualiza os usuários existentes, vinculando-os ao setor correspondente baseado no departamento em texto
UPDATE neurochat_db.users u
SET u.setor_id = (
    SELECT id 
    FROM neurochat_db.setores 
    WHERE LOWER(TRIM(nome)) = LOWER(TRIM(u.department)) 
       OR (LOWER(TRIM(u.department)) LIKE 'recep%o 1' AND nome = 'Recepção Unidade 1')
       OR (LOWER(TRIM(u.department)) LIKE 'recep%o 2' AND nome = 'Recepção Unidade 2')
       OR (LOWER(TRIM(u.department)) LIKE 'recep%o 3' AND nome = 'Recepção Unidade 3')
       OR (LOWER(TRIM(u.department)) LIKE 'faturamento%' AND nome = 'Faturamento')
       OR (LOWER(TRIM(u.department)) LIKE 'coordena%o faturamento%' AND nome = 'Coordenação Faturamento e Solicitação')
       OR (LOWER(TRIM(u.department)) LIKE 'coordena%o agendamento/recep%o%' AND nome = 'Coordenação de agendamento e recepção')
       OR (LOWER(TRIM(u.department)) LIKE 'diretoria financeira%' AND nome = 'Diretoria financeira e de controle interno')
       OR (LOWER(TRIM(u.department)) LIKE 'coordena%o operacional%' AND nome = 'Coordenação Faturamento e Solicitação')
       OR (LOWER(TRIM(u.department)) LIKE 'controle interno' AND nome = 'Controle interno')
    LIMIT 1
);
