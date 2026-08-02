module Api
  class DashboardController < ApplicationController
    def stats
      especialidades_count = Profissional.where.not(especialidade: [nil, '', 'PENDENTE']).distinct.count(:especialidade)
      pacientes_count = Paciente.ativos.count
      profissionais_count = Profissional.count
      agendamentos_count = Agendamento.joins(:profissional, :paciente)
                                      .where(profissionais: { ativo: true })
                                      .where(pacientes: { deleted_at: nil })
                                      .where(status: ['confirmado', 'pendente'])
                                      .count
      espera_count = ListaEspera.count rescue 0

      # Calcular a ocupação e bloqueios rigorosamente pelo tempo
      slots_ocupados_globais = 0
      slots_bloqueados_globais = 0

      Agendamento.joins(:profissional)
                 .left_outer_joins(:paciente)
                 .where(profissionais: { ativo: true })
                 .where(status: ['confirmado', 'pendente', 'bloqueado'])
                 .each do |ag|
        num_slots = 1
        if ag.horario.to_s.include?('-')
          p1, p2 = ag.horario.split('-')
          h1, m1 = p1.to_s.downcase.gsub('h',':').split(':')
          h2, m2 = p2.to_s.downcase.gsub('h',':').split(':')
          minutos = ((h2.to_i * 60 + m2.to_i) - (h1.to_i * 60 + m1.to_i))
          num_slots = [minutos / 40, 1].max
        end

        if ag.status == 'bloqueado'
          slots_bloqueados_globais += num_slots
        elsif ag.paciente_id.present? && ag.paciente&.deleted_at.nil?
          slots_ocupados_globais += num_slots
        end
      end

      # Capacidade total máxima da clínica = N° de Profissionais Ativos * 60 slots semanais (12 por dia x 5 dias)
      vagas_totais_teto = Profissional.ativos.count * (ClinicSlots::MONDAY.size + (ClinicSlots::STANDARD.size * 4))
      vagas_livres_calculadas = vagas_totais_teto - (slots_ocupados_globais + slots_bloqueados_globais)
      vagas_livres_calculadas = 0 if vagas_livres_calculadas < 0

      render json: {
        total_pacientes: pacientes_count,
        total_agendamentos: agendamentos_count,
        total_profissionais: profissionais_count,
        profissionais_ativos: Profissional.ativos.count,
        especialidades_cobertas: especialidades_count,
        vagas_ocupadas: slots_ocupados_globais,
        vagas_bloqueadas: slots_bloqueados_globais,
        vagas_disponiveis: vagas_livres_calculadas,
        total_espera: espera_count,

        totalPacientes: pacientes_count,
        totalAgendamentos: agendamentos_count,
        totalProfissionais: profissionais_count,
        profissionaisAtivos: Profissional.ativos.count,
        especialidadesCobertas: especialidades_count,
        vagasOcupadas: slots_ocupados_globais,
        vagasBloqueadas: slots_bloqueados_globais,
        vagasDisponiveis: vagas_livres_calculadas,
        totalEspera: espera_count
      }
    end
  end
end