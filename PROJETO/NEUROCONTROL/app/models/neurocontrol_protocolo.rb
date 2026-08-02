class NeurocontrolProtocolo < ApplicationRecord
  self.table_name = 'neurocontrol_protocolos'
  has_many :itens, class_name: 'NeurocontrolProtocoloItem', foreign_key: 'protocolo_id', dependent: :destroy

  validates :protocolo_numero, presence: true, uniqueness: true
end
