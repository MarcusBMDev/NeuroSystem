-- SQL Script para Adicionar os Setores Restantes da Clínica no neurochat_db
-- Garante compatibilidade 100% com regras de outros sistemas (ex: Terapeutas% em Rails, marketing em SolicitaMkt)

INSERT IGNORE INTO neurochat_db.setores (nome, descricao) VALUES
('Terapeutas - Unidade 1', 'Equipe terapêutica e clínica da Unidade 1'),
('Terapeutas - Unidade 2', 'Equipe terapêutica e clínica da Unidade 2'),
('Terapeutas - Unidade 3', 'Equipe terapêutica e clínica da Unidade 3'),
('ABA', 'Equipe de profissionais de ABA (Análise do Comportamento Aplicada)'),
('Diretoria Pedagógica', 'Diretoria e coordenação pedagógica da clínica'),
('Apoio AVN - Unidade 3', 'Equipe de apoio e assistentes AVN Unidade 3'),
('Apoio Pedagógico', 'Equipe de apoio pedagógico'),
('ASG - UNIDADE 1', 'Serviços gerais e ASG Unidade 1'),
('RH', 'Departamento de Recursos Humanos (NeuroGente)'),
('Assessoria', 'Assessoria executiva e de gestão'),
('Relacionamento e Comercial', 'Equipe de recepção comercial e relacionamento'),
('Marketing', 'Equipe de marketing e publicidade (SolicitaMkt)');

-- Atualiza setor_id para os usuários dos novos setores cadastrados
UPDATE neurochat_db.users u
SET u.setor_id = (
    SELECT id 
    FROM neurochat_db.setores 
    WHERE LOWER(TRIM(nome)) = LOWER(TRIM(u.department)) 
       OR (LOWER(TRIM(u.department)) LIKE 'terapeutas%1' AND nome = 'Terapeutas - Unidade 1')
       OR (LOWER(TRIM(u.department)) LIKE 'terapeutas%2' AND nome = 'Terapeutas - Unidade 2')
       OR (LOWER(TRIM(u.department)) LIKE 'terapeutas%3' AND nome = 'Terapeutas - Unidade 3')
       OR (LOWER(TRIM(u.department)) LIKE 'recep%o%1' AND nome = 'Recepção Unidade 1')
       OR (LOWER(TRIM(u.department)) LIKE 'recep%o%2' AND nome = 'Recepção Unidade 2')
       OR (LOWER(TRIM(u.department)) LIKE 'recep%o%3' AND nome = 'Recepção Unidade 3')
    LIMIT 1
)
WHERE u.setor_id IS NULL;
