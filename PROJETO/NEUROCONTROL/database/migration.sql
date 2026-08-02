-- Script de Migração para Criação das Tabelas do NeuroControl no banco agendamentos_clinica_dev

CREATE TABLE IF NOT EXISTS neurocontrol_tabela_valores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    convenio_id BIGINT NOT NULL,
    especialidade VARCHAR(255) NOT NULL,
    codigo_tuss VARCHAR(50) NOT NULL,
    valor_sessao DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (convenio_id) REFERENCES convenios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS neurocontrol_negociacoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    paciente_id BIGINT NOT NULL,
    profissional_id BIGINT DEFAULT NULL,
    valor_diferenciado DECIMAL(10,2) NOT NULL,
    tipo_negocio VARCHAR(50) NOT NULL, -- 'liminar', 'acordo_particular'
    observacoes TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
    FOREIGN KEY (profissional_id) REFERENCES profissionais(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS neurocontrol_guias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    paciente_id BIGINT NOT NULL,
    guia_numero VARCHAR(100) NOT NULL UNIQUE,
    quantidade_autorizada INT NOT NULL,
    previsao_calculada INT DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'aguardando_agendamento', -- 'aguardando_agendamento', 'p_assinar', 'p_faturar', 'finalizado', 'inconsistente'
    mes_vigente VARCHAR(7) NOT NULL, -- 'YYYY-MM' (ex: '2026-07')
    terapia VARCHAR(100) NOT NULL, -- 'Psico', 'Fono', 'TO', 'Fisio'
    data_pedido DATE NOT NULL, -- Para validação de vencimento do pedido médico
    data_liberacao DATETIME DEFAULT NULL,
    data_entrada_ci DATETIME DEFAULT NULL,
    observacao_inconsistencia TEXT DEFAULT NULL,
    assinatura_pendente_flag TINYINT(1) DEFAULT 0,
    criado_por VARCHAR(100) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS neurocontrol_assinaturas_sessoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guia_id INT NOT NULL,
    data_sessao DATE NOT NULL,
    horario VARCHAR(50) DEFAULT NULL,
    status_assinatura VARCHAR(20) NOT NULL DEFAULT 'pendente', -- 'pendente', 'assinada'
    data_assinatura DATETIME DEFAULT NULL,
    created_by_user_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (guia_id) REFERENCES neurocontrol_guias(id) ON DELETE CASCADE,
    UNIQUE KEY uq_guia_sessao (guia_id, data_sessao)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS neurocontrol_protocolos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    protocolo_numero VARCHAR(50) NOT NULL UNIQUE, -- ex: '#0045'
    emissor_nome VARCHAR(100) NOT NULL,
    data_emissao DATETIME NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pendente', -- 'pendente', 'recebido', 'inconsistente'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS neurocontrol_protocolo_itens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    protocolo_id INT NOT NULL,
    guia_id INT NOT NULL,
    status_item VARCHAR(20) NOT NULL DEFAULT 'pendente', -- 'pendente', 'aceito', 'inconsistente'
    observacao TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (protocolo_id) REFERENCES neurocontrol_protocolos(id) ON DELETE CASCADE,
    FOREIGN KEY (guia_id) REFERENCES neurocontrol_guias(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Adição de novas colunas para regras de negócio do NeuroControl
ALTER TABLE neurocontrol_guias ADD COLUMN data_validade DATE DEFAULT NULL;
ALTER TABLE neurocontrol_assinaturas_sessoes ADD COLUMN token_autorizacao VARCHAR(50) DEFAULT NULL;

