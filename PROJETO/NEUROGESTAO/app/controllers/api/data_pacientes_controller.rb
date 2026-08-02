class Api::DataPacientesController < ApplicationController
  before_action :bloquear_neurochat_escrita, only: [:create, :update, :destroy, :reativar, :mesclar, :unificar_automatico]


  # Responde ao GET /api/data_pacientes.json
  def index
    begin
      page = (params[:page] || 1).to_i
      per_page = (params[:per_page] || 100).to_i
      offset = (page - 1) * per_page

      pacientes_query = Paciente.ativos.order(:nome).includes(:convenio, agendamentos: :profissional)

      if params[:busca].present?
        termo = "%#{params[:busca]}%"
        pacientes_query = pacientes_query.where("LOWER(nome) LIKE ?", termo.downcase)
      end

      if params[:profissional_id].present?
        paciente_ids = Agendamento.where(profissional_id: params[:profissional_id]).select(:paciente_id)
        pacientes_query = pacientes_query.where(id: paciente_ids)
      end

      if params[:convenio_id].present?
        if params[:convenio_id] == 'particular'
          pacientes_query = pacientes_query.where(convenio_id: nil)
        else
          pacientes_query = pacientes_query.where(convenio_id: params[:convenio_id])
        end
      end

      total_registros = pacientes_query.count
      pacientes = pacientes_query.offset(offset).limit(per_page)
      
      json_data = pacientes.map { |p|
        begin
          p.as_json(
            only: [:id, :nome, :age, :birth_date, :convenio_id, :weekly_frequency, :status, :planned_specialties, :vip]
          ).merge({
            convenio: p.convenio ? { id: p.convenio.id, nome: p.convenio.nome } : nil,
            agendamentos: p.agendamentos.map { |a| 
              { 
                id: a.id,
                dia_semana: a.dia_semana, 
                horario: a.horario, 
                profissional: a.profissional&.nome,
                profissional_id: a.profissional_id
              } 
            }
          })
        rescue
          { id: p.id, nome: p.nome, erro: "Erro nos dados" }
        end
      }
      
      total_paginas = (total_registros.to_f / per_page).ceil
      total_paginas = 1 if total_paginas < 1

      render json: {
        pacientes: json_data,
        total: total_registros,
        pagina_atual: page,
        total_paginas: total_paginas
      }
    rescue => e
      render json: { error: e.message }, status: :internal_server_error
    end
  end

  # POST /api/data_pacientes
  def create
    nome_trimmed = paciente_params[:nome].to_s.strip
    
    # 1. Verificar se o paciente já existe no banco (exato ou por inteligência de nome/sobrenome em ativos)
    paciente_existente = Paciente.ativos.find_by("LOWER(nome) = ?", nome_trimmed.downcase) || verificar_duplicidade_nome(nome_trimmed, apenas_ativos: true)

    if paciente_existente
      # Se o paciente já existe ativo, atualizamos o cadastro existente em vez de dar erro de duplicidade
      paciente_existente.assign_attributes(paciente_params.except(:nome))
      if paciente_params[:nome].present? && !paciente_existente.nome.to_s.include?('⭐')
        paciente_existente.nome = paciente_params[:nome]
      end
      processar_salvamento(paciente_existente)
      return
    end

    # Se estiver inativo/removido, orienta a reativação
    paciente_inativo = Paciente.unscoped.where.not(deleted_at: nil).find_by("LOWER(nome) = ?", nome_trimmed.downcase)
    if paciente_inativo
      return render json: { 
        success: false, 
        errors: ["O paciente '#{paciente_inativo.nome}' está inativo/removido. Reative-o no histórico de removidos em vez de criar um novo cadastro."] 
      }, status: :unprocessable_entity
    end

    paciente = Paciente.new(paciente_params)
    processar_salvamento(paciente)
  end

  # PATCH/PUT /api/data_pacientes/:id
  def update
    paciente = Paciente.find(params[:id])
    
    nome_novo_limpo = paciente_params[:nome].present? ? limpar_nome_base(paciente_params[:nome]) : nil
    nome_atual_limpo = paciente.nome.present? ? limpar_nome_base(paciente.nome) : nil

    # Só valida duplicidade com OUTROS pacientes se o nome base foi alterado para um nome diferente
    if nome_novo_limpo.present? && nome_novo_limpo.downcase != nome_atual_limpo.downcase
      duplicado = verificar_duplicidade_nome(paciente_params[:nome], paciente.id, apenas_ativos: true)
      if duplicado
        if mesmo_paciente_duplicado?(paciente_params[:nome], duplicado.nome)
          # Se for a mesma pessoa (ex: Samira vs Samira - ABA ⭐), consolida agendamentos e inativa o duplicado extra
          Agendamento.where(paciente_id: duplicado.id).update_all(paciente_id: paciente.id)
          duplicado.soft_delete rescue nil
        else
          return render json: { 
            success: false, 
            errors: ["Já existe outro paciente ativo cadastrado com nome e sobrenome similares: '#{duplicado.nome}'."] 
          }, status: :unprocessable_entity
        end
      end
    end

    paciente.assign_attributes(paciente_params)
    
    if paciente_params[:nome].present?
      base_limpa = limpar_nome_base(paciente_params[:nome])
      paciente.nome = base_limpa if base_limpa.split(/\s+/).size >= 2
    end

    processar_salvamento(paciente)
  rescue => e
    Rails.logger.error "Erro no update de paciente: #{e.message}\n#{e.backtrace.join("\n")}"
    render json: { success: false, errors: ["Erro ao atualizar paciente: #{e.message}"] }, status: :unprocessable_entity
  end

  # DELETE /api/data_pacientes/:id
  def destroy
    paciente = Paciente.find(params[:id])
    motivo = params[:motivo] || "Motivo não informado"
    setor = request.headers['X-User-Role'] || 'Desconhecido'
    Agendamento.where(paciente_id: paciente.id).includes(:profissional).each do |ag|
      NeurochatService.notificar_retirada_paciente(paciente, ag.profissional, ag.dia_semana, ag.horario, motivo, setor)
    end
    Agendamento.where(paciente_id: paciente.id).destroy_all
    if paciente.soft_delete
      AuditoriaService.log(request, 'EXCLUIR', paciente, "Motivo: #{motivo}")
      render json: { message: 'Paciente removido com sucesso' }
    else
      render json: { error: 'Não foi possível excluir o paciente.' }, status: :unprocessable_entity
    end
  end

  # GET /api/data_pacientes/removidos
  def removidos
    page = (params[:page] || 1).to_i
    per_page = (params[:per_page] || 30).to_i
    offset = (page - 1) * per_page

    query = Paciente.inativos.order(updated_at: :desc)

    if params[:busca].present?
      termo = "%#{params[:busca]}%"
      query = query.where("LOWER(nome) LIKE ?", termo.downcase)
    end

    total_registros = query.count
    pacientes_removidos = query.offset(offset).limit(per_page)

    auditorias_exclusao = Auditoria.where(entidade_tipo: 'Paciente', acao: 'EXCLUIR').order(created_at: :desc).group_by(&:entidade_id)

    dados = pacientes_removidos.map do |p|
      audit = auditorias_exclusao[p.id]&.first
      motivo_bruto = audit&.detalhes.to_s
      motivo = motivo_bruto.sub(/^Motivo:\s*/, '').presence || "Motivo não informado"
      operador = audit&.user_name.presence || audit&.setor.presence || "Sistema"

      {
        id: p.id,
        nome: p.nome,
        age: p.age,
        convenio_nome: p.convenio&.nome&.upcase || 'PARTICULAR',
        data_remocao: p.updated_at || p.deleted_at || audit&.created_at,
        motivo: motivo,
        operador: operador,
        setor: audit&.setor || 'Gestão'
      }
    end

    render json: {
      removidos: dados,
      total: total_registros,
      pagina_atual: page,
      total_paginas: (total_registros.to_f / per_page).ceil
    }
  end

  # PATCH /api/data_pacientes/:id/reativar
  def reativar
    paciente = Paciente.inativos.find(params[:id])
    if paciente.reativar
      AuditoriaService.log(request, 'REATIVAR', paciente, "Ação manual de reativação")
      render json: { success: true, message: "Paciente reativado", paciente: paciente }
    else
      render json: { success: false, errors: ['Não foi possível reativar o paciente.'] }, status: :unprocessable_entity
    end
  end

  # POST /api/data_pacientes/mesclar
  def mesclar
    id_origem = params[:id_origem]
    id_destino = params[:id_destino]

    if id_origem.blank? || id_destino.blank?
      return render json: { error: "Os pacientes de origem e destino são obrigatórios." }, status: :unprocessable_entity
    end

    if id_origem == id_destino
      return render json: { error: "Os pacientes de origem e destino devem ser diferentes." }, status: :unprocessable_entity
    end

    paciente_origem = Paciente.find_by(id: id_origem)
    paciente_destino = Paciente.find_by(id: id_destino)

    if paciente_origem.nil? || paciente_destino.nil?
      return render json: { error: "Paciente de origem ou destino não localizado." }, status: :not_found
    end

    begin
      Paciente.transaction do
        Agendamento.where(paciente_id: id_origem).update_all(paciente_id: id_destino)
        ListaEspera.where(paciente_id: id_origem).update_all(paciente_id: id_destino, nome: paciente_destino.nome)
        Transferencia.where(paciente_id: id_origem).update_all(paciente_id: id_destino)
        paciente_origem.destroy!
      end

      AuditoriaService.log(request, 'MESCLAR_PACIENTES', paciente_destino, "Mesclou paciente #{paciente_origem.nome} (ID: #{id_origem}) para #{paciente_destino.nome} (ID: #{id_destino})")

      render json: { success: true, message: "Pacientes unificados com sucesso!" }
    rescue => e
      render json: { error: "Erro ao mesclar pacientes: #{e.message}" }, status: :unprocessable_entity
    end
  end

  # POST /api/data_pacientes/unificar_automatico
  def unificar_automatico
    pacientes_ativos = Paciente.ativos.to_a
    grupos = []
    visitados = Set.new

    pacientes_ativos.each do |p1|
      next if visitados.include?(p1.id)

      grupo = [p1]
      visitados.add(p1.id)

      pacientes_ativos.each do |p2|
        next if visitados.include?(p2.id)
        if grupo.any? { |m| mesmo_paciente_duplicado?(m.nome, p2.nome) }
          grupo << p2
          visitados.add(p2.id)
        end
      end

      grupos << grupo if grupo.size > 1
    end

    total_grupos = grupos.size
    total_duplicados_removidos = 0

    Paciente.transaction do
      grupos.each do |lista|
        # Seleciona paciente principal (prioriza VIP, depois convênio, depois agendamentos)
        principal = lista.max_by do |p|
          score = 0
          score += 1000 if (p.respond_to?(:vip?) && p.vip?) || p.nome.to_s.include?('⭐')
          score += 100 if p.convenio_id.present?
          score += p.agendamentos.count * 10
          score -= p.id
          score
        end

        # Garante status VIP no paciente principal se algum dos duplicados era VIP
        is_vip_group = lista.any? { |p| (p.respond_to?(:vip?) && p.vip?) || p.nome.to_s.include?('⭐') }
        if is_vip_group && principal.respond_to?(:vip=)
          principal.vip = true
        end

        # Limpa sufixos do tipo "- ABA", "- OCC" ou "⭐" do nome do paciente principal se houver nome limpo no grupo
        nome_limpo_opcao = lista.map { |p| limpar_nome_base(p.nome).gsub('⭐', '').strip }.reject(&:blank?).min_by(&:length)
        if nome_limpo_opcao.present? && nome_limpo_opcao.split(/\s+/).size >= 2
          principal.nome = nome_limpo_opcao
        end

        principal.save rescue nil

        duplicados = lista.reject { |p| p.id == principal.id }

        duplicados.each do |dup|
          Agendamento.where(paciente_id: dup.id).update_all(paciente_id: principal.id)
          ListaEspera.where(paciente_id: dup.id).update_all(paciente_id: principal.id, nome: principal.nome)
          Transferencia.where(paciente_id: dup.id).update_all(paciente_id: principal.id)
          
          if ActiveRecord::Base.connection.table_exists?('neurocontrol_guias')
            ActiveRecord::Base.connection.execute("UPDATE neurocontrol_guias SET paciente_id = #{principal.id} WHERE paciente_id = #{dup.id}") rescue nil
          end
          if ActiveRecord::Base.connection.table_exists?('neurocontrol_negociacoes')
            ActiveRecord::Base.connection.execute("UPDATE neurocontrol_negociacoes SET paciente_id = #{principal.id} WHERE paciente_id = #{dup.id}") rescue nil
          end
          if ActiveRecord::Base.connection.table_exists?('neurocontrol_alertas')
            ActiveRecord::Base.connection.execute("UPDATE neurocontrol_alertas SET paciente_id = #{principal.id} WHERE paciente_id = #{dup.id}") rescue nil
          end

          dup.soft_delete rescue dup.destroy
          total_duplicados_removidos += 1
        end

        AuditoriaService.log(request, 'UNIFICAR_AUTOMATICO', principal, "Unificados #{duplicados.size} pacientes duplicados para #{principal.nome} (ID: #{principal.id})")
      end
    end

    render json: {
      success: true,
      message: total_grupos > 0 ? "#{total_grupos} grupos de pacientes unificados com sucesso (#{total_duplicados_removidos} cadastros duplicados unificados)!" : "Nenhum paciente duplicado encontrado na base.",
      total_grupos: total_grupos,
      total_unificados: total_duplicados_removidos
    }
  rescue => e
    render json: { error: "Erro na unificação automática: #{e.message}" }, status: :unprocessable_entity
  end

  private

  def levenshtein_distance(str1, str2)
    s1 = str1.to_s.downcase
    s2 = str2.to_s.downcase
    m = s1.length
    n = s2.length
    return m if n == 0
    return n if m == 0
    d = Array.new(m + 1) { Array.new(n + 1) }
    (0..m).each { |i| d[i][0] = i }
    (0..n).each { |j| d[0][j] = j }
    (1..n).each do |j|
      (1..m).each do |i|
        d[i][j] = if s1[i - 1] == s2[j - 1]
                    d[i - 1][j - 1]
                  else
                    [d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + 1].min
                  end
      end
    end
    d[m][n]
  end

  def palavras_similares?(w1, w2)
    return true if w1 == w2
    return false if w1.blank? || w2.blank?
    if (w1.size == 1 && w2.start_with?(w1)) || (w2.size == 1 && w1.start_with?(w2))
      return true
    end
    if w1.size >= 4 && w2.size >= 4
      dist = levenshtein_distance(w1, w2)
      return true if dist <= (w1.size >= 7 ? 2 : 1)
    end
    false
  end

  def limpar_nome_base(nome)
    return "" if nome.blank?
    raw = nome.to_s.gsub('⭐', '').strip
    partes_traco = raw.split(/\s*[\-\–\—]\s*/)
    if partes_traco.size > 1 && partes_traco.first.to_s.strip.split(/\s+/).size >= 2
      partes_traco.first.strip
    else
      raw
    end
  end

  def normalizar_nome(nome)
    return "" if nome.blank?
    base = limpar_nome_base(nome)
    str = ActiveSupport::Inflector.transliterate(base).upcase.gsub(/[^A-Z0-9\s]/, ' ')
    stop_words = [
      'DA', 'DE', 'DO', 'DOS', 'DAS', 'E',
      'ABA', 'OCC', 'DEN', 'FISIO', 'PSICO', 'FONOAUDIOLOGIA', 'FONOAUDIOLOGO', 'FONOAUDIOLOGA',
      'PSICOPEDAGOGIA', 'PSICOLOGIA', 'TERAPIA', 'REABILITACAO', 'MUTIRAO', 'AVALIACAO',
      'CONSULTA', 'ATENDIMENTO', 'GERAL', 'PACIENTE'
    ]
    tokens = str.split(/\s+/).reject { |w| stop_words.include?(w) }
    tokens.join(' ')
  end

  def extrair_primeiro_e_ultimo_nome(nome)
    tokens = normalizar_nome(nome).split(' ')
    return "" if tokens.empty?
    return tokens.first if tokens.size == 1
    "#{tokens.first} #{tokens.last}"
  end

  def mesmo_paciente_duplicado?(nome1, nome2)
    t1 = normalizar_nome(nome1).split(' ')
    t2 = normalizar_nome(nome2).split(' ')
    return false if t1.empty? || t2.empty?

    return true if t1 == t2

    first_match = palavras_similares?(t1.first, t2.first)
    return false unless first_match

    # Regra 1: Nome Subconjunto (ex: "ANATÓLIO VALADARES" vs "ANATÓLIO VALADARES CAVALCANTE")
    menor, maior = t1.size <= t2.size ? [t1, t2] : [t2, t1]
    if menor.size >= 2
      todas_no_maior = menor.all? do |w_menor|
        maior.any? { |w_maior| palavras_similares?(w_menor, w_maior) }
      end
      return true if todas_no_maior
    end

    # Regra 2: Tolerância de Erro de Digitação no Último Sobrenome (ex: "COSTANTIN" vs "COSTATIN")
    last_match = palavras_similares?(t1.last, t2.last)
    return false unless last_match

    # Regra 3: Sobrenomes do meio
    mid1 = t1[1..-2] || []
    mid2 = t2[1..-2] || []
    return true if mid1.empty? || mid2.empty?

    mid_match = mid1.all? { |w1| mid2.any? { |w2| palavras_similares?(w1, w2) } } ||
                mid2.all? { |w2| mid1.any? { |w1| palavras_similares?(w1, w2) } }

    mid_match
  end

  def verificar_duplicidade_nome(nome, ignorar_id = nil, apenas_ativos: false)
    return nil if nome.blank?

    scope = apenas_ativos ? Paciente.ativos : Paciente.unscoped
    scope.each do |p|
      next if ignorar_id.present? && p.id == ignorar_id.to_i
      if mesmo_paciente_duplicado?(nome, p.nome)
        return p
      end
    end
    nil
  end

  def processar_salvamento(paciente)
    adicionar_a_espera = params[:adicionar_a_espera].to_s == "true"
    especialidade_espera = params[:especialidade_espera] || paciente.planned_specialties

    salvo = begin
      paciente.save
    rescue ActiveRecord::RecordNotUnique, Mysql2::Error => e
      if e.message.include?('Duplicate entry') || e.message.include?('index_pacientes_on_nome')
        conflito_inativo = Paciente.unscoped.where.not(deleted_at: nil).where.not(id: paciente.id).find_by("LOWER(nome) = ?", paciente.nome.to_s.downcase)
        if conflito_inativo
          conflito_inativo.update_columns(nome: "#{conflito_inativo.nome}_inativo_#{conflito_inativo.id}")
          paciente.save
        else
          conflito_ativo = Paciente.ativos.where.not(id: paciente.id).find_by("LOWER(nome) = ?", paciente.nome.to_s.downcase)
          if conflito_ativo
            Agendamento.where(paciente_id: conflito_ativo.id).update_all(paciente_id: paciente.id)
            conflito_ativo.update_columns(deleted_at: Time.current, status: 'inativo', nome: "#{conflito_ativo.nome}_inativo_#{conflito_ativo.id}")
            paciente.save
          else
            false
          end
        end
      else
        raise e
      end
    end

    if salvo
      acao_audit = params[:action] == 'create' ? 'CRIAR' : 'EDITAR'
      AuditoriaService.log(request, acao_audit, paciente, "Dados: #{paciente_params.to_h}")
      
      status_res = { success: true, paciente: paciente }
      
      if adicionar_a_espera
        especialidades_array = []
        begin
          especialidades_array = JSON.parse(paciente.planned_specialties || "[]")
        rescue
          especialidades_array = (paciente.planned_specialties || "").split(",")
        end

        espera = ListaEspera.find_or_initialize_by(paciente_id: paciente.id)
        espera.assign_attributes(
          nome: paciente.nome,
          birth_date: paciente.birth_date,
          age: paciente.age,
          especialidade: especialidade_espera.presence || especialidades_array.first || 'Geral',
          planned_specialties: paciente.planned_specialties,
          status: 'aguardando'
        )
        espera.save
        AuditoriaService.log(request, 'LISTA_ESPERA_ADD', paciente, "Adicionado via cadastro de paciente")
        status_res[:lista_espera_id] = espera.id
        status_res[:sugerir_agendamento] = true
      end

      if params[:action] == 'create'
        setor = request.headers['X-User-Role'] || 'Recepção'
        NeurochatService.notificar_novo_paciente(paciente, setor)
      end

      render json: status_res, status: (params[:action] == 'create' ? :created : :ok)
    else
      render json: { success: false, errors: paciente.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def paciente_params
    params.require(:paciente).permit(:nome, :age, :birth_date, :convenio_id, :weekly_frequency, :planned_specialties, :status, :vip)
  end

  private

  def bloquear_neurochat_escrita
    if request.headers['X-User-Access-Level'] == 'neurochat' && !user_is_gestao?
      render json: { error: "Usuários do Neurochat não têm permissão para cadastrar, editar, excluir ou mesclar pacientes." }, status: :forbidden
    end
  end
end
