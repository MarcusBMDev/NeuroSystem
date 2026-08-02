class NeurocontrolGuia < ApplicationRecord
  self.table_name = 'neurocontrol_guias'

  belongs_to :paciente
  has_many :assinaturas, class_name: 'NeurocontrolAssinaturaSessao', foreign_key: 'guia_id', dependent: :destroy
  has_many :protocolo_itens, class_name: 'NeurocontrolProtocoloItem', foreign_key: 'guia_id', dependent: :destroy

  validates :guia_numero, presence: true, uniqueness: true
  validates :quantidade_autorizada, :mes_vigente, :terapia, :data_pedido, presence: true
end
