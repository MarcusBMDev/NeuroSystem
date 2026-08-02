class Agendamento < ApplicationRecord
  self.table_name = 'agendamentos'
  belongs_to :paciente
  belongs_to :profissional

  def readonly?
    true
  end
end
