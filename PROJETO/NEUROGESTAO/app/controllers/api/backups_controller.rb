require 'open3'

class Api::BackupsController < ApplicationController
  before_action :validar_usuario_logado!
  before_action :validar_admin!

  # GET /api/admin/backup
  def download
    db_name = 'agendamentos_clinica_dev'
    filename = "backup_#{db_name}_#{Time.current.strftime('%Y%m%d_%H%M%S')}.sql"

    sql_content = nil

    # 1. Tenta executar mysqldump se a ferramenta estiver disponível no sistema
    begin
      db_config = ActiveRecord::Base.connection_db_config.configuration_hash
      host = db_config[:host] || '127.0.0.1'
      user = db_config[:username] || 'root'
      pass = db_config[:password].to_s

      pass_arg = pass.present? ? "-p#{pass}" : ""
      cmd = "mysqldump -h #{host} -u #{user} #{pass_arg} #{db_name}"
      stdout_str, _stderr_str, status = Open3.capture3(cmd)
      if status.success? && stdout_str.present? && stdout_str.length > 100
        sql_content = stdout_str
      end
    rescue => e
      Rails.logger.warn "mysqldump indisponível ou falhou: #{e.message}. Usando dumper nativo Ruby."
    end

    # 2. Fallback nativo em Ruby/ActiveRecord se o mysqldump não funcionou
    if sql_content.blank?
      sql_content = gerar_backup_ruby(db_name)
    end

    registrar_auditoria('DOWNLOAD_BACKUP', "Backup do banco #{db_name} baixado pelo Administrador (ID: #{request.headers['X-User-Id']})")

    send_data sql_content,
              filename: filename,
              type: 'application/sql; charset=utf-8',
              disposition: 'attachment'
  end

  private

  def gerar_backup_ruby(db_name)
    conn = ActiveRecord::Base.connection
    sql = []
    sql << "-- ========================================================"
    sql << "-- BACKUP COMPLETO DO BANCO DE DADOS: #{db_name}"
    sql << "-- Data de Geração: #{Time.current.strftime('%Y-%m-%d %H:%M:%S')}"
    sql << "-- ========================================================\n"
    sql << "SET FOREIGN_KEY_CHECKS=0;\n"
    sql << "SET NAMES utf8mb4;\n"

    tables = conn.tables
    tables.each do |table|
      next if table == 'schema_migrations' || table == 'ar_internal_metadata'

      # Estrutura DDL da Tabela
      create_table_res = conn.execute("SHOW CREATE TABLE `#{table}`").first
      create_sql = create_table_res.is_a?(Array) ? create_table_res[1] : create_table_res['Create Table']

      sql << "\n-- --------------------------------------------------------"
      sql << "-- Estrutura da tabela `#{table}`"
      sql << "-- --------------------------------------------------------"
      sql << "DROP TABLE IF EXISTS `#{table}`;"
      sql << "#{create_sql};\n"

      # Dados da Tabela
      rows = conn.execute("SELECT * FROM `#{table}`")
      cols = conn.columns(table).map { |c| "`#{c.name}`" }.join(", ")

      unless rows.empty?
        sql << "-- Dados da tabela `#{table}`"
        insert_statements = []
        rows.each do |row|
          values = row.map do |val|
            if val.nil?
              "NULL"
            elsif val.is_a?(Numeric)
              val.to_s
            elsif val.is_a?(TrueClass) || val.is_a?(FalseClass)
              val ? "1" : "0"
            elsif val.is_a?(Time) || val.is_a?(DateTime) || val.is_a?(Date)
              "'#{conn.quote_string(val.strftime('%Y-%m-%d %H:%M:%S'))}'"
            else
              "'#{conn.quote_string(val.to_s)}'"
            end
          end
          insert_statements << "(#{values.join(', ')})"
        end

        insert_statements.each_slice(100) do |batch|
          sql << "INSERT INTO `#{table}` (#{cols}) VALUES\n#{batch.join(",\n")};"
        end
      end
    end

    sql << "\nSET FOREIGN_KEY_CHECKS=1;"
    sql.join("\n")
  end
end
