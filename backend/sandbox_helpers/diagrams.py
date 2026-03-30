"""Mermaid diagram helpers for the OneGS theme.

Auto-imported into every run_python sandbox call.
"""

GS_MERMAID_THEME = """\
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'background': '#090d16',
    'primaryColor': '#12172b',
    'primaryTextColor': '#e8ecf4',
    'primaryBorderColor': '#3d7be8',
    'lineColor': '#5c6278',
    'secondaryColor': '#1a2038',
    'secondaryTextColor': '#8494ad',
    'secondaryBorderColor': '#2eb89a',
    'tertiaryColor': '#0d1220',
    'tertiaryTextColor': '#8494ad',
    'tertiaryBorderColor': '#5c6278',
    'edgeLabelBackground': '#12172b',
    'titleColor': '#e8ecf4',
    'textColor': '#8494ad',
    'clusterBkg': '#0d1220',
    'clusterBorder': 'rgba(61,123,232,0.2)',
    'fontFamily': 'IBM Plex Sans, Inter, system-ui, sans-serif',
    'noteTextColor': '#e8ecf4',
    'noteBkgColor': '#1a2038',
    'noteBorderColor': 'rgba(61,123,232,0.3)',
    'actorBkg': '#12172b',
    'actorBorder': 'rgba(61,123,232,0.4)',
    'actorTextColor': '#e8ecf4',
    'actorLineColor': '#5c6278',
    'signalColor': '#8494ad',
    'signalTextColor': '#e8ecf4',
    'activationBorderColor': '#3d7be8',
    'activationBkgColor': 'rgba(61,123,232,0.12)'
  }
}}%%"""
"""Prepend this to any Mermaid diagram string for the GS dark theme.

Example:
    diagram = GS_MERMAID_THEME + '''
graph TD
    A[Start] --> B[Process]
    B --> C[End]
'''
    save_artifact(diagram, "My Diagram", artifact_type="diagram")
"""
