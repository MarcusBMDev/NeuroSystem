# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_07_24_120000) do
  create_table "active_storage_attachments", charset: "utf8mb4", collation: "utf8mb4_general_ci", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.bigint "record_id", null: false
    t.string "record_type", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", charset: "utf8mb4", collation: "utf8mb4_general_ci", force: :cascade do |t|
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.string "content_type"
    t.datetime "created_at", null: false
    t.string "filename", null: false
    t.string "key", null: false
    t.text "metadata"
    t.string "service_name", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", charset: "utf8mb4", collation: "utf8mb4_general_ci", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "agendamentos", charset: "utf8mb4", collation: "utf8mb4_general_ci", force: :cascade do |t|
    t.string "atualizado_por"
    t.string "bloqueado_por"
    t.integer "bloqueado_por_id"
    t.bigint "convenio_id"
    t.string "cor"
    t.datetime "created_at", null: false
    t.date "data_encaixe"
    t.string "dia_semana"
    t.boolean "encaixe", default: false
    t.string "horario"
    t.bigint "lista_espera_id"
    t.text "motivo_bloqueio"
    t.text "observacoes"
    t.bigint "paciente_id"
    t.bigint "profissional_id", null: false
    t.string "status", default: "confirmado"
    t.boolean "terapia_grupo", default: false
    t.datetime "updated_at", null: false
    t.index ["convenio_id"], name: "index_agendamentos_on_convenio_id"
    t.index ["lista_espera_id"], name: "index_agendamentos_on_lista_espera_id"
    t.index ["paciente_id"], name: "index_agendamentos_on_paciente_id"
    t.index ["profissional_id", "dia_semana", "horario"], name: "idx_agendamentos_busca"
    t.index ["profissional_id"], name: "index_agendamentos_on_profissional_id"
    t.index ["status"], name: "index_agendamentos_on_status"
  end

  create_table "auditoria", id: :integer, charset: "utf8mb4", collation: "utf8mb4_general_ci", force: :cascade do |t|
    t.string "action"
    t.datetime "created_at", precision: nil
    t.text "details"
    t.string "ip_address", limit: 45
    t.integer "record_id"
    t.string "record_type"
    t.string "user_agent"
    t.integer "user_id"
  end

  create_table "auditorias", charset: "utf8mb4", collation: "utf8mb4_general_ci", force: :cascade do |t|
    t.string "acao"
    t.datetime "created_at", null: false
    t.text "detalhes"
    t.integer "entidade_id"
    t.string "entidade_tipo"
    t.string "ip_address"
    t.string "setor"
    t.datetime "updated_at", null: false
    t.integer "user_id"
    t.string "user_name"
    t.index ["acao"], name: "index_auditorias_on_acao"
    t.index ["created_at"], name: "index_auditorias_on_created_at"
    t.index ["entidade_tipo", "entidade_id"], name: "index_auditorias_on_entidade_tipo_and_entidade_id"
    t.index ["user_id"], name: "index_auditorias_on_user_id"
  end

  create_table "convenios", charset: "utf8mb4", collation: "utf8mb4_general_ci", force: :cascade do |t|
    t.boolean "ativo"
    t.datetime "created_at", null: false
    t.text "especialidades_atendidas"
    t.text "exigencias"
    t.string "nome"
    t.datetime "updated_at", null: false
  end

  create_table "especialidades", charset: "utf8mb4", collation: "utf8mb4_general_ci", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "nome", null: false
    t.datetime "updated_at", null: false
    t.index ["nome"], name: "index_especialidades_on_nome", unique: true
  end

  create_table "lista_espera", charset: "utf8mb4", collation: "utf8mb4_general_ci", force: :cascade do |t|
    t.integer "age"
    t.date "birth_date"
    t.datetime "created_at", null: false
    t.string "especialidade"
    t.string "nome"
    t.text "observacao"
    t.bigint "paciente_id"
    t.text "planned_specialties"
    t.string "status", default: "aguardando"
    t.string "telefone"
    t.datetime "updated_at", null: false
    t.index ["paciente_id"], name: "index_lista_espera_on_paciente_id"
  end

  create_table "neurocontrol_alertas", id: :integer, charset: "utf8mb4", collation: "utf8mb4_general_ci", force: :cascade do |t|
    t.timestamp "created_at", default: -> { "current_timestamp()" }, null: false
    t.string "mensagem", null: false
    t.bigint "paciente_id", null: false
    t.boolean "resolvido", default: false
    t.index ["paciente_id"], name: "paciente_id"
  end

  create_table "neurocontrol_assinaturas_sessoes", id: :integer, charset: "utf8mb4", collation: "utf8mb4_general_ci", force: :cascade do |t|
    t.timestamp "created_at", default: -> { "current_timestamp()" }, null: false
    t.integer "created_by_user_id"
    t.datetime "data_assinatura", precision: nil
    t.date "data_sessao", null: false
    t.integer "guia_id", null: false
    t.string "horario", limit: 50
    t.string "status_assinatura", limit: 20, default: "pendente", null: false
    t.timestamp "updated_at", default: -> { "current_timestamp() ON UPDATE current_timestamp()" }, null: false
    t.index ["guia_id", "data_sessao"], name: "uq_guia_sessao", unique: true
  end

  create_table "neurocontrol_guias", id: :integer, charset: "utf8mb4", collation: "utf8mb4_general_ci", force: :cascade do |t|
    t.boolean "assinatura_pendente_flag", default: false
    t.timestamp "created_at", default: -> { "current_timestamp()" }, null: false
    t.string "criado_por", limit: 100
    t.datetime "data_entrada_ci", precision: nil
    t.datetime "data_liberacao", precision: nil
    t.date "data_pedido", null: false
    t.string "guia_numero", limit: 100, null: false
    t.string "mes_vigente", limit: 7, null: false
    t.text "observacao_inconsistencia"
    t.bigint "paciente_id", null: false
    t.integer "previsao_calculada", default: 0
    t.integer "quantidade_autorizada", null: false
    t.string "status", limit: 50, default: "aguardando_agendamento", null: false
    t.string "terapia", limit: 100, null: false
    t.timestamp "updated_at", default: -> { "current_timestamp() ON UPDATE current_timestamp()" }, null: false
    t.index ["guia_numero"], name: "guia_numero", unique: true
    t.index ["paciente_id"], name: "paciente_id"
  end

  create_table "neurocontrol_negociacoes", id: :integer, charset: "utf8mb4", collation: "utf8mb4_general_ci", force: :cascade do |t|
    t.timestamp "created_at", default: -> { "current_timestamp()" }, null: false
    t.text "observacoes"
    t.bigint "paciente_id", null: false
    t.bigint "profissional_id"
    t.string "tipo_negocio", limit: 50, null: false
    t.timestamp "updated_at", default: -> { "current_timestamp() ON UPDATE current_timestamp()" }, null: false
    t.decimal "valor_diferenciado", precision: 10, scale: 2, null: false
    t.index ["paciente_id"], name: "paciente_id"
    t.index ["profissional_id"], name: "profissional_id"
  end

  create_table "neurocontrol_protocolo_itens", id: :integer, charset: "utf8mb4", collation: "utf8mb4_general_ci", force: :cascade do |t|
    t.timestamp "created_at", default: -> { "current_timestamp()" }, null: false
    t.integer "guia_id", null: false
    t.text "observacao"
    t.integer "protocolo_id", null: false
    t.string "status_item", limit: 20, default: "pendente", null: false
    t.index ["guia_id"], name: "guia_id"
    t.index ["protocolo_id"], name: "protocolo_id"
  end

  create_table "neurocontrol_protocolos", id: :integer, charset: "utf8mb4", collation: "utf8mb4_general_ci", force: :cascade do |t|
    t.timestamp "created_at", default: -> { "current_timestamp()" }, null: false
    t.datetime "data_emissao", precision: nil, null: false
    t.string "emissor_nome", limit: 100, null: false
    t.string "protocolo_numero", limit: 50, null: false
    t.string "status", limit: 20, default: "pendente", null: false
    t.index ["protocolo_numero"], name: "protocolo_numero", unique: true
  end

  create_table "neurocontrol_tabela_valores", id: :integer, charset: "utf8mb4", collation: "utf8mb4_general_ci", force: :cascade do |t|
    t.string "codigo_tuss", limit: 50, null: false
    t.bigint "convenio_id", null: false
    t.timestamp "created_at", default: -> { "current_timestamp()" }, null: false
    t.string "especialidade", null: false
    t.timestamp "updated_at", default: -> { "current_timestamp() ON UPDATE current_timestamp()" }, null: false
    t.decimal "valor_sessao", precision: 10, scale: 2, null: false
    t.index ["convenio_id"], name: "convenio_id"
  end

  create_table "pacientes", charset: "utf8mb4", collation: "utf8mb4_general_ci", force: :cascade do |t|
    t.integer "age"
    t.date "birth_date"
    t.integer "convenio_id"
    t.datetime "created_at", null: false
    t.datetime "deleted_at"
    t.string "nome"
    t.text "planned_specialties"
    t.string "status"
    t.datetime "updated_at", null: false
    t.boolean "vip", default: false
    t.integer "weekly_frequency"
    t.index ["nome"], name: "index_pacientes_on_nome", unique: true
  end

  create_table "profissionais", charset: "utf8mb4", collation: "utf8mb4_general_ci", force: :cascade do |t|
    t.boolean "ativo", default: true
    t.datetime "created_at", null: false
    t.string "especialidade"
    t.integer "max_age"
    t.integer "min_age"
    t.string "nome"
    t.string "sala", limit: 100, default: "Sala 01"
    t.string "unidade", limit: 100, default: "Unidade 1"
    t.datetime "updated_at", null: false
  end

  create_table "solicitantes", charset: "utf8mb4", collation: "utf8mb4_general_ci", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "nome"
    t.datetime "updated_at", null: false
  end

  create_table "transferencias", charset: "utf8mb4", collation: "utf8mb4_general_ci", force: :cascade do |t|
    t.text "agendamento_ids"
    t.bigint "agendamento_origem_id"
    t.datetime "created_at", null: false
    t.bigint "de_profissional_id"
    t.boolean "encaixe"
    t.text "motivo"
    t.string "novo_dia_semana"
    t.string "novo_horario"
    t.bigint "paciente_id", null: false
    t.bigint "para_profissional_id"
    t.string "solicitante"
    t.string "status", default: "pendente"
    t.integer "tipo", default: 0
    t.datetime "updated_at", null: false
    t.index ["de_profissional_id"], name: "index_transferencias_on_de_profissional_id"
    t.index ["paciente_id"], name: "index_transferencias_on_paciente_id"
    t.index ["para_profissional_id"], name: "index_transferencias_on_para_profissional_id"
  end

  create_table "users", charset: "utf8mb4", collation: "utf8mb4_general_ci", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "department"
    t.boolean "is_super_admin"
    t.string "nome"
    t.string "password"
    t.string "status"
    t.datetime "updated_at", null: false
    t.string "username"
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "agendamentos", "convenios", name: "fk_agendamentos_convenios"
  add_foreign_key "agendamentos", "pacientes", name: "fk_agendamentos_pacientes"
  add_foreign_key "agendamentos", "profissionais", name: "fk_agendamentos_profissionais"
  add_foreign_key "neurocontrol_alertas", "pacientes", name: "neurocontrol_alertas_ibfk_1", on_delete: :cascade
  add_foreign_key "neurocontrol_assinaturas_sessoes", "neurocontrol_guias", column: "guia_id", name: "neurocontrol_assinaturas_sessoes_ibfk_1", on_delete: :cascade
  add_foreign_key "neurocontrol_guias", "pacientes", name: "neurocontrol_guias_ibfk_1", on_delete: :cascade
  add_foreign_key "neurocontrol_negociacoes", "pacientes", name: "neurocontrol_negociacoes_ibfk_1", on_delete: :cascade
  add_foreign_key "neurocontrol_negociacoes", "profissionais", name: "neurocontrol_negociacoes_ibfk_2", on_delete: :nullify
  add_foreign_key "neurocontrol_protocolo_itens", "neurocontrol_guias", column: "guia_id", name: "neurocontrol_protocolo_itens_ibfk_2", on_delete: :cascade
  add_foreign_key "neurocontrol_protocolo_itens", "neurocontrol_protocolos", column: "protocolo_id", name: "neurocontrol_protocolo_itens_ibfk_1", on_delete: :cascade
  add_foreign_key "neurocontrol_tabela_valores", "convenios", name: "neurocontrol_tabela_valores_ibfk_1", on_delete: :cascade
  add_foreign_key "transferencias", "pacientes", name: "fk_transferencias_pacientes"
  add_foreign_key "transferencias", "profissionais", column: "de_profissional_id", name: "fk_transferencias_de_profissional"
  add_foreign_key "transferencias", "profissionais", column: "para_profissional_id", name: "fk_transferencias_para_profissional"
end
