class Convenio < ApplicationRecord
  self.table_name = 'convenios'
  has_many :pacientes

  def readonly?
    false
  end
end
