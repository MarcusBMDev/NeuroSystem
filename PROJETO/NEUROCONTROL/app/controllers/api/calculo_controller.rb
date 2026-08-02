module Api
  class CalculoController < ApplicationController
    before_action -> { authorize!('cadastrar_guias') }

    WEEKDAYS_PT = %w[domingo segunda-feira terça-feira quarta-feira quinta-feira sexta-feira sábado].freeze

    # GET /api/calc/previsao?paciente_id=123&mes_vigente=2026-07
    def previsao
      paciente_id = params[:paciente_id]
      mes_vigente = params[:mes_vigente]

      if paciente_id.blank? || mes_vigente.blank?
        return render json: { error: 'Parâmetros paciente_id e mes_vigente são obrigatórios.' }, status: :bad_request
      end

      parts = mes_vigente.split('-')
      if parts.size != 2
        return render json: { error: 'Formato de mes_vigente inválido. Use YYYY-MM.' }, status: :bad_request
      end

      year = parts[0].to_i
      month = parts[1].to_i

      schedules = Agendamento.joins(:profissional)
                             .where(paciente_id: paciente_id, status: 'confirmado')
                             .select('agendamentos.dia_semana, agendamentos.horario, profissionais.especialidade, profissionais.nome as profissional_nome')

      if schedules.empty?
        return render json: {
          paciente_id: paciente_id,
          mes_vigente: mes_vigente,
          schedules: [],
          previsao_por_terapia: {},
          previsao_total: 0
        }
      end

      previsao_por_terapia = {}
      previsao_total = 0

      schedules_response = schedules.map do |sched|
        qtd_sessoes = count_weekday_in_month(year, month, sched.attributes['dia_semana'])

        esp = sched.attributes['especialidade'].to_s.downcase.strip
        terapia = if esp.include?('fono') then 'Fono'
                  elsif esp.include?('psicoped') then 'Psicopedagogia'
                  elsif esp.include?('pedag') then 'Pedagogia'
                  elsif esp.include?('tcc') || esp.include?('psic') then 'Psico'
                  elsif esp.include?('terapia ocupacional') || esp.include?('t.o') || esp == 'to' then 'TO'
                  elsif esp.include?('fisi') then 'Fisio'
                  elsif esp.include?('aba') then 'ABA'
                  elsif esp.include?('neuropsic') || esp.include?('avn') then 'AVN'
                  elsif esp.include?('musico') then 'Musicoterapia'
                  else sched.attributes['especialidade']
                  end

        previsao_por_terapia[terapia] ||= 0
        previsao_por_terapia[terapia] += qtd_sessoes
        previsao_total += qtd_sessoes

        {
          dia_semana: sched.attributes['dia_semana'],
          horario: sched.attributes['horario'],
          especialidade: sched.attributes['especialidade'],
          profissional_nome: sched.attributes['profissional_nome']
        }
      end

      render json: {
        paciente_id: paciente_id,
        mes_vigente: mes_vigente,
        schedules: schedules_response,
        previsao_por_terapia: previsao_por_terapia,
        previsao_total: previsao_total
      }
    end

    private

    def count_weekday_in_month(year, month, target_weekday)
      first_day = Date.new(year, month, 1)
      last_day = first_day.end_of_month

      (first_day..last_day).count do |date|
        WEEKDAYS_PT[date.wday] == target_weekday.to_s.downcase.strip
      end
    end
  end
end
