class Paciente < ApplicationRecord
  self.table_name = 'pacientes'

  belongs_to :convenio, optional: true
  has_many :neurocontrol_guias, class_name: 'NeurocontrolGuia', foreign_key: 'paciente_id'

  def readonly?
    false # Permite criação de novos pacientes no onboarding
  end
end
