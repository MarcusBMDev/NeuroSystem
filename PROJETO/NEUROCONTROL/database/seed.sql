-- Seed data para preencher a tabela de valores por plano e especialidade no NeuroControl
-- Usando os IDs reais detectados na tabela convenios

INSERT INTO neurocontrol_tabela_valores (convenio_id, especialidade, codigo_tuss, valor_sessao) VALUES
-- Bradesco (436)
(436, 'Psicologia', '50000470', 180.00),
(436, 'Fonoaudiologia', '50000461', 180.00),
(436, 'Terapia Ocupacional', '50000488', 190.00),
(436, 'Fisioterapia', '50000452', 180.00),

-- GEAP (438)
(438, 'Psicologia', '50000470', 150.00),
(438, 'Fonoaudiologia', '50000461', 150.00),
(438, 'Terapia Ocupacional', '50000488', 160.00),

-- Cassi (439)
(439, 'Psicologia', '50000470', 200.00),
(439, 'Fonoaudiologia', '50000461', 200.00),
(439, 'Terapia Ocupacional', '50000488', 210.00),

-- Servir (441)
(441, 'Psicologia', '50000470', 140.00),
(441, 'Fonoaudiologia', '50000461', 140.00),
(441, 'Terapia Ocupacional', '50000488', 150.00),

-- Unimed Palmas (444)
(444, 'Psicologia', '50000470', 160.00),
(444, 'Fonoaudiologia', '50000461', 160.00),
(444, 'Terapia Ocupacional', '50000488', 175.00),

-- Sul América (445)
(445, 'Psicologia', '50000470', 210.00),
(445, 'Fonoaudiologia', '50000461', 210.00),
(445, 'Terapia Ocupacional', '50000488', 220.00),

-- Best Saúde (446)
(446, 'Psicologia', '50000470', 150.00),
(446, 'Fonoaudiologia', '50000461', 150.00),

-- Mediservice (448)
(448, 'Psicologia', '50000470', 180.00),
(448, 'Fonoaudiologia', '50000461', 180.00),
(448, 'Terapia Ocupacional', '50000488', 190.00),

-- TRE (454)
(454, 'Psicologia', '50000470', 170.00),

-- Unimed Seguros (455)
(455, 'Psicologia', '50000470', 180.00),

-- FA - Saúde (460)
(460, 'Psicologia', '50000470', 160.00),

-- Pró - Social (461)
(461, 'Psicologia', '50000470', 180.00)
ON DUPLICATE KEY UPDATE valor_sessao = VALUES(valor_sessao);
