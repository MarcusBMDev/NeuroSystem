class NeurocontrolTabelaValor < ApplicationRecord
  self.table_name = 'neurocontrol_tabela_valores'
  belongs_to :convenio

  validates :especialidade, :codigo_tuss, :valor_sessao, presence: true
end
