module Api
  class GuiasController < ApplicationController
    before_action -> { authorize!(['ver_painel_geral', 'cadastrar_guias', 'gerar_protocolos']) }, only: [:index]
    before_action -> { authorize!(['cadastrar_guias', 'ver_painel_geral']) }, only: [:create, :update, :destroy, :registrar_contato, :buscar_pacientes, :cadastrar_novo_paciente, :convenios]
    before_action -> { authorize!(['cadastrar_guias', 'ver_painel_geral', 'gerar_protocolos']) }, only: [:confirmar_agendamento]
    before_action -> { authorize!(['auditar_protocolos', 'faturar_guias', 'gerar_protocolos', 'cadastrar_guias']) }, only: [:atualizar_status]

    def index
      target_mes = params[:mes_vigente].presence || Time.current.strftime('%Y-%m')

      scope = NeurocontrolGuia.joins("JOIN pacientes ON pacientes.id = neurocontrol_guias.paciente_id")
                              .joins("JOIN convenios ON convenios.id = pacientes.convenio_id")

      scope = scope.where(mes_vigente: target_mes) unless target_mes == 'todas'
      scope = scope.where(status: params[:status]) if params[:status].present? && params[:status] != 'todos'
      scope = scope.where(terapia: params[:terapia]) if params[:terapia].present? && params[:terapia] != 'todas'
      scope = scope.where('convenios.id = ?', params[:convenio_id]) if params[:convenio_id].present? && params[:convenio_id] != 'todos'

      if params[:q].present?
        q = "%#{params[:q].strip}%"
        scope = scope.where('pacientes.nome LIKE ? OR neurocontrol_guias.guia_numero LIKE ?', q, q)
      end

      guias = scope.select("neurocontrol_guias.*, pacientes.nome as paciente_nome, convenios.id as convenio_id, convenios.nome as convenio_nome, pacientes.planned_specialties")
                   .order(created_at: :desc)

      render json: guias.map { |g| format_guia_response(g) }
    end

    def create
      paciente = Paciente.find_by(id: params[:paciente_id])
      return render json: { error: 'Paciente não encontrado.' }, status: :not_found unless paciente

      previsao = calcular_frequencia(paciente.id, params[:mes_vigente], params[:terapia])
      convenio_nome = paciente.convenio&.nome
      data_validade = calcular_validade(convenio_nome, params[:terapia], params[:data_pedido])

      guia = NeurocontrolGuia.new(
        paciente_id: paciente.id,
        guia_numero: params[:guia_numero],
        quantidade_autorizada: params[:quantidade_autorizada],
        previsao_calculada: previsao,
        mes_vigente: params[:mes_vigente],
        terapia: params[:terapia],
        data_pedido: params[:data_pedido],
        data_validade: data_validade,
        criado_por: params[:criado_por],
        neurochat_grupo_id: params[:neurochat_grupo_id]
      )

      if guia.save
        res = {
          success: true,
          message: '✅ Guia criada com sucesso!',
          guia_id: guia.id,
          previsao_calculada: previsao,
          data_validade: data_validade
        }

        qtd_autorizada = params[:quantidade_autorizada].to_i
        if previsao > 0 && qtd_autorizada < previsao
          res[:alerta_divergencia] = true
          res[:mensagem_alerta] = "Aviso: A quantidade autorizada (#{qtd_autorizada}) é inferior à quantidade prevista pela agenda (#{previsao})."
        end

        render json: res
      else
        render json: { error: guia.errors.full_messages.join(', ') }, status: :bad_request
      end
    end

    def registrar_contato
      guia = NeurocontrolGuia.find_by(id: params[:id])
      return render json: { error: 'Guia não encontrada.' }, status: :not_found unless guia

      if guia.update(
        status_contato_paciente: params[:status_contato_paciente],
        observacao_contato: params[:observacao_contato],
        data_contato_paciente: Time.current
      )
        render json: { success: true, message: '✅ Contato registrado com sucesso!' }
      else
        render json: { error: 'Erro ao registrar contato.' }, status: :bad_request
      end
    end

    def confirmar_agendamento
      guia = NeurocontrolGuia.find_by(id: params[:id])
      return render json: { error: 'Guia não encontrada.' }, status: :not_found unless guia

      guia.update(status: 'p_assinar', data_liberacao: Time.current)

      paciente = Paciente.find(guia.paciente_id)
      NeurochatService.notificar_retorno_agendamento_concluido(
        paciente.nome, guia.guia_numero, params[:grade_resumo], guia.quantidade_autorizada, guia.neurochat_grupo_id
      )

      render json: { success: true, message: '✅ Agendamento confirmado com sucesso!' }
    end

    def buscar_pacientes
      q = params[:q].present? ? "%#{params[:q]}%" : '%'
      pacientes = Paciente.joins("LEFT JOIN convenios ON convenios.id = pacientes.convenio_id")
                          .where('pacientes.nome LIKE ? AND pacientes.deleted_at IS NULL', q)
                          .select('pacientes.id, pacientes.nome, convenios.nome as convenio_nome, pacientes.planned_specialties')
                          .limit(15)
      render json: pacientes
    end

    def cadastrar_novo_paciente
      paciente = Paciente.new(
        nome: params[:nome].to_s.strip,
        convenio_id: params[:convenio_id],
        planned_specialties: params[:planned_specialties] || 'Psicologia'
      )

      if paciente.save
        render json: { success: true, message: '✅ Paciente cadastrado com sucesso!', paciente: paciente }
      else
        render json: { error: paciente.errors.full_messages.join(', ') }, status: :bad_request
      end
    end

    def convenios
      render json: Convenio.select(:id, :nome).order(:nome)
    end

    def destroy
      guia = NeurocontrolGuia.find_by(id: params[:id])
      if guia&.destroy
        render json: { success: true }
      else
        render json: { error: 'Erro ao excluir guia.' }, status: :bad_request
      end
    end

    private

    WEEKDAYS_PT = %w[domingo segunda-feira terça-feira quarta-feira quinta-feira sexta-feira sábado].freeze

    def format_guia_response(g)
      data_val = g.respond_to?(:data_validade) ? g.data_validade : nil
      dias_vencer = data_val.present? ? (data_val.to_date - Date.today).to_i : nil

      qtd_aut = g.quantidade_autorizada.to_i
      prev = g.previsao_calculada.to_i
      divergente = prev > 0 && qtd_aut < prev

      {
        id: g.id,
        paciente_id: g.paciente_id,
        guia_numero: g.guia_numero,
        quantidade_autorizada: g.quantidade_autorizada,
        previsao_calculada: g.previsao_calculada,
        alerta_divergencia: divergente,
        status: g.status,
        mes_vigente: g.mes_vigente,
        terapia: g.terapia,
        data_pedido: g.data_pedido,
        data_validade: data_val,
        dias_para_vencer: dias_vencer,
        proxima_do_vencimento: (dias_vencer.present? && dias_vencer <= 30),
        vencida: (dias_vencer.present? && dias_vencer < 0),
        paciente_nome: g.attributes['paciente_nome'],
        convenio_nome: g.attributes['convenio_nome'],
        planned_specialties: g.attributes['planned_specialties'],
        status_contato_paciente: g.status_contato_paciente,
        observacao_contato: g.observacao_contato,
        neurochat_grupo_id: g.neurochat_grupo_id,
        created_at: g.created_at
      }
    end

    def calcular_validade(convenio_nome, terapia, data_pedido_raw)
      return nil if data_pedido_raw.blank?

      data_pedido = Date.parse(data_pedido_raw.to_s) rescue Date.today
      conv = convenio_nome.to_s.upcase.strip
      terapia_up = terapia.to_s.upcase.strip

      meses = if conv.include?('BRADESCO') || conv.include?('PRO-SAUDE') || conv.include?('PRO SAUDE') || conv.include?('FA-SAUDE') || conv.include?('FA SAUDE') || conv.include?('SUL AMERICA') || conv.include?('SULAMERICA') || conv.include?('SERVIR')
                6
              elsif conv.include?('GEAP')
                terapia_up.include?('TEA') ? 6 : 3
              elsif conv.include?('BEST SAUDE') || conv.include?('CASSI') || conv.include?('MEDISERVICE')
                3
              else
                3
              end

      data_pedido + meses.months
    end

    def calcular_frequencia(paciente_id, mes_vigente, terapia = nil)
      return 0 if paciente_id.blank? || mes_vigente.blank?

      parts = mes_vigente.to_s.split('-')
      return 0 if parts.size != 2

      year = parts[0].to_i
      month = parts[1].to_i

      schedules = Agendamento.joins(:profissional)
                             .where(paciente_id: paciente_id, status: 'confirmado')

      if terapia.present?
        termo = case terapia.to_s.downcase
                when 'psico', 'psicoterapia', 'tcc' then '%psic%'
                when 'fono', 'fonoaudiologia' then '%fono%'
                when 'to', 'terapia ocupacional' then '%ocupacional%'
                when 'fisio', 'fisioterapia' then '%fisi%'
                when 'pedagogia', 'psicopedagogia' then '%pedagogia%'
                when 'musicoterapia' then '%musico%'
                when 'avn' then '%neuropsico%'
                else "%#{terapia}%"
                end
        schedules = schedules.where('profissionais.especialidade LIKE ?', termo)
      end

      total_sessoes = 0
      schedules.each do |sched|
        dia_semana = sched.attributes['dia_semana'] || sched.dia_semana
        total_sessoes += count_weekday_in_month(year, month, dia_semana)
      end

      total_sessoes
    end

    def count_weekday_in_month(year, month, target_weekday)
      return 0 if target_weekday.blank?
      first_day = Date.new(year, month, 1) rescue nil
      return 0 unless first_day

      last_day = first_day.end_of_month
      (first_day..last_day).count do |date|
        WEEKDAYS_PT[date.wday] == target_weekday.to_s.downcase.strip
      end
    end
  end
end
