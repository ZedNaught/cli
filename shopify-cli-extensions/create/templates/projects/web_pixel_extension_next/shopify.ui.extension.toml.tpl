{{ template "shared/shopify.ui.extension.toml" . }}
runtime_context = "strict"

[configuration]
type = "object"

[configuration.fields.trackingId]
name = "Tracking Id"
description = "Tracking Id"
type = "single_line_text_field"
validations =  [
  { name = "min", value = "1" }
]
