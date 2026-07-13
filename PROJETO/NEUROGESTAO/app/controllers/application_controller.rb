class ApplicationController < ActionController::API
  def renderizar_front_end
    render html: File.read(Rails.root.join('public', 'index.html')).html_safe
  end

  def renderizar_dashboard
    render html: File.read(Rails.root.join('public', 'dashboard.html')).html_safe
  end

  def renderizar_grade
    render html: File.read(Rails.root.join('public', 'grade.html')).html_safe
  end

  def renderizar_pacientes
    render html: File.read(Rails.root.join('public', 'pacientes.html')).html_safe
  end

  def renderizar_transferencias
    render html: File.read(Rails.root.join('public', 'transferencias.html')).html_safe
  end

  def renderizar_equipe
    render html: File.read(Rails.root.join('public', 'equipe.html')).html_safe
  end

  def renderizar_espera
    render html: File.read(Rails.root.join('public', 'lista_espera.html')).html_safe
  end

  def renderizar_convenios
    render html: File.read(Rails.root.join('public', 'convenios.html')).html_safe
  end

  def renderizar_auditoria
    render html: File.read(Rails.root.join('public', 'auditoria.html')).html_safe
  end

  def renderizar_primeiros
    render html: File.read(Rails.root.join('public', 'primeiros.html')).html_safe
  end

  def renderizar_admin
    render html: File.read(Rails.root.join('public', 'admin.html')).html_safe
  end

  def dashboard_stats
    p_count = Profissional.ativos.count
    
    # Contamos agendamentos de profissionais ativos e pacientes ativos, mais bloqueados
    a_count = Agendamento.joins(:profissional)
                         .left_outer_joins(:paciente)
                         .where(profissionais: { ativo: true })
                         .where(status: ['confirmado', 'pendente', 'bloqueado'])
                         .where("agendamentos.status = 'bloqueado' OR (pacientes.id IS NOT NULL AND pacientes.deleted_at IS NULL)")
                         .count
                         
    e_count = ListaEspera.count
    pac_count = Paciente.ativos.count
    
    # Estimativa de vagas com base nos profissionais ativos
    vagas = (p_count * 57) - a_count
    vagas = 0 if vagas < 0

    render json: { 
      agendamentos: a_count,
      vagas_livres: vagas,
      espera: e_count,
      pacientes: pac_count
    }
  end

  private

  # Setores que podem gerenciar o sistema (RH, Pacientes, Convênios, Configurações)
  SETORES_GESTAO = [
    'agendamento', 
    'diretoria', 
    'coordenação', 
    'coordenacao',
    'recepção',
    'recepcao',
    'recepção 1', 
    'recepção 2', 
    'recepção 3', 
    'recepcao 1', 
    'recepcao 2', 
    'recepcao 3', 
    'agendamento/recepção',
    'agendamento/recepcao',
    'diretoria geral',
    'ti'
  ].freeze

  def user_is_gestao?
    role = request.headers['X-User-Role']&.to_s || 'desconhecido'
    role_utf8 = NeurochatService.clean_str(role)
    # Normaliza removendo acentos para comparação segura
    role_normalized = ActiveSupport::Inflector.transliterate(role_utf8).downcase.strip
    
    user_id = request.headers['X-User-Id'] # Idealmente enviado pelo front
    
    # Se for um super_admin no Neurochat, tem acesso total
    if user_id.present?
      begin
        is_super = NeurochatRecord.connection.select_value(
          ActiveRecord::Base.send(:sanitize_sql_array, ["SELECT is_super_admin FROM users WHERE id = ?", user_id])
        )
        return true if is_super == 1 || is_super == true || is_super.to_s == '1' || is_super.to_s == 'true'
      rescue => e
        Rails.logger.error "Erro ao verificar super admin no Neurochat: #{e.message}"
      end
    end

    setores_normalizados = SETORES_GESTAO.map { |s| ActiveSupport::Inflector.transliterate(s.dup.force_encoding('UTF-8')).downcase }
    
    return true if role_normalized == 'ti' || setores_normalizados.any? { |s| role_normalized.include?(s) || s.include?(role_normalized) }
    false
  end

  def validar_acesso_gestao!
    unless user_is_gestao?
      render json: { error: "Acesso Negado. Seu setor não possui permissão administrativa." }, status: :forbidden
    end
  end

  def validar_usuario_logado!
    if request.headers['X-User-Id'].blank?
      render json: { error: "Acesso Negado. Usuário não autenticado." }, status: :unauthorized
    end
  end

  def validar_admin!
    user_id = request.headers['X-User-Id']&.to_s&.strip
    unless user_id == "1"
      render json: { error: "Acesso Negado. Esta funcionalidade é restrita ao administrador geral." }, status: :forbidden
    end
  end

  def registrar_auditoria(acao, detalhes)
    File.open(Rails.root.join('log', 'audit.log'), 'a') do |f|
      f.puts "[#{Time.zone.now}] [#{acao}] #{detalhes}"
    end
  rescue
    # Evita que erros de escrita de log travem a aplicação
  end
end