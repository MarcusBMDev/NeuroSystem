class NeurocontrolNegociacao < ApplicationRecord
  self.table_name = 'neurocontrol_negociacoes'
  belongs_to :paciente
  belongs_to :profissional, optional: true

  validates :valor_diferenciado, :tipo_negocio, presence: true
end
