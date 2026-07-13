class Api::AgendamentosController < ApplicationController
  include SugestaoAgendamento

  # GET /agendamentos
  def index
    # Filtra apenas confirmados para a grade principal (ou conforme necessidade do front)
    agendamentos = Agendamento.includes(:profissional, :paciente, :convenio)

    # Regra de Privacidade: Se não for gestor nem neurochat, filtra pelo nome do profissional (userName)
    unless user_is_gestao? || request.headers['X-User-Access-Level'] == 'neurochat'
      user_name = request.headers['X-User-Name']
      if user_name.present?
        # Tenta bater o userName com o nome do profissional (flexível)
        agendamentos = agendamentos.joins(:profissional).where("profissionais.nome ILIKE ?", "%#{user_name}%")
      else
        # Se não tem user_name e não é gestor, não vê nada (segurança)
        agendamentos = Agendamento.none
      end
    end

    render json: agendamentos.all.map { |a|
      convenio_exibir = a.paciente&.convenio || a.convenio
      convenio_nome = convenio_exibir&.nome || "Sem Convênio"

      a.as_json(
        except: [:created_at, :updated_at],
        include: {
          profissional: { only: [:id, :nome, :especialidade] },
          paciente: { only: [:id, :nome] }
        }
      ).merge(
        convenio: convenio_exibir.as_json(only: [:id, :nome]),
        convenio_nome: convenio_nome
      )
    }
  end

  # GET /agendamentos/:id
  def show
    agendamento = Agendamento.find(params[:id])
    render json: agendamento.as_json(include: [:profissional, :paciente, :convenio])
  end

  # GET /agendamentos/vagas?especialidade=ABA&paciente_id=5
  def vagas
    especialidade = params[:especialidade]
    paciente_id   = params[:paciente_id]

    slots_seg = ClinicSlots::MONDAY
    slots_pad = ClinicSlots::STANDARD

    profissionais = if especialidade.present?
                      # Normaliza o parâmetro de busca (remove espaços extras e converte para maiúsculo)
                      esp_normalizada = especialidade.to_s.strip.upcase
                      Profissional.where(ativo: true)
                                  .where("especialidade LIKE ?", "%#{esp_normalizada}%").to_a
                                  .select do |p|
                        # Normaliza cada especialidade cadastrada antes de comparar
                        p.especialidade.to_s.split(',').map { |e| e.strip.upcase }.include?(esp_normalizada)
                      end
                    else
                      Profissional.where(ativo: true).to_a
                    end

    # Se nenhum profissional foi encontrado com o filtro exato, tenta com LIKE puro (fallback)
    if especialidade.present? && profissionais.empty?
      esp_normalizada = especialidade.to_s.strip.upcase
      profissionais = Profissional.where(ativo: true)
                                  .where("UPPER(especialidade) LIKE ?", "%#{esp_normalizada}%").to_a
    end

    if paciente_id.present?
      paciente = Paciente.find_by(id: paciente_id)
      if paciente&.age.present? && paciente.age > 0
        age = paciente.age
        profissionais.select! { |p| (p.min_age.nil? || p.min_age <= age) && (p.max_age.nil? || p.max_age >= age) }
      end
    end

    resultado = profissionais.map do |prof|
      # Buscamos agendamentos e marcamos o tipo (confirmado ou pendente)
      ag_data = prof.agendamentos.pluck(:horario, :dia_semana, :status)
      
      vagas_livres = {
        "SEGUNDA-FEIRA" => processar_vagas(slots_seg, ag_data.select { |o| o[1].to_s.strip.upcase == "SEGUNDA-FEIRA" }),
        "TERÇA-FEIRA"   => processar_vagas(slots_pad, ag_data.select { |o| o[1].to_s.strip.upcase == "TERÇA-FEIRA" }),
        "QUARTA-FEIRA"  => processar_vagas(slots_pad, ag_data.select { |o| o[1].to_s.strip.upcase == "QUARTA-FEIRA" }),
        "QUINTA-FEIRA"  => processar_vagas(slots_pad, ag_data.select { |o| o[1].to_s.strip.upcase == "QUINTA-FEIRA" }),
        "SEXTA-FEIRA"   => processar_vagas(slots_pad, ag_data.select { |o| o[1].to_s.strip.upcase == "SEXTA-FEIRA" })
      }
      
      { 
        id: prof.id, 
        profissional: prof.nome, 
        especialidade: prof.especialidade, 
        min_age: prof.min_age, 
        max_age: prof.max_age, 
        horarios_disponiveis: vagas_livres,
        vagas_ocupadas: ag_data.select { |o| o[2] == 'confirmado' || o[2] == 'pendente' }.size
      }
    end

    render json: resultado
  end

  # GET /agendamentos/vagas_por_especialidade
  def vagas_por_especialidade
    # Pega todos os profissionais ativos
    profissionais = Profissional.ativos.includes(:agendamentos).to_a
    
    # Slots padrão do sistema (Segunda tem 9, Ter-Sex tem 12 cada)
    slots_seg = ClinicSlots::MONDAY
    slots_pad = ClinicSlots::STANDARD
    capacidade_por_prof = slots_seg.size + (slots_pad.size * 4) # 57 slots/semana

    resumo = {}
    profissionais.each do |prof|
      esps = prof.especialidade.to_s.upcase.split(',').map(&:strip).reject(&:blank?)
      
      ocupados = 0
      prof.agendamentos.where(status: ['confirmado', 'pendente', 'bloqueado']).each do |ag|
        if ag.horario.to_s.include?('-')
          p1, p2 = ag.horario.split('-')
          h1, m1 = p1.to_s.downcase.gsub('h',':').split(':')
          h2, m2 = p2.to_s.downcase.gsub('h',':').split(':')
          minutos = ((h2.to_i * 60 + m2.to_i) - (h1.to_i * 60 + m1.to_i))
          ocupados += [minutos / 40, 1].max
        else
          ocupados += 1
        end
      end
      
      esps.each do |esp|
        resumo[esp] ||= { capacidade: 0, ocupados: 0 }
        resumo[esp][:capacidade] += capacidade_por_prof
        resumo[esp][:ocupados] += ocupados
      end
    end

    # Transforma o hash em array para o JSON
    resultado = resumo.map do |esp, dados|
      vagas = dados[:capacidade] - dados[:ocupados]
      vagas = 0 if vagas < 0
      { especialidade: esp, vagas: vagas }
    end

    # Ordena por nome da especialidade para ficar organizado
    render json: resultado.sort_by { |r| r[:especialidade] }
  end

  # GET /agendamentos/sugerir?paciente_id=5&specs=FONO,ABA
  def sugerir
    paciente_id = params[:paciente_id]
    return render json: { error: "paciente_id é obrigatório" }, status: :bad_request if paciente_id.blank?

    paciente = Paciente.find_by(id: paciente_id)
    return render json: { error: "Paciente não encontrado" }, status: :not_found unless paciente

    # Se specs for enviado, usamos ele (filtro do checklist). Se não, usamos o que está no banco.
    especialidades = if params[:specs].present?
                       params[:specs].to_s.split(',').map { |s| s.strip.upcase }.reject(&:blank?)
                     else
                       extrair_especialidades(paciente.planned_specialties)
                     end

    frequencias = extrair_frequencias(paciente.planned_specialties)
    agendamentos_existentes = paciente.agendamentos.includes(:profissional).to_a
    sugestoes = buscar_sugestoes_consecutivos(especialidades, paciente.age, frequencias, agendamentos_existentes)

    # Além das sugestões, enviamos as vagas brutas para o "Modo Manual"
    vagas_brutas = extrair_vagas_brutas(especialidades, paciente.age)
    
    render json: {
      paciente: { id: paciente.id, nome: paciente.nome, age: paciente.age },
      especialidades_planejadas: especialidades,
      total_sugestoes: sugestoes.length,
      sugestoes: sugestoes,
      vagas_por_profissional: vagas_brutas
    }
  end

  # POST /agendamentos
  def create
    if request.headers['X-User-Access-Level'] == 'neurochat' && !user_is_gestao?
      return render json: { error: "Usuários do Neurochat não têm permissão para agendar ou bloquear vagas diretamente." }, status: :forbidden
    end

    if request.headers['X-User-Name'].present?
      params[:agendamento][:atualizado_por] = request.headers['X-User-Name'].upcase
    end

    agendamento = Agendamento.new(agendamento_params)

    # Se for um bloqueio, garantimos que o nome do bloqueador está correto.
    # O X-User-Name já chega via header em todas as requisições (auth.js),
    # evitando a busca no banco errado (neurochat_db).
    if agendamento.status == 'bloqueado'
      nome_bloqueador = request.headers['X-User-Name'].presence
      agendamento.bloqueado_por = nome_bloqueador.upcase if nome_bloqueador.present?
      agendamento.bloqueado_por_id = params[:user_id].to_i if params[:user_id].present?
    end

    # Se for encaixe, captura a data especifica para expirar automaticamente
    if agendamento.encaixe
      data_raw = params[:data_encaixe].presence || Date.today.to_s
      agendamento.data_encaixe = Date.parse(data_raw) rescue Date.today
    end
    
    # Se vem da lista de espera, o status padrão pode ser pendente se o front enviar
    if agendamento.save
      detalhes_log = {
        profissional_id: agendamento.profissional_id,
        profissional_nome: agendamento.profissional&.nome,
        dia_semana: agendamento.dia_semana,
        horario: agendamento.horario,
        paciente_id: agendamento.paciente_id,
        paciente_nome: agendamento.paciente&.nome,
        status: agendamento.status,
        observacoes: agendamento.observacoes,
        motivo_bloqueio: agendamento.motivo_bloqueio,
        atualizado_por: agendamento.atualizado_por || agendamento.bloqueado_por
      }
      AuditoriaService.log(request, 'CRIAR_AGENDAMENTO', agendamento, detalhes_log)
      if agendamento.status == 'pendente'
        # Notifica o grupo que há um agendamento aguardando aprovação
        setor = request.headers['X-User-Role'] || 'Recepção'
        NeurochatService.notificar_aguardando_aprovacao(agendamento, setor)
      elsif agendamento.encaixe
        setor = request.headers['X-User-Role'] || 'Recepção'
        NeurochatService.notificar_encaixe(agendamento, setor)
      elsif agendamento.observacoes&.include?("Espera")
        setor = request.headers['X-User-Role'] || 'Recepção'
        NeurochatService.notificar_agendamento_espera(agendamento.paciente, agendamento, setor)
      end
      render json: agendamento, status: :created
    else
      render json: { errors: agendamento.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # POST /agendamentos/:id/aprovar
  def aprovar
    agendamento = Agendamento.find(params[:id])
    if agendamento.status != 'pendente'
      return render json: { error: "Este agendamento já está confirmado." }, status: :unprocessable_entity
    end

    Agendamento.transaction do
      nome_usuario = request.headers['X-User-Name'].presence || 'GESTÃO'
      agendamento.update!(status: 'confirmado', atualizado_por: nome_usuario.upcase)
      
      # Se houver um item na lista de espera vinculado, removemos ou marcamos como concluído
      if agendamento.lista_espera_id.present?
        item_espera = ListaEspera.find_by(id: agendamento.lista_espera_id)
        
        # Se o paciente ainda não existe (vínculo apenas por nome na espera), podemos criar agora
        unless agendamento.paciente_id.present?
           # Lógica para vincular ou criar paciente se necessário
           # Por simplicidade, assume-se que o agendamento já tem um paciente_id ou o criamos no pré-fluxo
        end
        
        item_espera&.destroy
      end
    end

    setor = request.headers['X-User-Role'] || 'Gestão'
    detalhes_log = {
      profissional_id: agendamento.profissional_id,
      profissional_nome: agendamento.profissional&.nome,
      dia_semana: agendamento.dia_semana,
      horario: agendamento.horario,
      paciente_id: agendamento.paciente_id,
      paciente_nome: agendamento.paciente&.nome,
      status: 'confirmado',
      aprovado_por: request.headers['X-User-Name'] || 'GESTÃO'
    }
    AuditoriaService.log(request, 'APROVAR_AGENDAMENTO', agendamento, detalhes_log)
    NeurochatService.notificar_aprovacao_agendamento(agendamento, setor)

    render json: { message: "Agendamento aprovado com sucesso!", agendamento: agendamento }
  end

  # PATCH/PUT /agendamentos/:id
  def update
    if request.headers['X-User-Access-Level'] == 'neurochat' && !user_is_gestao?
      # Permite que usuários do Neurochat editem APENAS as observações e/ou cor (e atualizado_por)
      agendamento_params_keys = params.require(:agendamento).keys.map(&:to_s)
      allowed_keys = ['observacoes', 'cor', 'atualizado_por']
      
      if (agendamento_params_keys - allowed_keys).any?
        return render json: { error: "Usuários do Neurochat não têm permissão para alterar dados estruturais de agendamentos." }, status: :forbidden
      end
    end

    agendamento = Agendamento.find(params[:id])
    
    old_dia = agendamento.dia_semana
    old_horario = agendamento.horario
    old_prof = agendamento.profissional
    
    if request.headers['X-User-Name'].present?
      params[:agendamento][:atualizado_por] = request.headers['X-User-Name'].upcase
    end
    
    if agendamento.update(agendamento_params)
      # Verifica se trocou horário ou profissional
      mudou_horario = (old_dia != agendamento.dia_semana || old_horario != agendamento.horario)
      mudou_prof = (old_prof.id != agendamento.profissional_id)
      
      if mudou_horario || mudou_prof
        setor = request.headers['X-User-Role'] || 'Gestão'
        NeurochatService.notificar_alteracao_agendamento(
          agendamento.paciente, old_prof, agendamento.profissional,
          old_dia, old_horario, agendamento.dia_semana, agendamento.horario, setor
        )
      end
      
      detalhes_log = {
        profissional_id: agendamento.profissional_id,
        profissional_nome: agendamento.profissional&.nome,
        dia_semana: agendamento.dia_semana,
        horario: agendamento.horario,
        paciente_id: agendamento.paciente_id,
        paciente_nome: agendamento.paciente&.nome,
        status: agendamento.status,
        observacoes: agendamento.observacoes,
        motivo_bloqueio: agendamento.motivo_bloqueio,
        atualizado_por: agendamento.atualizado_por
      }
      AuditoriaService.log(request, 'EDITAR_AGENDAMENTO', agendamento, detalhes_log)
      render json: agendamento
    else
      render json: { errors: agendamento.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # DELETE /agendamentos/:id
  def destroy
    if request.headers['X-User-Access-Level'] == 'neurochat' && !user_is_gestao?
      return render json: { error: "Usuários do Neurochat não têm permissão para liberar vagas ou remover agendamentos diretamente." }, status: :forbidden
    end

    begin
      agendamento = Agendamento.find(params[:id])
    rescue ActiveRecord::RecordNotFound
      return render json: { message: 'Vaga já liberada.' }
    end
    
    # Se for um bloqueio, validamos quem está tentando remover
    if agendamento.status == 'bloqueado'
      requester_id = params[:user_id].to_i
      
      # Utiliza a lógica centralizada de gestão (incluindo super admins e setores autorizados)
      is_admin = user_is_gestao?
      
      unless is_admin || agendamento.bloqueado_por_id == requester_id
        return render json: { error: "Somente o usuário '#{agendamento.bloqueado_por}' ou a Gestão pode realizar este desbloqueio." }, status: :forbidden
      end
    end

    # Captura todos os dados ANTES de destruir para a notificação
    paciente     = agendamento.paciente
    profissional = agendamento.profissional
    dia          = agendamento.dia_semana
    hora         = agendamento.horario
    motivo       = agendamento.motivo_bloqueio.presence || "Remoção direta na grade"
    setor        = request.headers['X-User-Role'] || 'Gestão'
    operador_nome = request.headers['X-User-Name']
    
    detalhes_log = {
      profissional_id: agendamento.profissional_id,
      profissional_nome: profissional&.nome,
      dia_semana: dia,
      horario: hora,
      paciente_id: agendamento.paciente_id,
      paciente_nome: paciente&.nome,
      status: agendamento.status,
      motivo: motivo,
      operador: operador_nome || setor
    }
    AuditoriaService.log(request, 'EXCLUIR_AGENDAMENTO', agendamento, detalhes_log)
    agendamento.destroy

    # Notifica o Grupo 14 (Retiradas) ou o grupo de Agendamento sobre a remoção
    user_id = params[:user_id].presence
    operador_nome = request.headers['X-User-Name'].presence

    if paciente
      NeurochatService.notificar_retirada_paciente(paciente, profissional, dia, hora, motivo, setor, user_id, operador_nome)
    else
      # Se era um bloqueio, envia uma mensagem de "Desbloqueio de Horário"
      msg_bloqueio = "🔓 **HORÁRIO DESBLOQUEADO / REMOVIDO**\n" \
                     "👨‍⚕️ Profissional: **#{profissional&.nome}**\n" \
                     "📅 Horário: **#{dia} às #{hora}**\n" \
                     "📝 Motivo original: #{motivo}\n" \
                     "🛠️ Ação por: **#{operador_nome || setor}**"
      # Envia para o grupo de Agendamento (ID 7)
      NeurochatService.enviar_mensagem_grupo(msg_bloqueio, 7)
    end

    render json: { mensagem: "Removido com sucesso!" }
  end

  # POST /agendamentos/transferir
  def transferir
    de_prof_id = params[:de_profissional_id]
    para_prof_id = params[:para_profissional_id]
    paciente_id = params[:paciente_id]

    if paciente_id.blank?
      return render json: { errors: ["Paciente deve ser selecionado."] }, status: :unprocessable_entity
    end

    agendamentos = Agendamento.where(profissional_id: de_prof_id, paciente_id: paciente_id)
    
    if agendamentos.empty?
      return render json: { errors: ["Nenhum agendamento encontrado para este paciente com o profissional de origem."] }, status: :unprocessable_entity
    end

    erros = []
    
    Agendamento.transaction do
      agendamentos.each do |ag|
        # Verifica conflito no novo profissional (ignora se for encaixe)
        if !params[:encaixe] && Agendamento.exists?(profissional_id: para_prof_id, dia_semana: ag.dia_semana, horario: ag.horario)
          erros << "Horário #{ag.dia_semana} às #{ag.horario} ocupado no profissional de destino."
          raise ActiveRecord::Rollback
        else
          nome_usuario = request.headers['X-User-Name'].presence || 'AGENDAMENTO'
          ag.update!(profissional_id: para_prof_id, encaixe: params[:encaixe] == true, atualizado_por: nome_usuario.upcase)
        end
      end
    end

    if erros.any?
      render json: { errors: erros }, status: :unprocessable_entity
    else
      # Notificação NeuroChat (Segura e Centralizada)
      begin
        profissional_destino = Profissional.find(para_prof_id)
        paciente = Paciente.find(paciente_id)
        
        # Conecta ao banco do neurochat e busca o ID do usuário destino (Terapeuta)
        neurochat_user = NeurochatRecord.connection.select_one(
          ActiveRecord::Base.send(:sanitize_sql_array, [
            "SELECT id FROM users WHERE username = ? AND department LIKE 'Terapeutas%'",
            profissional_destino.nome
          ])
        )

        if neurochat_user
          target_id = neurochat_user['id']
          texto_notificacao = "Olá #{profissional_destino.nome}! Uma nova transferência de paciente foi direcionada para você. O paciente *#{paciente.nome}* foi realocado para a sua agenda pela equipe de Agendamentos."
          
          # Envia mensagem privada via Service (Já sanitizada)
          msg_id = NeurochatService.enviar_mensagem_privada(target_id, texto_notificacao)
          
          # Dispara o webhook para atualizar a tela no NeuroChat
          NeurochatService.fogo_e_esquece_webhook(msg_id)
        end

        # Notifica os grupos sobre a transferência direta
        setor = request.headers['X-User-Role'] || 'Agendamento'
        AuditoriaService.log(request, 'TRANSFERENCIA_DIRETA', paciente, "De: #{Profissional.find(de_prof_id).nome} Para: #{profissional_destino.nome}")
        NeurochatService.notificar_transferencia_paciente(paciente, Profissional.find(de_prof_id), profissional_destino, "Transferência direta", setor)
      rescue StandardError => e
        Rails.logger.error "Erro ao enviar notificação NeuroChat: #{e.message}"
      end

      render json: { mensagem: "Transferência concluída com sucesso!" }
    end
  end

  def por_profissional
    @agendamentos = Agendamento.includes(:paciente => :convenio, :convenio => [])
      .where(profissional_id: params[:id])
      .where("(encaixe = FALSE OR encaixe IS NULL OR data_encaixe IS NULL OR data_encaixe >= CURDATE())")
    
    render json: @agendamentos.map { |a|
      # Usa o convênio do PACIENTE como fonte de verdade (se o paciente tiver convênio cadastrado)
      # Só usa o convênio do agendamento como fallback se o paciente não tiver convênio.
      convenio_exibir = a.paciente&.convenio || a.convenio
      convenio_nome = convenio_exibir&.nome || "Sem Convênio"

      a.as_json.merge(
        dia_semana: a.dia_semana.to_s.strip.downcase,
        paciente_nome: a.paciente&.nome || "Sem Nome",
        convenio_nome: convenio_nome,
        paciente: a.paciente,
        convenio: convenio_exibir,
        terapia_grupo: a.terapia_grupo
      )
    }
  end

  # GET /api/agendamentos/historico_slot
  def historico_slot
    profissional_id = params[:profissional_id]
    dia_semana = params[:dia_semana].to_s.upcase.strip
    horario = params[:horario].to_s.strip

    if profissional_id.blank? || dia_semana.blank? || horario.blank?
      return render json: { error: "Parâmetros insuficientes" }, status: :bad_request
    end

    agendamento = Agendamento.find_by(profissional_id: profissional_id, dia_semana: dia_semana, horario: horario)
    agendamento_id = agendamento&.id

    conditions = []
    values = []

    if agendamento_id
      conditions << "entidade_id = ?"
      values << agendamento_id
    end

    conditions << "(detalhes LIKE ? AND detalhes LIKE ? AND detalhes LIKE ?)"
    values += ["%\"profissional_id\":#{profissional_id}%", "%\"dia_semana\":\"#{dia_semana}\"%", "%\"horario\":\"#{horario}\"%"]

    prof = Profissional.find_by(id: profissional_id)
    if prof
      conditions << "(detalhes LIKE ? AND detalhes LIKE ?)"
      values += ["%#{prof.nome}%", "%Horário: #{dia_semana} #{horario}%"]
    end

    query = Auditoria.where(entidade_tipo: 'Agendamento')
                     .where(conditions.join(" OR "), *values)
                     .order(created_at: :desc)
                     .limit(10)

    historico = query.map do |aud|
      {
        id: aud.id,
        acao: aud.acao,
        created_at: aud.created_at,
        setor: aud.setor,
        user_name: aud.user_name || 'Sistema',
        detalhes: parse_detalhes_log(aud.detalhes)
      }
    end

    render json: historico
  end

  private

  def parse_detalhes_log(detalhes_str)
    return {} if detalhes_str.blank?
    begin
      JSON.parse(detalhes_str)
    rescue JSON::ParserError
      { text: detalhes_str }
    end
  end

  def agendamento_params
    params.require(:agendamento).permit(:profissional_id, :paciente_id, :convenio_id, :dia_semana, :horario, :observacoes, :status, :lista_espera_id, :motivo_bloqueio, :bloqueado_por, :bloqueado_por_id, :encaixe, :data_encaixe, :terapia_grupo, :cor, :atualizado_por)
  end

  # Interpreta o campo planned_specialties que pode ser JSON ou texto separado por vírgulas
  def extrair_especialidades(campo)
    return [] if campo.blank?
    begin
      parsed = JSON.parse(campo)
      if parsed.is_a?(Hash)
        parsed.keys.map(&:to_s).reject(&:blank?)
      elsif parsed.is_a?(Array)
        parsed.map(&:to_s).reject(&:blank?)
      else
        []
      end
    rescue JSON::ParserError
      campo.split(",").map(&:strip).reject(&:blank?)
    end
  end

  # Auxiliar para calcular vagas subtraindo ocupados dos slots totais
  def processar_vagas(total_slots, ocupados_data)
    horarios_ocupados = ocupados_data.map { |d| d.is_a?(Array) ? d[0].to_s : d.to_s }.reject(&:blank?)

    total_slots.reject do |slot|
      slot_m = horario_para_minutos(slot)
      
      horarios_ocupados.any? do |ocup|
        if ocup.include?('-')
          p1, p2 = ocup.split('-')
          m1 = horario_para_minutos(p1.strip)
          m2 = horario_para_minutos(p2.strip)
          
          # Se o slot (ex: 08:40 => 520) começar dentro do período ocupado (ex: 480 a 560)
          slot_m >= m1 && slot_m < m2
        else
          horario_para_minutos(ocup) == slot_m
        end
      end
    end
  end
end