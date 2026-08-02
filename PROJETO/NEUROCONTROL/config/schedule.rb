every 4.hours do
  runner "SlaAuditorJob.perform_now"
end
