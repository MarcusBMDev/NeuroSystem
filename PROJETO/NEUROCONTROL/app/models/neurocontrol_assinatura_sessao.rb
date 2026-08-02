class NeurocontrolAssinaturaSessao < ApplicationRecord
  self.table_name = 'neurocontrol_assinaturas_sessoes'
  belongs_to :guia, class_name: 'NeurocontrolGuia', foreign_key: 'guia_id'

  validates :data_sessao, presence: true
end
