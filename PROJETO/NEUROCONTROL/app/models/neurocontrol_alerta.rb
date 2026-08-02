class NeurocontrolAlerta < ApplicationRecord
  self.table_name = 'neurocontrol_alertas'
  belongs_to :paciente

  validates :mensagem, presence: true
end
