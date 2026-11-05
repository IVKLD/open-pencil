import type { ShadrComponent } from "../types"

export const BUILTIN_COMPONENTS: Record<string, ShadrComponent> = {
  "badge": {
    "params": {
      "id": "badge",
      "label": "NEW",
      "width": 76,
      "height": 26,
      "color": "4cc9f0",
      "textColor": "08080b",
      "fontSize": 40
    },
    "blocks": [
      {
        "type": "progress",
        "id": "${id}",
        "layer": 13,
        "color": "${color}",
        "position": {
          "x": 0,
          "y": 0
        },
        "size": {
          "width": "${width}",
          "height": "${height}"
        },
        "children": [
          {
            "type": "text",
            "id": "${id}_label",
            "layer": 14,
            "color": "${textColor}",
            "position": {
              "x": "${width} / 2",
              "y": "${height} / 2 - 0.1514 * ${fontSize}"
            },
            "size": {
              "width": "${fontSize}",
              "height": "${fontSize}"
            },
            "text": "${label}",
            "font": "shadr_semibold",
            "textAlign": "center"
          }
        ]
      }
    ]
  },
  "button": {
    "params": {
      "id": "button",
      "label": "Button",
      "width": 180,
      "height": 44,
      "color": "4cc9f0",
      "textColor": "08080b",
      "fontSize": 64,
      "rounding": "small",
      "sound": "shadr.click"
    },
    "blocks": [
      {
        "type": "block_rounded",
        "id": "${id}",
        "layer": 12,
        "color": "${color}",
        "position": {
          "x": 0,
          "y": 0
        },
        "size": {
          "width": "${width}",
          "height": "${height}"
        },
        "rounding": {
          "size": "${rounding}"
        },
        "hoverEffect": "lift",
        "clickEffect": "press",
        "onClickAction": [
          "sound: ${sound}"
        ],
        "children": [
          {
            "type": "text",
            "id": "${id}_label",
            "layer": 13,
            "color": "${textColor}",
            "position": {
              "x": "${width} / 2",
              "y": "${height} / 2 - 0.1514 * ${fontSize}"
            },
            "size": {
              "width": "${fontSize}",
              "height": "${fontSize}"
            },
            "text": "${label}",
            "font": "shadr_semibold",
            "textAlign": "center"
          }
        ]
      }
    ]
  },
  "button_ghost": {
    "params": {
      "id": "button_ghost",
      "label": "Cancel",
      "width": 120,
      "height": 44,
      "color": "26262f",
      "border": "3a3a48",
      "textColor": "d8d8e2",
      "fontSize": 64,
      "rounding": "small",
      "sound": "shadr.click"
    },
    "blocks": [
      {
        "type": "block_rounded",
        "id": "${id}",
        "layer": 12,
        "color": "${color}",
        "position": {
          "x": 0,
          "y": 0
        },
        "size": {
          "width": "${width}",
          "height": "${height}"
        },
        "rounding": {
          "size": "${rounding}"
        },
        "outline": {
          "size": 1,
          "color": "${border}"
        },
        "hoverEffect": "lift",
        "clickEffect": "press",
        "onClickAction": [
          "sound: ${sound}"
        ],
        "children": [
          {
            "type": "text",
            "id": "${id}_label",
            "layer": 13,
            "color": "${textColor}",
            "position": {
              "x": "${width} / 2",
              "y": "${height} / 2 - 0.1514 * ${fontSize}"
            },
            "size": {
              "width": "${fontSize}",
              "height": "${fontSize}"
            },
            "text": "${label}",
            "textAlign": "center"
          }
        ]
      }
    ]
  },
  "divider": {
    "params": {
      "id": "divider",
      "width": 400,
      "color": "2a2a36",
      "thickness": 1
    },
    "blocks": [
      {
        "type": "block",
        "id": "${id}",
        "layer": 11,
        "color": "${color}",
        "position": {
          "x": 0,
          "y": 0
        },
        "size": {
          "width": "${width}",
          "height": "${thickness}"
        }
      }
    ]
  },
  "list_row": {
    "params": {
      "id": "row",
      "label": "Label",
      "value": "Value",
      "width": 440,
      "height": 52,
      "labelColor": "c8c8d4",
      "valueColor": "8a8a98",
      "fontSize": 60,
      "sound": "shadr.hover"
    },
    "blocks": [
      {
        "type": "block",
        "id": "${id}",
        "layer": 11,
        "color": "15151c",
        "opacity": 0,
        "position": {
          "x": 0,
          "y": 0
        },
        "size": {
          "width": "${width}",
          "height": "${height}"
        },
        "children": [
          {
            "type": "text",
            "id": "${id}_label",
            "layer": 12,
            "color": "${labelColor}",
            "position": {
              "x": 0,
              "y": "${height} / 2 - 0.1514 * ${fontSize}"
            },
            "size": {
              "width": "${fontSize}",
              "height": "${fontSize}"
            },
            "text": "${label}",
            "textAlign": "left"
          },
          {
            "type": "text",
            "id": "${id}_value",
            "layer": 12,
            "color": "${valueColor}",
            "position": {
              "x": "${width}",
              "y": "${height} / 2 - 0.1514 * ${fontSize}"
            },
            "size": {
              "width": "${fontSize}",
              "height": "${fontSize}"
            },
            "text": "${value}",
            "textAlign": "right"
          },
          {
            "type": "block",
            "id": "${id}_rule",
            "layer": 11.5,
            "color": "24242e",
            "position": {
              "x": 0,
              "y": "${height} - 1"
            },
            "size": {
              "width": "${width}",
              "height": 1
            }
          }
        ]
      }
    ]
  },
  "modal": {
    "params": {
      "id": "modal",
      "title": "Are you sure?",
      "body": "This cannot be undone.",
      "confirmLabel": "Confirm",
      "cancelLabel": "Cancel",
      "width": 460,
      "height": 220,
      "accent": "f0a04c"
    },
    "blocks": [
      {
        "type": "block",
        "id": "${id}_scrim",
        "layer": 40,
        "color": 0,
        "opacity": 170,
        "position": {
          "x": 0,
          "y": 0
        },
        "size": {
          "width": 1920,
          "height": 1080
        },
        "onClickAction": [
          "sound: shadr.hover"
        ]
      },
      {
        "type": "block_rounded",
        "id": "${id}",
        "layer": 41,
        "color": "16161d",
        "position": {
          "x": "1920 / 2 - ${width} / 2",
          "y": "1080 / 2 - ${height} / 2"
        },
        "size": {
          "width": "${width}",
          "height": "${height}"
        },
        "rounding": {
          "size": "regular"
        },
        "outline": {
          "size": 1,
          "color": "2f2f3c"
        },
        "children": [
          {
            "type": "text",
            "id": "${id}_title",
            "layer": 42,
            "color": "f2f2f7",
            "position": {
              "x": 32,
              "y": 30
            },
            "size": {
              "width": 76,
              "height": 76
            },
            "text": "${title}",
            "font": "shadr_semibold",
            "textAlign": "left"
          },
          {
            "type": "text",
            "id": "${id}_body",
            "layer": 42,
            "color": "9a9aa8",
            "position": {
              "x": 32,
              "y": 74
            },
            "size": {
              "width": 54,
              "height": 54
            },
            "lineWidth": 360,
            "text": "${body}",
            "textAlign": "left"
          },
          {
            "type": "block_rounded",
            "id": "${id}_confirm",
            "layer": 43,
            "color": "${accent}",
            "position": {
              "x": "${width} - 300",
              "y": "${height} - 66"
            },
            "size": {
              "width": 140,
              "height": 44
            },
            "rounding": {
              "size": "small"
            },
            "hoverEffect": "lift",
            "clickEffect": "press",
            "onClickAction": [
              "sound: shadr.click",
              "close: "
            ],
            "children": [
              {
                "type": "text",
                "id": "${id}_confirm_label",
                "layer": 44,
                "color": "08080b",
                "position": {
                  "x": 70,
                  "y": "44 / 2 - 0.1514 * 60"
                },
                "size": {
                  "width": 60,
                  "height": 60
                },
                "text": "${confirmLabel}",
                "font": "shadr_semibold",
                "textAlign": "center"
              }
            ]
          },
          {
            "type": "block_rounded",
            "id": "${id}_cancel",
            "layer": 43,
            "color": "26262f",
            "position": {
              "x": "${width} - 148",
              "y": "${height} - 66"
            },
            "size": {
              "width": 116,
              "height": 44
            },
            "rounding": {
              "size": "small"
            },
            "outline": {
              "size": 1,
              "color": "3a3a48"
            },
            "hoverEffect": "lift",
            "clickEffect": "press",
            "onClickAction": [
              "sound: shadr.close",
              "close: "
            ],
            "children": [
              {
                "type": "text",
                "id": "${id}_cancel_label",
                "layer": 44,
                "color": "d8d8e2",
                "position": {
                  "x": 58,
                  "y": "44 / 2 - 0.1514 * 60"
                },
                "size": {
                  "width": 60,
                  "height": 60
                },
                "text": "${cancelLabel}",
                "textAlign": "center"
              }
            ]
          }
        ]
      }
    ]
  },
  "panel": {
    "params": {
      "id": "panel",
      "title": "Panel",
      "width": 520,
      "height": 340,
      "color": "15151c",
      "border": "2a2a36",
      "accent": "4cc9f0",
      "titleSize": 72
    },
    "blocks": [
      {
        "type": "block_rounded",
        "id": "${id}",
        "layer": 10,
        "color": "${color}",
        "position": {
          "x": 0,
          "y": 0
        },
        "size": {
          "width": "${width}",
          "height": "${height}"
        },
        "rounding": {
          "size": "regular"
        },
        "outline": {
          "size": 1,
          "color": "${border}"
        },
        "children": [
          {
            "type": "block",
            "id": "${id}_accent",
            "layer": 11,
            "color": "${accent}",
            "position": {
              "x": 24,
              "y": 26
            },
            "size": {
              "width": 3,
              "height": "${titleSize} * 0.62"
            }
          },
          {
            "type": "text",
            "id": "${id}_title",
            "layer": 11,
            "color": "f2f2f7",
            "position": {
              "x": 38,
              "y": 26
            },
            "size": {
              "width": "${titleSize}",
              "height": "${titleSize}"
            },
            "text": "${title}",
            "font": "shadr_semibold",
            "textAlign": "left"
          },
          {
            "type": "block",
            "id": "${id}_rule",
            "layer": 11,
            "color": "${border}",
            "position": {
              "x": 24,
              "y": "26 + ${titleSize} * 0.9"
            },
            "size": {
              "width": "${width} - 48",
              "height": 1
            }
          }
        ]
      }
    ]
  },
  "progress_bar": {
    "params": {
      "id": "progress",
      "width": 400,
      "height": 8,
      "value": 0.5,
      "color": "4cc9f0",
      "track": "26262f"
    },
    "blocks": [
      {
        "type": "progress",
        "id": "${id}_track",
        "layer": 11,
        "color": "${track}",
        "position": {
          "x": 0,
          "y": 0
        },
        "size": {
          "width": "${width}",
          "height": "${height}"
        },
        "children": [
          {
            "type": "progress",
            "id": "${id}_fill",
            "layer": 12,
            "color": "${color}",
            "position": {
              "x": 0,
              "y": 0
            },
            "size": {
              "width": "${width} * ${value}",
              "height": "${height}"
            }
          }
        ]
      }
    ]
  },
  "section_header": {
    "params": {
      "id": "section",
      "label": "Section",
      "color": "8a8a98",
      "fontSize": 48
    },
    "blocks": [
      {
        "type": "text",
        "id": "${id}",
        "layer": 12,
        "color": "${color}",
        "position": {
          "x": 0,
          "y": 0
        },
        "size": {
          "width": "${fontSize}",
          "height": "${fontSize}"
        },
        "text": "${label}",
        "textAlign": "left"
      }
    ]
  },
  "stat_chip": {
    "params": {
      "id": "chip",
      "label": "Label",
      "value": "0",
      "accent": "4cc9f0",
      "width": 162
    },
    "blocks": [
      {
        "type": "block_rounded",
        "id": "${id}",
        "layer": 10,
        "color": "15151c",
        "opacity": 255,
        "position": {
          "x": 0,
          "y": 0
        },
        "size": {
          "width": "${width}",
          "height": 88
        },
        "rounding": {
          "size": "small"
        },
        "outline": {
          "size": 1,
          "color": "2a2a36"
        },
        "children": [
          {
            "type": "block",
            "id": "${id}_accent",
            "layer": 11,
            "color": "${accent}",
            "position": {
              "x": 0,
              "y": 0
            },
            "size": {
              "width": 3,
              "height": 88
            }
          },
          {
            "type": "text",
            "id": "${id}_label",
            "layer": 12,
            "color": "8a8a98",
            "position": {
              "x": 18,
              "y": 20
            },
            "size": {
              "width": 52,
              "height": 52
            },
            "text": "${label}",
            "textAlign": "left"
          },
          {
            "type": "text",
            "id": "${id}_value",
            "layer": 12,
            "color": "f2f2f7",
            "position": {
              "x": 18,
              "y": 51
            },
            "size": {
              "width": 72,
              "height": 72
            },
            "text": "${value}",
            "font": "shadr_semibold",
            "textAlign": "left"
          }
        ]
      }
    ]
  },
  "tab": {
    "params": {
      "id": "tab",
      "label": "Tab",
      "width": 130,
      "height": 46,
      "color": "8a8a98",
      "underline": "15151c",
      "fontSize": 56
    },
    "blocks": [
      {
        "type": "block",
        "id": "${id}",
        "layer": 12,
        "color": "15151c",
        "opacity": 0,
        "position": {
          "x": 0,
          "y": 0
        },
        "size": {
          "width": "${width}",
          "height": "${height}"
        },
        "hoverEffect": "lift",
        "onClickAction": [
          "sound: shadr.click"
        ],
        "children": [
          {
            "type": "text",
            "id": "${id}_label",
            "layer": 13,
            "color": "${color}",
            "position": {
              "x": "${width} / 2",
              "y": "${height} / 2 - 0.1514 * ${fontSize} - 3"
            },
            "size": {
              "width": "${fontSize}",
              "height": "${fontSize}"
            },
            "text": "${label}",
            "font": "shadr_semibold",
            "textAlign": "center"
          },
          {
            "type": "block",
            "id": "${id}_underline",
            "layer": 13,
            "color": "${underline}",
            "position": {
              "x": 0,
              "y": "${height} - 2"
            },
            "size": {
              "width": "${width}",
              "height": 2
            }
          }
        ]
      }
    ]
  },
  "toast": {
    "params": {
      "id": "toast",
      "title": "Saved",
      "body": "Your changes are live.",
      "width": 380,
      "height": 76,
      "accent": "70e000"
    },
    "blocks": [
      {
        "type": "block_rounded",
        "id": "${id}",
        "layer": 70,
        "color": "16161d",
        "opacity": 250,
        "position": {
          "x": 0,
          "y": 0
        },
        "size": {
          "width": "${width}",
          "height": "${height}"
        },
        "rounding": {
          "size": "small"
        },
        "outline": {
          "size": 1,
          "color": "2a2a36"
        },
        "children": [
          {
            "type": "progress",
            "id": "${id}_bar",
            "layer": 71,
            "color": "${accent}",
            "position": {
              "x": 12,
              "y": 14
            },
            "size": {
              "width": 4,
              "height": "${height} - 28"
            }
          },
          {
            "type": "text",
            "id": "${id}_title",
            "layer": 71,
            "color": "f2f2f7",
            "position": {
              "x": 28,
              "y": 16
            },
            "size": {
              "width": 56,
              "height": 56
            },
            "text": "${title}",
            "font": "shadr_semibold",
            "textAlign": "left"
          },
          {
            "type": "text",
            "id": "${id}_body",
            "layer": 71,
            "color": "9a9aa8",
            "position": {
              "x": 28,
              "y": 44
            },
            "size": {
              "width": 46,
              "height": 46
            },
            "lineWidth": 260,
            "text": "${body}",
            "textAlign": "left"
          }
        ]
      }
    ]
  },
  "tooltip": {
    "params": {
      "id": "tooltip",
      "title": "Title",
      "body": "Explanation goes here.",
      "width": 320,
      "height": 92,
      "accent": "4cc9f0"
    },
    "blocks": [
      {
        "type": "block_rounded",
        "id": "${id}",
        "layer": 60,
        "color": "0d0d12",
        "opacity": 245,
        "position": {
          "x": 0,
          "y": 0
        },
        "size": {
          "width": "${width}",
          "height": "${height}"
        },
        "rounding": {
          "size": "small"
        },
        "outline": {
          "size": 1,
          "color": "${accent}"
        },
        "children": [
          {
            "type": "text",
            "id": "${id}_title",
            "layer": 61,
            "color": "f2f2f7",
            "position": {
              "x": 16,
              "y": 14
            },
            "size": {
              "width": 56,
              "height": 56
            },
            "text": "${title}",
            "font": "shadr_semibold",
            "textAlign": "left"
          },
          {
            "type": "text",
            "id": "${id}_body",
            "layer": 61,
            "color": "9a9aa8",
            "position": {
              "x": 16,
              "y": 44
            },
            "size": {
              "width": 48,
              "height": 48
            },
            "lineWidth": 200,
            "text": "${body}",
            "textAlign": "left"
          }
        ]
      }
    ]
  }
}
