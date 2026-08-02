class NeurocontrolSolicitacaoAlteracao < ApplicationRecord
  self.table_name = 'neurocontrol_solicitacoes_alteracao'
  belongs_to :paciente

  validates :tipo, :especialidade, :motivo, :solicitado_por, presence: true
end
