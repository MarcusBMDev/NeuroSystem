class NeurocontrolProtocoloItem < ApplicationRecord
  self.table_name = 'neurocontrol_protocolo_itens'
  belongs_to :protocolo, class_name: 'NeurocontrolProtocolo', foreign_key: 'protocolo_id'
  belongs_to :guia, class_name: 'NeurocontrolGuia', foreign_key: 'guia_id'
end
