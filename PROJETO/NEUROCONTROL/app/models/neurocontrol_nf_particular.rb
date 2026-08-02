class NeurocontrolNfParticular < ApplicationRecord
  self.table_name = 'neurocontrol_nf_particulares'

  validates :paciente_nome, :terapia_procedimento, :valor_final, :mes_competencia, presence: true
end
