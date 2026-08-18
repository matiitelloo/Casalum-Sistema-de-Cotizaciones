/** Escapa HTML para insertar texto de usuario en innerHTML sin riesgo de XSS. */
window.escapeHtml = function (value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

/**
 * Logos de proveedor por clave de marca. Va aparte de SEED_DATA porque
 * SEED_DATA.brands se sobrescribe entero al cargar el catálogo guardado
 * (Firestore/localStorage) — meterlo ahí perdería el logo en cuanto
 * terminara esa carga.
 */
window.BRAND_LOGOS = {
  femec: 'assets/brands/femec.png',
  fisa: 'assets/brands/fisa.png',
  cedal: 'assets/brands/cedal.png'
};

/** Muestra/oculta el <img> de logo de proveedor junto a un selector de marca. */
window.updateBrandLogo = function (imgId, brandKey) {
  const img = document.getElementById(imgId);
  if (!img) return;
  const src = window.BRAND_LOGOS[brandKey];
  if (src) {
    // Si el archivo del logo todavía no existe, se oculta en vez de mostrar
    // el ícono de imagen rota.
    img.onerror = () => { img.style.display = 'none'; };
    img.src = src;
    img.alt = brandKey;
    img.style.display = '';
  } else {
    img.style.display = 'none';
  }
};

window.SEED_DATA = {
  brands: {
  "femec": {
    "name": "Femec",
    "colors": [
      "natural",
      "negro",
      "blanco",
      "maderado",
      "grises",
      "champagne"
    ],
    "categories": {
      "Ventana Corrediza 1300": {
        "products": [
          {
            "code": "FEM-VER9091",
            "description": "VERTICAL DE HOJA CERRADO",
            "unit": "ml",
            "prices": {
              "natural": 3.22,
              "negro": 3.22,
              "blanco": 3.22,
              "maderado": 4.44,
              "grises": 3.35,
              "champagne": 3.48
            }
          },
          {
            "code": "FEM-RIE5630",
            "description": "RIEL SUPERIOR E INFERIOR",
            "unit": "ml",
            "prices": {
              "natural": 3.01,
              "negro": 3.01,
              "blanco": 3.01,
              "maderado": 4.36,
              "grises": 3.2,
              "champagne": 3.39
            }
          },
          {
            "code": "FEM-HOR5011",
            "description": "HORIZONTAL DE HOJA",
            "unit": "ml",
            "prices": {
              "natural": 2.91,
              "negro": 2.91,
              "blanco": 2.91,
              "maderado": 4.04,
              "grises": 3.14,
              "champagne": 3.59
            }
          },
          {
            "code": "FEM-JAM2160",
            "description": "JAMBA MARCO",
            "unit": "ml",
            "prices": {
              "natural": 3.1,
              "negro": 3.1,
              "blanco": 3.1,
              "maderado": 4.42,
              "grises": 3.3,
              "champagne": 3.55
            }
          },
          {
            "code": "FEM-VER4886",
            "description": "VERTICAL DE HOJA ABIERTO",
            "unit": "ml",
            "prices": {
              "natural": 2.49,
              "negro": 2.49,
              "blanco": 2.49,
              "maderado": 3.52,
              "grises": 2.73,
              "champagne": 3.2
            }
          },
          {
            "code": "FEM-VER4819",
            "description": "VERTICAL DE HOJA CERRADO ECO",
            "unit": "ml",
            "prices": {
              "natural": 2.67,
              "negro": 2.67,
              "blanco": 2.67,
              "maderado": 4.05,
              "grises": 3.29,
              "champagne": 3.64
            }
          },
          {
            "code": "FEM-MAL8147",
            "description": "MALLA CORREDIZA",
            "unit": "ml",
            "prices": {
              "natural": 1.48,
              "negro": 1.48,
              "blanco": 1.48,
              "maderado": 1.85,
              "grises": 1.54,
              "champagne": 1.68
            }
          },
          {
            "code": "FEM-VER1829",
            "description": "VERTICAL DE HOJA ABIERTO 2",
            "unit": "ml",
            "prices": {
              "natural": 2.49,
              "negro": 2.49,
              "blanco": 2.49,
              "maderado": 3.72,
              "grises": 2.73,
              "champagne": 2.99
            }
          },
          {
            "code": "FEM-MAL7849",
            "description": "MALLA CORREDIZA 2",
            "unit": "ml",
            "prices": {
              "natural": 1.48,
              "negro": 1.48,
              "blanco": 1.48,
              "maderado": 2.08,
              "grises": 1.54,
              "champagne": 1.54
            }
          },
          {
            "code": "FEM-VER1936",
            "description": "VERTICAL DE HOJA CERRADO PES",
            "unit": "ml",
            "prices": {
              "natural": 3.22,
              "negro": 3.22,
              "blanco": 3.22,
              "maderado": 4.45,
              "grises": 3.55,
              "champagne": 4.01
            }
          },
          {
            "code": "FEM-HOR2203",
            "description": "HORIZONTAL DE HOJA 2",
            "unit": "ml",
            "prices": {
              "natural": 2.87,
              "negro": 2.87,
              "blanco": 2.87,
              "maderado": 4.37,
              "grises": 3.09,
              "champagne": 3.41
            }
          }
        ]
      },
      "Ventana Fija Estandar": {
        "products": [
          {
            "code": "FEM-HOR6094",
            "description": "HORIZONTAL/VERTICAL CON TORNILLERO",
            "unit": "ml",
            "prices": {
              "natural": 3.31,
              "negro": 3.31,
              "blanco": 3.31,
              "maderado": 4.58,
              "grises": 3.4,
              "champagne": 3.61
            }
          },
          {
            "code": "FEM-HOR2125",
            "description": "HORIZONTAL/VERTICAL SIN TORNILLERO",
            "unit": "ml",
            "genericRoles": ["ventana-fija-1100-horizontal", "ventana-fija-1100-vertical"],
            "prices": {
              "natural": 3.01,
              "negro": 3.01,
              "blanco": 3.01,
              "maderado": 3.92,
              "grises": 3.49,
              "champagne": 3.55
            }
          },
          {
            "code": "FEM-JUN0896",
            "description": "JUNQUILLO",
            "unit": "ml",
            "genericRoles": ["ventana-fija-1100-junquillo"],
            "prices": {
              "natural": 1.33,
              "negro": 1.33,
              "blanco": 1.33,
              "maderado": 1.96,
              "grises": 1.4,
              "champagne": 1.5
            }
          }
        ]
      },
      "Ventana Proyectable": {
        "products": [
          {
            "code": "FEM-DIV7153",
            "description": "DIVISOR (VP)",
            "unit": "ml",
            "prices": {
              "natural": 5.95,
              "negro": 5.95,
              "blanco": 5.95,
              "maderado": 8.24,
              "grises": 6.33,
              "champagne": 6.6
            }
          },
          {
            "code": "FEM-JUN0696",
            "description": "JUNQUILLO",
            "unit": "ml",
            "prices": {
              "natural": 1.82,
              "negro": 1.82,
              "blanco": 1.82,
              "maderado": 2.53,
              "grises": 1.92,
              "champagne": 1.96
            }
          },
          {
            "code": "FEM-HOJ6114",
            "description": "HOJA",
            "unit": "ml",
            "prices": {
              "natural": 4.59,
              "negro": 4.59,
              "blanco": 4.59,
              "maderado": 6.07,
              "grises": 5.0,
              "champagne": 5.46
            }
          },
          {
            "code": "FEM-MAR0620",
            "description": "MARCO",
            "unit": "ml",
            "prices": {
              "natural": 3.22,
              "negro": 3.22,
              "blanco": 3.22,
              "maderado": 4.16,
              "grises": 3.29,
              "champagne": 3.24
            }
          },
          {
            "code": "FEM-JUN0740",
            "description": "JUNQUILLO 2",
            "unit": "ml",
            "prices": {
              "natural": 1.82,
              "negro": 1.82,
              "blanco": 1.82,
              "maderado": 2.59,
              "grises": 1.87,
              "champagne": 1.95
            }
          }
        ]
      },
      "Puerta Corrediza Estandar": {
        "products": [
          {
            "code": "FEM-RIE6530",
            "description": "RIEL SUPERIOR (PCS)",
            "unit": "ml",
            "prices": {
              "natural": 5.14,
              "negro": 5.14,
              "blanco": 5.14,
              "maderado": 7.16,
              "grises": 5.47,
              "champagne": 5.65
            }
          },
          {
            "code": "FEM-JAM4989",
            "description": "JAMBA MARCO (PCS)",
            "unit": "ml",
            "prices": {
              "natural": 5.86,
              "negro": 5.86,
              "blanco": 5.86,
              "maderado": 8.18,
              "grises": 6.29,
              "champagne": 6.64
            }
          },
          {
            "code": "FEM-VER2244",
            "description": "VERTICAL ENTRECIERRE",
            "unit": "ml",
            "prices": {
              "natural": 4.97,
              "negro": 4.97,
              "blanco": 4.97,
              "maderado": 6.64,
              "grises": 5.13,
              "champagne": 5.42
            }
          },
          {
            "code": "FEM-VER7561",
            "description": "VERTICAL (PCS)",
            "unit": "ml",
            "prices": {
              "natural": 3.44,
              "negro": 3.44,
              "blanco": 3.44,
              "maderado": 4.79,
              "grises": 3.65,
              "champagne": 3.92
            }
          },
          {
            "code": "FEM-RIE2397",
            "description": "RIEL INFERIOR (PCS)",
            "unit": "ml",
            "prices": {
              "natural": 5.14,
              "negro": 5.14,
              "blanco": 5.14,
              "maderado": 6.64,
              "grises": 5.43,
              "champagne": 5.67
            }
          },
          {
            "code": "FEM-VER3505",
            "description": "VERTICAL HOJA PESADO",
            "unit": "ml",
            "prices": {
              "natural": 6.47,
              "negro": 6.47,
              "blanco": 6.47,
              "maderado": 7.99,
              "grises": 6.91,
              "champagne": 7.33
            }
          },
          {
            "code": "FEM-HOR1904",
            "description": "HORIZONTAL INFERIOR",
            "unit": "ml",
            "prices": {
              "natural": 5.14,
              "negro": 5.14,
              "blanco": 5.14,
              "maderado": 6.99,
              "grises": 6.1,
              "champagne": 6.38
            }
          },
          {
            "code": "FEM-HOR6409",
            "description": "HORIZONTAL SUPERIOR",
            "unit": "ml",
            "prices": {
              "natural": 4.27,
              "negro": 4.27,
              "blanco": 4.27,
              "maderado": 6.07,
              "grises": 4.5,
              "champagne": 4.43
            }
          }
        ]
      },
      "Alfajias": {
        "products": [
          {
            "code": "FEM-ALF3410",
            "description": "ALFAJIA-114",
            "unit": "ml",
            "prices": {
              "natural": 3.66,
              "negro": 3.66,
              "blanco": 3.66,
              "maderado": null,
              "grises": null,
              "champagne": null
            }
          },
          {
            "code": "FEM-ALF9812",
            "description": "ALFAJIA-160",
            "unit": "ml",
            "prices": {
              "natural": 5.62,
              "negro": 5.62,
              "blanco": 5.62,
              "maderado": 7.92,
              "grises": 6.04,
              "champagne": 6.45
            }
          }
        ]
      },
      "Tubos con Aleta": {
        "products": [
          {
            "code": "FEM-CAN6209",
            "description": "CANAL CON ALETA 3X1",
            "unit": "ml",
            "prices": {
              "natural": 4.42,
              "negro": 4.42,
              "blanco": 4.42,
              "maderado": 6.55,
              "grises": 4.7,
              "champagne": 4.78
            }
          },
          {
            "code": "FEM-TUB3300",
            "description": "TUBO CON ALETA 3X1",
            "unit": "ml",
            "prices": {
              "natural": 6.56,
              "negro": 6.56,
              "blanco": 6.56,
              "maderado": 8.89,
              "grises": 6.81,
              "champagne": 7.15
            }
          }
        ]
      },
      "Tubos Rectangulares": {
        "products": [
          {
            "code": "FEM-TUB7097",
            "description": "TUBO RECTANGULAR 4 X 1-1/2",
            "unit": "ml",
            "prices": {
              "natural": 8.4,
              "negro": 8.4,
              "blanco": 8.4,
              "maderado": 11.59,
              "grises": 8.56,
              "champagne": 8.7
            }
          },
          {
            "code": "FEM-TUB5934",
            "description": "TUBO RECTANGULAR 3 X 1-1/2",
            "unit": "ml",
            "prices": {
              "natural": 6.0,
              "negro": 6.0,
              "blanco": 6.0,
              "maderado": 8.06,
              "grises": 6.37,
              "champagne": 6.35
            }
          },
          {
            "code": "FEM-TUB4153",
            "description": "TUBO RECTANGULAR 3 X 1",
            "unit": "ml",
            "prices": {
              "natural": 6.32,
              "negro": 6.32,
              "blanco": 6.32,
              "maderado": 8.66,
              "grises": 6.86,
              "champagne": 7.11
            }
          },
          {
            "code": "FEM-TUB5646",
            "description": "TUBO RECTANGULAR 2 X 1-1/2",
            "unit": "ml",
            "prices": {
              "natural": 4.75,
              "negro": 4.75,
              "blanco": 4.75,
              "maderado": 6.36,
              "grises": 4.87,
              "champagne": 4.93
            }
          },
          {
            "code": "FEM-TUB7189",
            "description": "TUBO RECTANGULAR 50X25MM",
            "unit": "ml",
            "prices": {
              "natural": 3.88,
              "negro": 3.88,
              "blanco": 3.88,
              "maderado": 5.34,
              "grises": 3.98,
              "champagne": 4.08
            }
          },
          {
            "code": "FEM-TUB7607",
            "description": "TUBO RECTANGULAR 50X40MM",
            "unit": "ml",
            "prices": {
              "natural": 4.75,
              "negro": 4.75,
              "blanco": 4.75,
              "maderado": 6.43,
              "grises": 5.18,
              "champagne": 5.44
            }
          },
          {
            "code": "FEM-TUB9210",
            "description": "TUBO RECTANGULAR 70X30MM",
            "unit": "ml",
            "prices": {
              "natural": 5.62,
              "negro": 5.62,
              "blanco": 5.62,
              "maderado": 7.25,
              "grises": 6.09,
              "champagne": 6.49
            }
          },
          {
            "code": "FEM-TUB5628",
            "description": "TUBO RECTANGULAR 40X60MM",
            "unit": "ml",
            "prices": {
              "natural": 27.67,
              "negro": 27.67,
              "blanco": 27.67,
              "maderado": 30.99,
              "grises": 28.52,
              "champagne": 29.23
            }
          },
          {
            "code": "FEM-TUB9438",
            "description": "TUBO RECTANGULAR 75X25MM",
            "unit": "ml",
            "prices": {
              "natural": 6.0,
              "negro": 6.0,
              "blanco": 6.0,
              "maderado": 7.59,
              "grises": 6.73,
              "champagne": 6.76
            }
          },
          {
            "code": "FEM-TUB6469",
            "description": "TUBO RECTANGULAR 2-3/4 X 1-1/4",
            "unit": "ml",
            "prices": {
              "natural": 5.62,
              "negro": 5.62,
              "blanco": 5.62,
              "maderado": 7.29,
              "grises": 6.04,
              "champagne": 6.26
            }
          },
          {
            "code": "FEM-TUB8540",
            "description": "TUBO RECTANGULAR 1-1/2 X 3/4",
            "unit": "ml",
            "prices": {
              "natural": 2.87,
              "negro": 2.87,
              "blanco": 2.87,
              "maderado": 3.98,
              "grises": 2.98,
              "champagne": 3.06
            }
          },
          {
            "code": "FEM-TUB4946",
            "description": "TUBO RECTANGULAR 150X75MM",
            "unit": "ml",
            "prices": {
              "natural": 29.85,
              "negro": 29.85,
              "blanco": 29.85,
              "maderado": 34.77,
              "grises": 31.24,
              "champagne": 32.68
            }
          },
          {
            "code": "FEM-TUB5744",
            "description": "TUBO RECTANGULAR 2-3/4 X 1-1/4 X 1.2MM",
            "unit": "ml",
            "prices": {
              "natural": 5.51,
              "negro": 5.51,
              "blanco": 5.51,
              "maderado": 7.29,
              "grises": 5.92,
              "champagne": 6.26
            }
          },
          {
            "code": "FEM-TUB9897",
            "description": "TUBO RECTANGULAR 100X40X1.4",
            "unit": "ml",
            "prices": {
              "natural": 8.24,
              "negro": 8.24,
              "blanco": 8.24,
              "maderado": 12.1,
              "grises": 8.71,
              "champagne": 9.5
            }
          }
        ]
      },
      "Tubos Cuadrados": {
        "products": [
          {
            "code": "FEM-TUB4277",
            "description": "TUBO CUADRADO 1-1/4",
            "unit": "ml",
            "prices": {
              "natural": 2.79,
              "negro": 2.79,
              "blanco": 2.79,
              "maderado": 3.87,
              "grises": 3.26,
              "champagne": 3.31
            }
          },
          {
            "code": "FEM-TUB6651",
            "description": "TUBO CUADRADO 1-1/2",
            "unit": "ml",
            "prices": {
              "natural": 3.61,
              "negro": 3.61,
              "blanco": 3.61,
              "maderado": 4.66,
              "grises": 3.83,
              "champagne": 4.0
            }
          },
          {
            "code": "FEM-TUB8630",
            "description": "TUBO CUADRADO 25X25MM",
            "unit": "ml",
            "prices": {
              "natural": 2.27,
              "negro": 2.27,
              "blanco": 2.27,
              "maderado": 2.84,
              "grises": 2.34,
              "champagne": 2.46
            }
          },
          {
            "code": "FEM-TUB2329",
            "description": "TUBO CUADRADO 40X40MM",
            "unit": "ml",
            "prices": {
              "natural": 12.77,
              "negro": 12.77,
              "blanco": 12.77,
              "maderado": 17.24,
              "grises": 15.7,
              "champagne": 16.2
            }
          },
          {
            "code": "FEM-TUB6833",
            "description": "TUBO CUADRADO 30X30MM",
            "unit": "ml",
            "prices": {
              "natural": 2.79,
              "negro": 2.79,
              "blanco": 2.79,
              "maderado": 3.94,
              "grises": 2.94,
              "champagne": 3.06
            }
          },
          {
            "code": "FEM-TUB4717",
            "description": "TUBO CUADRADO 40X40 2",
            "unit": "ml",
            "prices": {
              "natural": 3.52,
              "negro": 3.52,
              "blanco": 3.52,
              "maderado": 4.97,
              "grises": 3.68,
              "champagne": 3.71
            }
          },
          {
            "code": "FEM-TUB6684",
            "description": "TUBO CUADRADO 120X120MM",
            "unit": "ml",
            "prices": {
              "natural": 20.19,
              "negro": 20.19,
              "blanco": 20.19,
              "maderado": 24.28,
              "grises": 21.01,
              "champagne": 21.45
            }
          },
          {
            "code": "FEM-TUB5407",
            "description": "TUBO CUADRADO 120X120X1.7MM",
            "unit": "ml",
            "prices": {
              "natural": 19.79,
              "negro": 19.79,
              "blanco": 19.79,
              "maderado": 24.28,
              "grises": 20.6,
              "champagne": 21.45
            }
          },
          {
            "code": "FEM-TUB1214",
            "description": "TUBO CUADRADO 1-1/2 X 1.1MM",
            "unit": "ml",
            "prices": {
              "natural": 3.25,
              "negro": 3.25,
              "blanco": 3.25,
              "maderado": 4.36,
              "grises": 3.45,
              "champagne": 3.69
            }
          }
        ]
      }
    }
  },
  "cedal": {
    "name": "Cedal",
    "colors": [
      "natural",
      "negro",
      "blanco",
      "maderado",
      "champagne"
    ],
    "categories": {
      "Ventana Corrediza 1300": {
        "products": [
          {
            "code": "CED-VER7326",
            "description": "VERTICAL CERRADO",
            "unit": "ml",
            "prices": {
              "natural": 3.45,
              "negro": 3.55,
              "blanco": 3.54,
              "maderado": 6.28,
              "champagne": 4.36
            }
          },
          {
            "code": "CED-RIE9877",
            "description": "RIE. SUPERIOR/INFERIOR",
            "unit": "ml",
            "prices": {
              "natural": 3.45,
              "negro": 3.77,
              "blanco": 3.37,
              "maderado": 5.55,
              "champagne": 4.09
            }
          },
          {
            "code": "CED-HOR7739",
            "description": "HORIZONTAL",
            "unit": "ml",
            "prices": {
              "natural": 3.25,
              "negro": 3.57,
              "blanco": 3.18,
              "maderado": 5.77,
              "champagne": 3.81
            }
          },
          {
            "code": "CED-JAM6376",
            "description": "JAMBA",
            "unit": "ml",
            "prices": {
              "natural": 3.57,
              "negro": 3.89,
              "blanco": 3.45,
              "maderado": 5.6,
              "champagne": 4.11
            }
          },
          {
            "code": "CED-RIE6455",
            "description": "RIE. INFERIOR",
            "unit": "ml",
            "prices": {
              "natural": 3.35,
              "negro": 3.95,
              "blanco": 3.93,
              "maderado": 5.55,
              "champagne": 4.46
            }
          },
          {
            "code": "CED-VER7570",
            "description": "VERTICAL ABIERTO",
            "unit": "ml",
            "prices": {
              "natural": 2.74,
              "negro": 3.12,
              "blanco": 2.74,
              "maderado": 4.82,
              "champagne": 3.52
            }
          },
          {
            "code": "CED-RIE2564",
            "description": "RIE. INFERIOR 7 PERFILES",
            "unit": "ml",
            "prices": {
              "natural": 3.12,
              "negro": 3.33,
              "blanco": 3.13,
              "maderado": 3.85,
              "champagne": 3.48
            }
          },
          {
            "code": "CED-ADA3483",
            "description": "ADAPTADOR",
            "unit": "ml",
            "prices": {
              "natural": 3.01,
              "negro": 2.08,
              "blanco": 2.2,
              "maderado": null,
              "champagne": 2.13
            }
          }
        ]
      },
      "Junquillos": {
        "products": [
          {
            "code": "CED-MUL7498",
            "description": "MULLON",
            "unit": "ml",
            "genericRoles": ["ventana-fija-1100-mullon"],
            "prices": {
              "natural": 2.1,
              "negro": 2.19,
              "blanco": 1.87,
              "maderado": 3.11,
              "champagne": 2.21
            }
          },
          {
            "code": "CED-JUN0971",
            "description": "JUNQUILLO TRIANGULAR 1-1/2 ESPALDA",
            "unit": "ml",
            "prices": {
              "natural": 1.94,
              "negro": 2.12,
              "blanco": 1.96,
              "maderado": 2.97,
              "champagne": 2.16
            }
          },
          {
            "code": "CED-JUN0242",
            "description": "JUNQUILLO TRIANGULAR 1-1/2 TAPA",
            "unit": "ml",
            "prices": {
              "natural": 1.07,
              "negro": 1.16,
              "blanco": 1.11,
              "maderado": 1.91,
              "champagne": 1.2
            }
          },
          {
            "code": "CED-JUN0733",
            "description": "JUNQUILLOS TRIANG 1-1/4 ESPALDA",
            "unit": "ml",
            "prices": {
              "natural": 1.15,
              "negro": 1.29,
              "blanco": 1.29,
              "maderado": null,
              "champagne": null
            }
          },
          {
            "code": "CED-JUN0807",
            "description": "JUNQUILLO TRIANG 1-1/4 TAPA",
            "unit": "ml",
            "prices": {
              "natural": 0.68,
              "negro": 0.85,
              "blanco": 0.83,
              "maderado": null,
              "champagne": null
            }
          },
          {
            "code": "CED-JUN0234",
            "description": "JUNQUILLO ESPALDA REDONDO",
            "unit": "ml",
            "prices": {
              "natural": 1.63,
              "negro": 1.64,
              "blanco": 1.89,
              "maderado": 2.75,
              "champagne": 2.64
            }
          },
          {
            "code": "CED-JUN0581",
            "description": "JUNQUILLOS TAPA REDONDO",
            "unit": "ml",
            "prices": {
              "natural": 0.93,
              "negro": 0.96,
              "blanco": 0.96,
              "maderado": 2.18,
              "champagne": 0.96
            }
          },
          {
            "code": "CED-REV8063",
            "description": "REVESTIMIENTO/PANELADO",
            "unit": "ml",
            "prices": {
              "natural": 2.87,
              "negro": 2.98,
              "blanco": 2.92,
              "maderado": 3.98,
              "champagne": 3.05
            }
          }
        ]
      },
      "Ventana Fija Estandar": {
        "products": [
          {
            "code": "CED-HOR1106",
            "description": "HORIZONTAL SIN VENA (ESTANDAR)",
            "unit": "ml",
            "genericRoles": ["ventana-fija-1100-horizontal"],
            "prices": {
              "natural": 3.54,
              "negro": 3.67,
              "blanco": 3.33,
              "maderado": 5.88,
              "champagne": 3.78
            }
          },
          {
            "code": "CED-VER6808",
            "description": "VERTICAL CON VENA (ESTANDAR)",
            "unit": "ml",
            "genericRoles": ["ventana-fija-1100-vertical"],
            "prices": {
              "natural": 3.69,
              "negro": 3.82,
              "blanco": 3.74,
              "maderado": 6.43,
              "champagne": 3.92
            }
          },
          {
            "code": "CED-JUN0861",
            "description": "JUNQUILLO C/FELPERO/PISAVIDRIO",
            "unit": "ml",
            "genericRoles": ["ventana-fija-1100-junquillo"],
            "prices": {
              "natural": 1.5,
              "negro": 1.6,
              "blanco": 1.52,
              "maderado": 2.61,
              "champagne": 1.62
            }
          }
        ]
      },
      "Ventana Fija Economica": {
        "products": [
          {
            "code": "CED-HOR2824",
            "description": "HORIZONTAL V/FIJA (ECONOMICA)",
            "unit": "ml",
            "prices": {
              "natural": 2.39,
              "negro": 2.4,
              "blanco": 2.38,
              "maderado": 3.35,
              "champagne": 2.68
            }
          },
          {
            "code": "CED-VER1409",
            "description": "VERTICAL (ECONOMICA)",
            "unit": "ml",
            "prices": {
              "natural": 2.8,
              "negro": 2.94,
              "blanco": 2.9,
              "maderado": 4.15,
              "champagne": 3.26
            }
          },
          {
            "code": "CED-JUN0583",
            "description": "JUNQUILLO SIN FELPERO",
            "unit": "ml",
            "prices": {
              "natural": 1.19,
              "negro": 1.28,
              "blanco": 1.18,
              "maderado": 3.12,
              "champagne": null
            }
          }
        ]
      },
      "Ventana Proyectable": {
        "products": [
          {
            "code": "CED-MAR0928",
            "description": "MARCO DOBLE",
            "unit": "ml",
            "genericRoles": ["ventana-fija-proyectable-marco-doble"],
            "prices": {
              "natural": 7.05,
              "negro": 7.11,
              "blanco": 7.13,
              "maderado": 9.35,
              "champagne": 7.2
            }
          },
          {
            "code": "CED-JUN0876",
            "description": "JUNQUILLO REDONDO",
            "unit": "ml",
            "genericRoles": ["ventana-fija-proyectable-junquillo"],
            "prices": {
              "natural": 2.23,
              "negro": 2.23,
              "blanco": 2.22,
              "maderado": 3.95,
              "champagne": 2.38
            }
          },
          {
            "code": "CED-JUN0879",
            "description": "JUNQUILLO TRIANGULAR",
            "unit": "ml",
            "prices": {
              "natural": 1.78,
              "negro": 1.8,
              "blanco": 1.78,
              "maderado": 2.49,
              "champagne": null
            }
          },
          {
            "code": "CED-PER8653",
            "description": "PERIMETRAL HOJA",
            "unit": "ml",
            "genericRoles": ["ventana-fija-proyectable-perimetral-hoja"],
            "prices": {
              "natural": 5.52,
              "negro": 5.44,
              "blanco": 5.39,
              "maderado": 8.3,
              "champagne": 5.55
            }
          },
          {
            "code": "CED-PER1794",
            "description": "PERIMETRAL MARCO",
            "unit": "ml",
            "genericRoles": ["ventana-fija-proyectable-marco"],
            "prices": {
              "natural": 3.69,
              "negro": 3.74,
              "blanco": 3.77,
              "maderado": 5.61,
              "champagne": 3.92
            }
          }
        ]
      },
      "Tubos y Canales": {
        "products": [
          {
            "code": "CED-TUB7316",
            "description": "TUBO RECTANGULAR 3X1-1/2",
            "unit": "ml",
            "genericRoles": ["batiente-tubo-7x4"],
            "prices": {
              "natural": 7.4,
              "negro": 7.55,
              "blanco": 7.24,
              "maderado": 11.92,
              "champagne": 7.85
            }
          },
          {
            "code": "CED-CAN3683",
            "description": "CANAL CON ALETA 3X1",
            "unit": "ml",
            "prices": {
              "natural": 4.86,
              "negro": 5.15,
              "blanco": 5.0,
              "maderado": 8.4,
              "champagne": 5.36
            }
          },
          {
            "code": "CED-TUB4245",
            "description": "TUBO DE 1-1/2 X 1-1/2",
            "unit": "ml",
            "genericRoles": ["batiente-tubo-4x4"],
            "prices": {
              "natural": 4.11,
              "negro": 4.27,
              "blanco": 4.16,
              "maderado": 7.27,
              "champagne": 4.45
            }
          },
          {
            "code": "CED-TUB4210",
            "description": "TUBO RECTANGULAR 2 X 1-1/2",
            "unit": "ml",
            "genericRoles": ["batiente-tubo-5x4"],
            "prices": {
              "natural": 5.43,
              "negro": 5.56,
              "blanco": 5.21,
              "maderado": 8.87,
              "champagne": 5.92
            }
          }
        ]
      },
      "Puerta Corrediza": {
        "products": [
          {
            "code": "CED-ADA1518",
            "description": "ADAPTADOR PUERTA CORREDERA",
            "unit": "ml",
            "prices": {
              "natural": 1.43,
              "negro": 1.5,
              "blanco": 1.65,
              "maderado": null,
              "champagne": 1.56
            }
          },
          {
            "code": "CED-HOR4933",
            "description": "HORIZONTAL INFERIOR",
            "unit": "ml",
            "prices": {
              "natural": 5.96,
              "negro": 6.07,
              "blanco": 5.9,
              "maderado": 9.64,
              "champagne": 6.07
            }
          },
          {
            "code": "CED-PER4123",
            "description": "PERIMETRAL MOVIL",
            "unit": "ml",
            "prices": {
              "natural": 4.89,
              "negro": 5.02,
              "blanco": 5.0,
              "maderado": 7.05,
              "champagne": 5.32
            }
          },
          {
            "code": "CED-ENT2505",
            "description": "ENTRECIERRE",
            "unit": "ml",
            "prices": {
              "natural": 5.55,
              "negro": 5.7,
              "blanco": 5.61,
              "maderado": 9.98,
              "champagne": 5.92
            }
          },
          {
            "code": "CED-JAM5238",
            "description": "JAMBA",
            "unit": "ml",
            "prices": {
              "natural": 7.07,
              "negro": 7.23,
              "blanco": 7.04,
              "maderado": 7.71,
              "champagne": 7.48
            }
          },
          {
            "code": "CED-CAB9458",
            "description": "CABEZAL",
            "unit": "ml",
            "prices": {
              "natural": 5.81,
              "negro": 5.96,
              "blanco": 5.84,
              "maderado": 7.98,
              "champagne": 6.3
            }
          },
          {
            "code": "CED-BAS7525",
            "description": "BASE",
            "unit": "ml",
            "prices": {
              "natural": 5.75,
              "negro": 5.88,
              "blanco": 5.83,
              "maderado": 7.18,
              "champagne": 5.99
            }
          },
          {
            "code": "CED-VER3583",
            "description": "VERTICAL",
            "unit": "ml",
            "prices": {
              "natural": 3.78,
              "negro": 3.94,
              "blanco": 3.97,
              "maderado": 9.02,
              "champagne": 4.01
            }
          },
          {
            "code": "CED-VER7712",
            "description": "VERTICAL CHAPA",
            "unit": "ml",
            "prices": {
              "natural": 7.02,
              "negro": 7.27,
              "blanco": 7.27,
              "maderado": 9.02,
              "champagne": 7.27
            }
          }
        ]
      },
      "Puerta Corrediza Economica": {
        "products": [
          {
            "code": "CED-JAM2432",
            "description": "JAMBA PARANTE CHAPA",
            "unit": "ml",
            "prices": {
              "natural": 5.17,
              "negro": 5.29,
              "blanco": 5.27,
              "maderado": 6.83,
              "champagne": 5.53
            }
          },
          {
            "code": "CED-JAM7649",
            "description": "JAMBA MARCO",
            "unit": "ml",
            "prices": {
              "natural": 5.07,
              "negro": 5.56,
              "blanco": 4.9,
              "maderado": 5.84,
              "champagne": 5.58
            }
          },
          {
            "code": "CED-RIE1053",
            "description": "RIEL SUPERIOR",
            "unit": "ml",
            "prices": {
              "natural": 4.99,
              "negro": 5.57,
              "blanco": 5.12,
              "maderado": 6.05,
              "champagne": 5.69
            }
          },
          {
            "code": "CED-RIE9483",
            "description": "RIEL INFERIOR",
            "unit": "ml",
            "prices": {
              "natural": 4.78,
              "negro": 4.97,
              "blanco": 4.84,
              "maderado": 5.44,
              "champagne": null
            }
          },
          {
            "code": "CED-HOR2531",
            "description": "HORIZONTAL SUPERIOR",
            "unit": "ml",
            "prices": {
              "natural": 4.2,
              "negro": 4.67,
              "blanco": 4.4,
              "maderado": 5.3,
              "champagne": 4.79
            }
          },
          {
            "code": "CED-HOR2560",
            "description": "HORIZONTAL INFERIOR",
            "unit": "ml",
            "prices": {
              "natural": 4.85,
              "negro": 5.42,
              "blanco": 5.28,
              "maderado": 7.3,
              "champagne": null
            }
          },
          {
            "code": "CED-ENT6451",
            "description": "ENTRECIERRE",
            "unit": "ml",
            "prices": {
              "natural": 4.71,
              "negro": 5.02,
              "blanco": 4.88,
              "maderado": 6.81,
              "champagne": 5.11
            }
          }
        ]
      },
      "Puerta T45": {
        "products": [
          {
            "code": "CED-MAR0451",
            "description": "MARCO CEDAL",
            "unit": "ml",
            "prices": {
              "natural": 8.36,
              "negro": 8.47,
              "blanco": 8.31,
              "maderado": 12.56,
              "champagne": 8.7
            }
          },
          {
            "code": "CED-ADA5208",
            "description": "ADAPTADOR DE RIEL",
            "unit": "ml",
            "prices": {
              "natural": 3.63,
              "negro": 3.73,
              "blanco": 3.17,
              "maderado": 4.42,
              "champagne": 3.82
            }
          },
          {
            "code": "CED-HOJ5905",
            "description": "HOJA CEDAL",
            "unit": "ml",
            "prices": {
              "natural": 7.11,
              "negro": 7.25,
              "blanco": 7.08,
              "maderado": 10.85,
              "champagne": 7.41
            }
          },
          {
            "code": "CED-ENT5595",
            "description": "ENTRECIERRE",
            "unit": "ml",
            "prices": {
              "natural": 2.62,
              "negro": 2.74,
              "blanco": 2.54,
              "maderado": 4.7,
              "champagne": 2.81
            }
          }
        ]
      },
      "Cortinero Bano Niquelado": {
        "products": [
          {
            "code": "CED-CAB1924",
            "description": "CABEZAL CAB VIDRIO TEMPLADO CEDAL",
            "unit": "ml",
            "genericRoles": ["cabina-cabezal"],
            "prices": {
              "natural": 14.44,
              "negro": 14.44,
              "blanco": 14.44,
              "maderado": 14.44,
              "champagne": 14.44
            }
          },
          {
            "code": "CED-BAS6939",
            "description": "BASE CB VIDRIO TEMPLADO CEDAL",
            "unit": "ml",
            "genericRoles": ["cabina-base"],
            "prices": {
              "natural": 4.34,
              "negro": 4.34,
              "blanco": 4.34,
              "maderado": 4.34,
              "champagne": 4.34
            }
          },
          {
            "code": "CED-JAM8113",
            "description": "JAMBA C/ VIDRIO TEMPLADO",
            "unit": "ml",
            "genericRoles": ["cabina-jamba"],
            "prices": {
              "natural": 2.65,
              "negro": 2.65,
              "blanco": 2.65,
              "maderado": 2.65,
              "champagne": 2.65
            }
          },
          {
            "code": "CED-HOR6738",
            "description": "HORIZONTAL SUPERIOR CEDAL",
            "unit": "ml",
            "genericRoles": ["cabina-horizontal-superior"],
            "prices": {
              "natural": 5.35,
              "negro": 5.35,
              "blanco": 5.35,
              "maderado": 5.35,
              "champagne": 5.35
            }
          }
        ]
      }
    }
  },
  "fisa": {
    "name": "Fisa",
    "colors": [
      "natural",
      "negro",
      "blanco",
      "maderado",
      "champagne"
    ],
    "categories": {
      "Ventana Corrediza 1300": {
        "products": [
          {
            "code": "FIS-VER7128",
            "description": "VERTICAL DE HOJA REFORZADO",
            "unit": "ml",
            "prices": {
              "natural": 3.38,
              "negro": 3.71,
              "blanco": 3.11,
              "maderado": 4.97,
              "champagne": 4.3
            }
          },
          {
            "code": "FIS-RIE2588",
            "description": "RIEL DE CUATRO ALETAS",
            "unit": "ml",
            "prices": {
              "natural": 3.44,
              "negro": 3.28,
              "blanco": 3.28,
              "maderado": 4.04,
              "champagne": 4.01
            }
          },
          {
            "code": "FIS-HOR8735",
            "description": "HORIZONTAL DE HOJA",
            "unit": "ml",
            "prices": {
              "natural": 3.26,
              "negro": 3.23,
              "blanco": 3.13,
              "maderado": 4.42,
              "champagne": 3.81
            }
          },
          {
            "code": "FIS-JAM8169",
            "description": "JAMBA MARCO",
            "unit": "ml",
            "prices": {
              "natural": 3.55,
              "negro": 3.38,
              "blanco": 3.38,
              "maderado": 4.78,
              "champagne": 4.06
            }
          },
          {
            "code": "FIS-PAR4254",
            "description": "PARANTE DE HOJA ECON CERRADO",
            "unit": "ml",
            "prices": {
              "natural": 3.14,
              "negro": 2.9,
              "blanco": 2.9,
              "maderado": null,
              "champagne": null
            }
          },
          {
            "code": "FIS-VER8593",
            "description": "VERTICAL DE HOJA ECONOMICA",
            "unit": "ml",
            "prices": {
              "natural": 3.63,
              "negro": 2.43,
              "blanco": 2.43,
              "maderado": null,
              "champagne": null
            }
          },
          {
            "code": "FIS-HOR1356",
            "description": "HOR PARA TRES HOJAS",
            "unit": "ml",
            "prices": {
              "natural": 3.42,
              "negro": 3.21,
              "blanco": 3.21,
              "maderado": 4.42,
              "champagne": 2.75
            }
          },
          {
            "code": "FIS-HOR1049",
            "description": "HORIZONTAL DE HOJA ECONOMICA",
            "unit": "ml",
            "prices": {
              "natural": 3.29,
              "negro": 3.17,
              "blanco": 3.17,
              "maderado": 4.08,
              "champagne": 3.85
            }
          },
          {
            "code": "FIS-PER8047",
            "description": "PERFIL MALLA CORREDIZA",
            "unit": "ml",
            "prices": {
              "natural": 1.49,
              "negro": 1.45,
              "blanco": 1.45,
              "maderado": 1.05,
              "champagne": null
            }
          },
          {
            "code": "FIS-ALF3068",
            "description": "ALFAJIA DE 16CM",
            "unit": "ml",
            "prices": {
              "natural": 4.98,
              "negro": 7.98,
              "blanco": 7.29,
              "maderado": 11.4,
              "champagne": 6.2
            }
          },
          {
            "code": "FIS-ALF9482",
            "description": "ALFAJIA DE 11.42CM",
            "unit": "ml",
            "prices": {
              "natural": 4.35,
              "negro": 3.99,
              "blanco": 3.89,
              "maderado": 6.23,
              "champagne": 4.34
            }
          },
          {
            "code": "FIS-PAR9417",
            "description": "PARANTE DE HOJA ESTANDAR",
            "unit": "ml",
            "prices": {
              "natural": 2.79,
              "negro": 2.71,
              "blanco": 2.71,
              "maderado": 3.83,
              "champagne": 2.34
            }
          },
          {
            "code": "FIS-RIE6045",
            "description": "RIEL DE TRES ALETAS INCLINADO",
            "unit": "ml",
            "prices": {
              "natural": 3.45,
              "negro": 3.22,
              "blanco": 3.22,
              "maderado": 4.87,
              "champagne": 5.09
            }
          },
          {
            "code": "FIS-RIE9371",
            "description": "RIEL DE TRES ALETAS PLANA",
            "unit": "ml",
            "prices": {
              "natural": 3.54,
              "negro": 3.36,
              "blanco": 3.36,
              "maderado": 5.09,
              "champagne": 4.2
            }
          }
        ]
      },
      "Ventana Fija": {
        "products": [
          {
            "code": "FIS-VER1622",
            "description": "VERTICAL CON NERVIO",
            "unit": "ml",
            "genericRoles": ["ventana-fija-1100-vertical"],
            "prices": {
              "natural": 3.86,
              "negro": 3.6,
              "blanco": 3.6,
              "maderado": 5.45,
              "champagne": 4.37
            }
          },
          {
            "code": "FIS-HOR7312",
            "description": "HORIZONTAL SIN NERVIO",
            "unit": "ml",
            "genericRoles": ["ventana-fija-1100-horizontal"],
            "prices": {
              "natural": 3.54,
              "negro": 3.27,
              "blanco": 3.27,
              "maderado": 4.35,
              "champagne": null
            }
          },
          {
            "code": "FIS-JUN0526",
            "description": "JUNQUILLO ESTANDAR",
            "unit": "ml",
            "genericRoles": ["ventana-fija-1100-junquillo"],
            "prices": {
              "natural": 1.57,
              "negro": 1.45,
              "blanco": 1.45,
              "maderado": 2.19,
              "champagne": 1.79
            }
          },
          {
            "code": "FIS-VER1314",
            "description": "VERTICAL CON NERVIO ECONOMICA",
            "unit": "ml",
            "prices": {
              "natural": 3.16,
              "negro": 2.92,
              "blanco": 2.92,
              "maderado": 4.42,
              "champagne": null
            }
          },
          {
            "code": "FIS-VER0920",
            "description": "VERTICAL SIN NERVIO ECONOMICA",
            "unit": "ml",
            "prices": {
              "natural": 2.27,
              "negro": 2.52,
              "blanco": 2.52,
              "maderado": 2.18,
              "champagne": null
            }
          },
          {
            "code": "FIS-MUL2699",
            "description": "MULLON",
            "unit": "ml",
            "genericRoles": ["ventana-fija-1100-mullon"],
            "prices": {
              "natural": 1.27,
              "negro": 2.03,
              "blanco": 2.03,
              "maderado": 3.87,
              "champagne": null
            }
          }
        ]
      },
      "Puerta Batiente": {
        "products": [
          {
            "code": "FIS-JUN0184",
            "description": "JUNQUILLO TRIANG VID 10MM TAPA",
            "unit": "ml",
            "prices": {
              "natural": 1.12,
              "negro": 1.03,
              "blanco": 1.03,
              "maderado": 1.65,
              "champagne": 1.3
            }
          },
          {
            "code": "FIS-JUN0010",
            "description": "JUNQUILLO TRIANG VID 10MM ESPALDA",
            "unit": "ml",
            "prices": {
              "natural": 2.03,
              "negro": 1.92,
              "blanco": 1.92,
              "maderado": 1.93,
              "champagne": null
            }
          },
          {
            "code": "FIS-JUN0325",
            "description": "JUNQUILLO TRIANG VID 6MM TAPA",
            "unit": "ml",
            "prices": {
              "natural": 0.98,
              "negro": 0.98,
              "blanco": 0.56,
              "maderado": 1.5,
              "champagne": 1.24
            }
          },
          {
            "code": "FIS-JUN0904",
            "description": "JUNQUILLO REDONDO TAPA",
            "unit": "ml",
            "prices": {
              "natural": 1.07,
              "negro": 1.01,
              "blanco": 1.01,
              "maderado": null,
              "champagne": 1.42
            }
          },
          {
            "code": "FIS-JUN0746",
            "description": "JUNQUILLO REDONDO ESPALDA",
            "unit": "ml",
            "prices": {
              "natural": 1.65,
              "negro": 1.51,
              "blanco": 1.51,
              "maderado": 1.81,
              "champagne": null
            }
          },
          {
            "code": "FIS-JUN0063",
            "description": "JUNQUILLO TRIANG VID 6MM ESPALDA",
            "unit": "ml",
            "prices": {
              "natural": 1.98,
              "negro": 1.81,
              "blanco": 1.81,
              "maderado": null,
              "champagne": null
            }
          },
          {
            "code": "FIS-JUN0188",
            "description": "JUNQUILLO RED 6MM TAPA",
            "unit": "ml",
            "prices": {
              "natural": 1.21,
              "negro": 1.13,
              "blanco": 1.13,
              "maderado": 1.76,
              "champagne": null
            }
          },
          {
            "code": "FIS-CAN2041",
            "description": "CANAL 7.0X2.5 CON ALETA",
            "unit": "ml",
            "prices": {
              "natural": 7.8,
              "negro": 7.15,
              "blanco": 7.15,
              "maderado": 12.23,
              "champagne": null
            }
          },
          {
            "code": "FIS-CAN0148",
            "description": "CANAL 7.0X3.8 CON ALETA",
            "unit": "ml",
            "prices": {
              "natural": 4.54,
              "negro": 4.17,
              "blanco": 4.17,
              "maderado": null,
              "champagne": null
            }
          },
          {
            "code": "FIS-CAN5517",
            "description": "CANAL 7.5X2.5 SIN ALETA",
            "unit": "ml",
            "prices": {
              "natural": 10.98,
              "negro": 10.04,
              "blanco": 10.04,
              "maderado": null,
              "champagne": null
            }
          },
          {
            "code": "FIS-CAN6001",
            "description": "CANAL 7.6X3.8 SIN ALETA",
            "unit": "ml",
            "prices": {
              "natural": 5.7,
              "negro": 7.15,
              "blanco": 7.15,
              "maderado": 10.65,
              "champagne": 6.93
            }
          },
          {
            "code": "FIS-TUB2526",
            "description": "TUBO 7.6X2.5 CON ALETA ECON",
            "unit": "ml",
            "prices": {
              "natural": 10.99,
              "negro": 10.07,
              "blanco": 10.07,
              "maderado": 15.72,
              "champagne": null
            }
          },
          {
            "code": "FIS-TUB8537",
            "description": "TUBO 7.6X3.8 CON ALETA",
            "unit": "ml",
            "prices": {
              "natural": 8.26,
              "negro": 7.57,
              "blanco": 7.57,
              "maderado": 10.71,
              "champagne": 9.54
            }
          },
          {
            "code": "FIS-TUB2066",
            "description": "TUBO 7.6X2.5 DOBLE ALETA",
            "unit": "ml",
            "prices": {
              "natural": 2.83,
              "negro": 2.67,
              "blanco": 2.67,
              "maderado": 4.3,
              "champagne": null
            }
          },
          {
            "code": "FIS-FEL6459",
            "description": "FELPERO",
            "unit": "ml",
            "prices": {
              "natural": 3.27,
              "negro": 2.95,
              "blanco": 2.95,
              "maderado": 4.46,
              "champagne": 3.75
            }
          },
          {
            "code": "FIS-PAN7735",
            "description": "PANELADO",
            "unit": "ml",
            "prices": {
              "natural": 3.27,
              "negro": 2.95,
              "blanco": 2.95,
              "maderado": 4.46,
              "champagne": 3.75
            }
          }
        ]
      },
      "Ventana Proyectable": {
        "products": [
          {
            "code": "FIS-HOR5745",
            "description": "HORIZONTAL INFERIOR DE HOJA",
            "unit": "ml",
            "prices": {
              "natural": 6.0,
              "negro": 5.6,
              "blanco": 5.6,
              "maderado": 7.93,
              "champagne": 6.86
            }
          },
          {
            "code": "FIS-HOR2388",
            "description": "HORIZONTAL SUPERIOR DE HOJA",
            "unit": "ml",
            "prices": {
              "natural": 4.94,
              "negro": 4.65,
              "blanco": 4.65,
              "maderado": 6.81,
              "champagne": null
            }
          },
          {
            "code": "FIS-JAM4658",
            "description": "JAMBA CHAPA",
            "unit": "ml",
            "prices": {
              "natural": 5.86,
              "negro": 5.86,
              "blanco": 5.86,
              "maderado": 7.72,
              "champagne": null
            }
          },
          {
            "code": "FIS-JAM9761",
            "description": "JAMBA MARCO",
            "unit": "ml",
            "prices": {
              "natural": 6.76,
              "negro": 5.38,
              "blanco": 5.38,
              "maderado": 9.03,
              "champagne": 7.66
            }
          },
          {
            "code": "FIS-RIE5384",
            "description": "RIEL SUPERIOR",
            "unit": "ml",
            "prices": {
              "natural": 5.77,
              "negro": 5.6,
              "blanco": 5.6,
              "maderado": 7.93,
              "champagne": null
            }
          },
          {
            "code": "FIS-RIE1133",
            "description": "RIEL INFERIOR",
            "unit": "ml",
            "prices": {
              "natural": 5.77,
              "negro": 5.6,
              "blanco": 5.6,
              "maderado": 7.65,
              "champagne": 6.8
            }
          },
          {
            "code": "FIS-RIE2953",
            "description": "RIEL INFERIOR DOBLE",
            "unit": "ml",
            "prices": {
              "natural": 5.48,
              "negro": 5.16,
              "blanco": 5.16,
              "maderado": 6.07,
              "champagne": null
            }
          },
          {
            "code": "FIS-VER9635",
            "description": "VERTICAL DE HOJA FIJA",
            "unit": "ml",
            "prices": {
              "natural": 3.86,
              "negro": 3.75,
              "blanco": 3.75,
              "maderado": null,
              "champagne": null
            }
          },
          {
            "code": "FIS-ENT3538",
            "description": "ENTRECIERRE",
            "unit": "ml",
            "prices": {
              "natural": 5.77,
              "negro": 5.42,
              "blanco": 5.42,
              "maderado": 7.4,
              "champagne": null
            }
          },
          {
            "code": "FIS-ADA9788",
            "description": "ADAPTADOR",
            "unit": "ml",
            "prices": {
              "natural": 2.83,
              "negro": 2.05,
              "blanco": 2.05,
              "maderado": null,
              "champagne": null
            }
          },
          {
            "code": "FIS-HOR3275",
            "description": "HORIZONTAL DE MALLA",
            "unit": "ml",
            "prices": {
              "natural": 3.61,
              "negro": null,
              "blanco": null,
              "maderado": null,
              "champagne": null
            }
          },
          {
            "code": "FIS-VER9084",
            "description": "VERTICAL DE MALLA",
            "unit": "ml",
            "prices": {
              "natural": 3.58,
              "negro": null,
              "blanco": null,
              "maderado": null,
              "champagne": null
            }
          },
          {
            "code": "FIS-RIE9977",
            "description": "RIEL DOBLE",
            "unit": "ml",
            "prices": {
              "natural": null,
              "negro": null,
              "blanco": null,
              "maderado": 7.1,
              "champagne": null
            }
          }
        ]
      },
      "Tubos Varios": {
        "products": [
          {
            "code": "FIS-TUB1046",
            "description": "TUBO 3.8X3.8 SIN TEMPLE",
            "unit": "ml",
            "prices": {
              "natural": 5.99,
              "negro": 5.81,
              "blanco": 5.81,
              "maderado": 8.51,
              "champagne": 6.85
            }
          },
          {
            "code": "FIS-TUB2333",
            "description": "TUBO 3.8X3.8 STANDARD",
            "unit": "ml",
            "prices": {
              "natural": 5.41,
              "negro": 4.95,
              "blanco": 4.95,
              "maderado": 7.25,
              "champagne": 6.18
            }
          },
          {
            "code": "FIS-TUB7806",
            "description": "TUBO 5.0X3.8",
            "unit": "ml",
            "prices": {
              "natural": 5.27,
              "negro": 5.17,
              "blanco": 5.17,
              "maderado": 7.06,
              "champagne": null
            }
          },
          {
            "code": "FIS-TUB1124",
            "description": "TUBO 3.6X3.8",
            "unit": "ml",
            "prices": {
              "natural": 6.06,
              "negro": 5.13,
              "blanco": 5.13,
              "maderado": 6.95,
              "champagne": null
            }
          },
          {
            "code": "FIS-TUB8553",
            "description": "TUBO 30.1X3.8 ALIVIANDO",
            "unit": "ml",
            "prices": {
              "natural": 8.01,
              "negro": 9.35,
              "blanco": 9.35,
              "maderado": 12.95,
              "champagne": 11.1
            }
          },
          {
            "code": "FIS-TUB5867",
            "description": "TUBO 3.1X3.1",
            "unit": "ml",
            "prices": {
              "natural": 3.1,
              "negro": 3.04,
              "blanco": 3.04,
              "maderado": 4.45,
              "champagne": 3.62
            }
          },
          {
            "code": "FIS-TUB6977",
            "description": "TUBO 3.8X3.8 LIVIANO",
            "unit": "ml",
            "prices": {
              "natural": 3.83,
              "negro": 3.83,
              "blanco": 3.83,
              "maderado": 5.43,
              "champagne": null
            }
          },
          {
            "code": "FIS-TUB6551",
            "description": "TUBO 1.9X3.8",
            "unit": "ml",
            "prices": {
              "natural": 3.13,
              "negro": 3.13,
              "blanco": 3.13,
              "maderado": 4.43,
              "champagne": 4.91
            }
          },
          {
            "code": "FIS-TUB7714",
            "description": "TUBO DE 2.5X2.5",
            "unit": "ml",
            "prices": {
              "natural": 2.54,
              "negro": 2.47,
              "blanco": 2.47,
              "maderado": 3.61,
              "champagne": 2.95
            }
          }
        ]
      },
      "Puerta Europea": {
        "products": [
          {
            "code": "FIS-ADA1687",
            "description": "ADAPTADOR DE RIEL",
            "unit": "ml",
            "prices": {
              "natural": 6.66,
              "negro": 6.66,
              "blanco": 6.66,
              "maderado": 9.79,
              "champagne": 6.98
            }
          },
          {
            "code": "FIS-RIE4140",
            "description": "RIEL INFERIOR/SUPERIOR",
            "unit": "ml",
            "prices": {
              "natural": 12.24,
              "negro": 12.24,
              "blanco": 12.24,
              "maderado": 17.0,
              "champagne": 12.55
            }
          },
          {
            "code": "FIS-HOJ1376",
            "description": "HOJA VERTICAL/HORIZONTAL",
            "unit": "ml",
            "prices": {
              "natural": 9.6,
              "negro": 9.6,
              "blanco": 9.6,
              "maderado": 13.42,
              "champagne": 9.93
            }
          },
          {
            "code": "FIS-HOR8599",
            "description": "HOJA VERT/HORIZ V CAMARA",
            "unit": "ml",
            "prices": {
              "natural": 2.41,
              "negro": null,
              "blanco": null,
              "maderado": null,
              "champagne": null
            }
          },
          {
            "code": "FIS-ENT5050",
            "description": "ENTRECIERRE",
            "unit": "ml",
            "prices": {
              "natural": 3.88,
              "negro": 3.88,
              "blanco": 3.88,
              "maderado": 6.4,
              "champagne": 4.2
            }
          },
          {
            "code": "FIS-ADA1117",
            "description": "ADAPTADOR ESQUINERO",
            "unit": "ml",
            "prices": {
              "natural": 6.52,
              "negro": 5.97,
              "blanco": 5.97,
              "maderado": 9.81,
              "champagne": null
            }
          },
          {
            "code": "FIS-ADA9617",
            "description": "ADAPTADOR DE HOJA",
            "unit": "ml",
            "prices": {
              "natural": 3.1,
              "negro": 3.1,
              "blanco": 3.1,
              "maderado": 5.71,
              "champagne": 3.42
            }
          },
          {
            "code": "FIS-ALM9138",
            "description": "ALMA TIRADERA",
            "unit": "ml",
            "prices": {
              "natural": 8.03,
              "negro": 8.03,
              "blanco": 8.03,
              "maderado": 8.03,
              "champagne": 8.03
            }
          },
          {
            "code": "FIS-TIR2507",
            "description": "TIRADERA ALETA DE PUERTA",
            "unit": "ml",
            "prices": {
              "natural": 5.6,
              "negro": 5.6,
              "blanco": 5.6,
              "maderado": 10.42,
              "champagne": 5.92
            }
          }
        ]
      },
      "Cabina Vidrio Templado Niquelado": {
        "products": [
          {
            "code": "FIS-CAB7547",
            "description": "CABEZAL MARCO NIQUELADO",
            "unit": "ml",
            "genericRoles": ["cabina-cabezal"],
            "prices": {
              "natural": 14.44,
              "negro": 14.44,
              "blanco": 14.44,
              "maderado": null,
              "champagne": null
            }
          },
          {
            "code": "FIS-BAS1326",
            "description": "BASE MARCO NIQUELADO",
            "unit": "ml",
            "genericRoles": ["cabina-base"],
            "prices": {
              "natural": 4.99,
              "negro": 4.99,
              "blanco": 4.99,
              "maderado": null,
              "champagne": null
            }
          },
          {
            "code": "FIS-JAM1219",
            "description": "JAMBA MARCO NIQUELADO",
            "unit": "ml",
            "genericRoles": ["cabina-jamba"],
            "prices": {
              "natural": 3.19,
              "negro": 3.19,
              "blanco": 3.19,
              "maderado": null,
              "champagne": null
            }
          },
          {
            "code": "FIS-HOR4357",
            "description": "HORIZONTAL SUPERIOR HOJA NIQUELADO",
            "unit": "ml",
            "genericRoles": ["cabina-horizontal-superior"],
            "prices": {
              "natural": 5.35,
              "negro": 5.35,
              "blanco": 5.35,
              "maderado": null,
              "champagne": null
            }
          }
        ]
      }
    }
  }
},
  glass: [
    { type: 'Claro 4mm', weight: 10, pricePerM2: 8.00 },
    { type: 'Claro 6mm', weight: 15, pricePerM2: 10.00 },
    { type: 'Claro 8mm', weight: 20, pricePerM2: 16.00 },
    { type: 'Bronce 4mm', weight: 10, pricePerM2: 9.00 },
    { type: 'Bronce 6mm', weight: 15, pricePerM2: 11.00 },
    { type: 'Deslustrado 4mm', weight: 10, pricePerM2: 12.00 },
    { type: 'Deslustrado 6mm', weight: 15, pricePerM2: 14.00 },
    { type: 'Laminado claro 3+3', weight: 16, pricePerM2: 22.00 },
    { type: 'Laminado claro 4+4', weight: 22, pricePerM2: 32.00 },
    // Templados: los usan las cabinas de baño (CABINA DE BAÑO ACTUALIZADO.xlsx,
    // precios al 13/05/2025). No se venden por m² sueltos como los anteriores.
    { type: 'Templado 6mm', weight: 15, pricePerM2: 26.00 },
    { type: 'Templado 8mm', weight: 20, pricePerM2: 34.00 },
    { type: 'Templado 8mm con diseno', weight: 20, pricePerM2: 52.00 }
  ],
  glassSale: [
    { type: 'Claro 2mm', pricePerM2: 4.20 },
    { type: 'Claro 3mm', pricePerM2: 6.53 },
    { type: 'Claro 4mm', pricePerM2: 7.06 },
    { type: 'Claro 6mm', pricePerM2: 10.07 },
    { type: 'Claro 8mm', pricePerM2: 13.99 },
    { type: 'Claro 10mm', pricePerM2: 16.67 },
    { type: 'Bronce 4mm', pricePerM2: 7.73 },
    { type: 'Bronce 6mm', pricePerM2: 10.39 },
    { type: 'Bronce 8mm', pricePerM2: 15.29 },
    { type: 'Deslustrado 4mm', pricePerM2: 8.47 },
    { type: 'Deslustrado 6mm', pricePerM2: 13.00 },
    { type: 'Negro 4mm', pricePerM2: 12.64 },
    { type: 'Negro 6mm', pricePerM2: 17.24 },
    { type: 'Catedral Llovizna Claro 4mm', pricePerM2: 9.06 },
    { type: 'Catedral Llovizna Bronce 4mm', pricePerM2: 11.80 },
    { type: 'Espejo 2mm', pricePerM2: 6.05 },
    { type: 'Espejo 3mm', pricePerM2: 8.32 },
    { type: 'Espejo 4mm', pricePerM2: 9.24 },
    { type: 'Claro Laminado 3+3', pricePerM2: 17.32 },
    { type: 'Claro Laminado 4+4', pricePerM2: 21.31 },
    { type: 'Bronce Laminado 3+3', pricePerM2: 17.77 },
    { type: 'Bronce Laminado 4+4', pricePerM2: 22.64 }
  ],
  accessories: [
    { name: 'Silicon', pricePerUnit: 2.20, unit: 'und' },
    { name: 'Tornillos y tacos', pricePerUnit: 0.05, unit: 'und' },
    { name: 'Vinil', pricePerUnit: 0.85, unit: 'und' },
    { name: 'Seguro de lujo', pricePerUnit: 2.00, unit: 'und' },
    { name: 'Ruedas doble de ventana', pricePerUnit: 0.50, unit: 'und' },
    { name: 'Felpa', pricePerUnit: 0.20, unit: 'und' },
    { name: 'Topes', pricePerUnit: 0.25, unit: 'und' },
    { name: 'Seguro europeo', pricePerUnit: 2.80, unit: 'und' },
    { name: 'Bisagras', pricePerUnit: 8.50, unit: 'und' },
    { name: 'Angulo F1', pricePerUnit: 0.20, unit: 'und' },
    { name: 'Escuadra de travesano fem', pricePerUnit: 1.50, unit: 'und' },
    { name: 'Limitador de apertura', pricePerUnit: 9.00, unit: 'und' },
    { name: 'Anclas para tubo 7x4', pricePerUnit: 0.25, unit: 'und' },
    { name: 'Brazos de acero 12 pulgadas', pricePerUnit: 8.50, unit: 'und' },
    // Cabinas de baño (CABINA DE BAÑO ACTUALIZADO.xlsx). Van aparte de sus
    // parecidos de ventana: la rueda de puerta de cabina no es la misma que la
    // "Ruedas doble de ventana" ($0.50), y el tope de cabina va a $0.50 contra
    // los $0.25 del tope de ventana que ya estaba cargado.
    { name: 'Ruedas de puerta de cabina', pricePerUnit: 1.50, unit: 'und' },
    { name: 'Boton acero inoxidable', pricePerUnit: 8.00, unit: 'und' },
    { name: 'Topes de cabina', pricePerUnit: 0.50, unit: 'und' },
    { name: 'Guia de cabina', pricePerUnit: 0.50, unit: 'und' },
    { name: 'Cinta masking', pricePerUnit: 1.00, unit: 'und' },
    // Cabinas de baño en acero inoxidable (hoja "ACERO INOXIDABLE" del mismo
    // Excel). Cada cabina lleva UN sistema y son excluyentes entre sí: van
    // como accesorio, con cantidad 1 en el que corresponda y 0 en el resto,
    // porque el motor de módulos todavía no tiene una fila de "elegir una
    // opción de una lista" (ver el pendiente de "selección única").
    { name: 'Sistema MB-004', pricePerUnit: 105.00, unit: 'und' },
    { name: 'Sistema MB-008', pricePerUnit: 90.00, unit: 'und' },
    { name: 'Sistema BM-007 en angulo 90', pricePerUnit: 190.00, unit: 'und' },
    { name: 'Sistema MB-009 en angulo 90', pricePerUnit: 170.00, unit: 'und' },
    // Ventana fija en tubo: 2 anclas por módulo más 2 (VENTANAS FIJAS.xlsx,
    // hoja "V. FIJA TUBO"). Va aparte de "Anclas para tubo 7x4" ($0.25), que
    // es de otra medida.
    { name: 'Ancla', pricePerUnit: 0.45, unit: 'und' }
  ],
  /**
   * Módulos preestablecidos por ítem del catálogo (ver js/modules.js). itemId -> receta.
   *
   * "Ventana Fija 1100" viene armada de fábrica como ejemplo real, sacado de
   * VENTANAS FIJAS.xlsx (hoja "V. FIJA 1100"), usando roles genéricos
   * (multi-proveedor: sirve para Cedal, Fisa y Femec sin repetir la receta) y
   * fórmula lineal (una sola receta para 1, 2, 3... módulos, sin duplicar
   * ítems de catálogo). Solo se cargó la de "1 MODULO": como la fórmula ya
   * depende de la cantidad de módulos que se escriba al cotizar, sirve igual
   * para "2 MODULOS" (moduleManager.findModuleForSystem usa esta única
   * receta para toda la familia mientras no haya otra guardada aparte).
   *
   * Nota: Femec no tiene un perfil de MULLON etiquetado en este catálogo, así
   * que una Ventana Fija 1100 de Femec con 2+ módulos y mullón no va a poder
   * cotizarse hasta que se cargue ese perfil (mismo límite que ya tenía el
   * cotizador dedicado de js/ventanaFija1100.js).
   */
  modules: {
    "ventana-fija-1100--ventana-fija-1-modulo": {
      itemId: "ventana-fija-1100--ventana-fija-1-modulo",
      itemName: "VENTANA FIJA 1 MODULO",
      group: "VENTANAS",
      family: "VENTANA FIJA 1100",
      note: "",
      brand: "cedal",
      category: "",
      profiles: [
        {
          code: "CED-HOR1106", category: "Ventana Fija Estandar", description: "HORIZONTAL SIN VENA (ESTANDAR)",
          role: "ventana-fija-1100-horizontal", formula: "lineal", coefBase: 2
        },
        {
          code: "CED-VER6808", category: "Ventana Fija Estandar", description: "VERTICAL CON VENA (ESTANDAR)",
          role: "ventana-fija-1100-vertical", formula: "lineal", coefAlturaMod: 2
        },
        {
          code: "CED-JUN0861", category: "Ventana Fija Estandar", description: "JUNQUILLO C/FELPERO/PISAVIDRIO",
          role: "ventana-fija-1100-junquillo", formula: "lineal", coefBase: 2, coefAlturaMod: 2
        },
        {
          code: "CED-MUL7498", category: "Junquillos", description: "MULLON",
          role: "ventana-fija-1100-mullon", formula: "lineal", coefAltura: -1, coefAlturaMod: 1
        }
      ],
      accessories: [
        { name: "Tornillos y tacos", qty: 30, price: 0.05 },
        { name: "Vinil", qty: 0, price: 0.85, qtyFormula: { coefBase: 2, coefAlturaMod: 2 } },
        { name: "Silicon", qty: 1, price: 2.2 }
      ],
      labor: { workers: 1, hours: 4, transport: 0, viaticos: 0, hoursFormula: { coefModulos: 2, base: 2 } },
      updatedAt: null,
      updatedBy: "importado de VENTANAS FIJAS.xlsx"
    },
    "ventana-fija-1100--ventana-fija-2-modulos": {
      itemId: "ventana-fija-1100--ventana-fija-2-modulos",
      itemName: "VENTANA FIJA 2 MODULOS",
      group: "VENTANAS",
      family: "VENTANA FIJA 1100",
      note: "",
      brand: "cedal",
      category: "",
      profiles: [
        {
          code: "CED-HOR1106", category: "Ventana Fija Estandar", description: "HORIZONTAL SIN VENA (ESTANDAR)",
          role: "ventana-fija-1100-horizontal", formula: "lineal", coefBase: 2
        },
        {
          code: "CED-VER6808", category: "Ventana Fija Estandar", description: "VERTICAL CON VENA (ESTANDAR)",
          role: "ventana-fija-1100-vertical", formula: "lineal", coefAlturaMod: 2
        },
        {
          code: "CED-JUN0861", category: "Ventana Fija Estandar", description: "JUNQUILLO C/FELPERO/PISAVIDRIO",
          role: "ventana-fija-1100-junquillo", formula: "lineal", coefBase: 2, coefAlturaMod: 2
        },
        {
          code: "CED-MUL7498", category: "Junquillos", description: "MULLON",
          role: "ventana-fija-1100-mullon", formula: "lineal", coefAltura: -1, coefAlturaMod: 1
        }
      ],
      accessories: [
        { name: "Tornillos y tacos", qty: 30, price: 0.05 },
        { name: "Vinil", qty: 0, price: 0.85, qtyFormula: { coefBase: 2, coefAlturaMod: 2 } },
        { name: "Silicon", qty: 1, price: 2.2 }
      ],
      labor: { workers: 1, hours: 6, transport: 0, viaticos: 0, hoursFormula: { coefModulos: 2, base: 2 } },
      updatedAt: null,
      updatedBy: "importado de VENTANAS FIJAS.xlsx"
    },

    /**
     * Cabina de baño en marco de aluminio y vidrio templado.
     * Fuente: CABINA DE BAÑO ACTUALIZADO.xlsx, hoja "MARCO DE ALUMINIO"
     * (precios al 13/05/2025).
     *
     * A diferencia de las ventanas, acá NINGUNA cantidad depende de los
     * módulos: el "2 MODULOS" del nombre son las dos hojas de vidrio, pero la
     * hoja de cálculo mide todo contra Base y Altura solamente. Por eso todos
     * los coeficientes son coefBase/coefAltura y no hay ningún coefBaseMod.
     *
     * Los perfiles van por rol genérico, así que la misma receta cotiza con
     * Cedal o con Fisa (los dos tienen los cuatro perfiles etiquetados).
     * Femec no fabrica esta línea: al elegirlo no va a resolver los perfiles.
     */
    "cabina-en-aluminio--cabina-corrediza-2-modulos": {
      itemId: "cabina-en-aluminio--cabina-corrediza-2-modulos",
      itemName: "CABINA CORREDIZA 2 MODULOS",
      group: "CABINAS DE BAÑO",
      family: "CABINA EN ALUMINIO",
      note: "",
      brand: "cedal",
      category: "",
      profiles: [
        {
          code: "CED-CAB1924", category: "Cortinero Bano Niquelado", description: "CABEZAL CAB VIDRIO TEMPLADO CEDAL",
          role: "cabina-cabezal", formula: "lineal", coefBase: 1
        },
        {
          code: "CED-BAS6939", category: "Cortinero Bano Niquelado", description: "BASE CB VIDRIO TEMPLADO CEDAL",
          role: "cabina-base", formula: "lineal", coefBase: 1
        },
        {
          code: "CED-JAM8113", category: "Cortinero Bano Niquelado", description: "JAMBA C/ VIDRIO TEMPLADO",
          role: "cabina-jamba", formula: "lineal", coefAltura: 2
        },
        {
          code: "CED-HOR6738", category: "Cortinero Bano Niquelado", description: "HORIZONTAL SUPERIOR CEDAL",
          role: "cabina-horizontal-superior", formula: "lineal", coefBase: 1
        }
      ],
      accessories: [
        { name: "Ruedas de puerta de cabina", qty: 2, price: 1.5 },
        { name: "Boton acero inoxidable", qty: 1, price: 8 },
        { name: "Tornillos y tacos", qty: 20, price: 0.05 },
        { name: "Topes de cabina", qty: 4, price: 0.5 },
        { name: "Guia de cabina", qty: 1, price: 0.5 },
        { name: "Silicon", qty: 1, price: 2.2 }
      ],
      labor: { workers: 1, hours: 8, transport: 0, viaticos: 0 },
      updatedAt: null,
      updatedBy: "importado de CABINA DE BAÑO ACTUALIZADO.xlsx"
    },

    /**
     * Cabina de baño en sistema M&B (acero inoxidable) y vidrio templado.
     * Fuente: CABINA DE BAÑO ACTUALIZADO.xlsx, hoja "ACERO INOXIDABLE".
     *
     * No lleva perfiles de aluminio: el marco ES el sistema M&B, que se compra
     * armado. Por eso `profiles` va vacío y todo el costo del herraje entra por
     * accesorios.
     *
     * OJO: el sistema M&B queda en 0 a propósito. Cada cabina lleva uno solo y
     * son excluyentes (MB-004 / MB-008 / BM-007 / MB-009), así que hay que
     * poner 1 en el que corresponda al cotizar. Cuando el editor de módulos
     * tenga fila de "selección única" esto se va a poder dejar preelegido.
     */
    "cabinas-acero-y-vidrio--cabina-corrediza-2-modulos": {
      itemId: "cabinas-acero-y-vidrio--cabina-corrediza-2-modulos",
      itemName: "CABINA CORREDIZA 2 MODULOS",
      group: "CABINAS DE BAÑO",
      family: "CABINAS ACERO Y VIDRIO",
      note: "Solo corrediza",
      brand: "cedal",
      category: "",
      profiles: [],
      accessories: [
        { name: "Sistema MB-004", qty: 0, price: 105 },
        { name: "Sistema MB-008", qty: 0, price: 90 },
        { name: "Sistema BM-007 en angulo 90", qty: 0, price: 190 },
        { name: "Sistema MB-009 en angulo 90", qty: 0, price: 170 },
        { name: "Tornillos y tacos", qty: 30, price: 0.05 },
        { name: "Cinta masking", qty: 0.5, price: 1 },
        { name: "Silicon", qty: 1, price: 2.2 }
      ],
      labor: { workers: 1, hours: 8, transport: 0, viaticos: 0 },
      updatedAt: null,
      updatedBy: "importado de CABINA DE BAÑO ACTUALIZADO.xlsx"
    },

    /**
     * Ventana fija en tubo 4x4.
     * Fuente: VENTANAS FIJAS.xlsx, hoja "V. FIJA TUBO".
     *
     * Una sola receta sirve para 1, 2, 3 y 4 módulos: todo escala por fórmula.
     *   marco     = Base x2 + Alto x(Módulos+1)   -> 4, 5, 6, 7
     *   junquillo = Base x2 + Alto x2 x Módulos   -> 4, 6, 8, 10  (espalda y tapa)
     *   vinil     = igual que el junquillo
     *   ancla     = 2 x Módulos + 2               -> 4, 6, 8, 10
     *
     * Esa hoja trae bloques duplicados para 2 y 3 módulos con fórmulas que no
     * coinciden entre sí. Se tomaron los que siguen el patrón de 1 y 4 módulos
     * (para 2 módulos el segundo bloque, para 3 módulos el primero); los otros
     * dos invierten Base con Alto o traen un ajuste manual de 0,5 que no
     * aparece en ninguna otra parte.
     *
     * Tornillos (40, 80/100, 100, 200) y mano de obra (4, 5, 7, 14) no siguen
     * ningún patrón en la hoja, así que quedan como valor de arranque para
     * cargar a mano al cotizar.
     */
    "ventana-fija-en-tubo--ventana-fija-1-modulo": {
      itemId: "ventana-fija-en-tubo--ventana-fija-1-modulo",
      itemName: "VENTANA FIJA 1 MODULO",
      group: "VENTANAS",
      family: "VENTANA FIJA EN TUBO",
      note: "",
      brand: "cedal",
      category: "",
      profiles: [
        {
          code: "CED-TUB4245", category: "Tubos y Canales", description: "TUBO DE 1-1/2 X 1-1/2 (MARCO)",
          role: "ventana-tubo-marco", formula: "lineal", coefBase: 2, coefAltura: 1, coefAlturaMod: 1
        },
        {
          code: "CED-JUN0971", category: "Junquillos", description: "JUNQUILLO TRIANGULAR 1-1/2 ESPALDA",
          role: "ventana-tubo-junquillo-espalda", formula: "lineal", coefBase: 2, coefAlturaMod: 2
        },
        {
          code: "CED-JUN0242", category: "Junquillos", description: "JUNQUILLO TRIANGULAR 1-1/2 TAPA",
          role: "ventana-tubo-junquillo-tapa", formula: "lineal", coefBase: 2, coefAlturaMod: 2
        }
      ],
      accessories: [
        { name: "Vinil", qty: 0, price: 0.85, qtyFormula: { coefBase: 2, coefAlturaMod: 2 } },
        { name: "Ancla", qty: 0, price: 0.45, qtyFormula: { coefModulos: 2, fixedQty: 2 } },
        { name: "Silicon", qty: 1, price: 2.2 },
        { name: "Tornillos y tacos", qty: 40, price: 0.05 }
      ],
      labor: { workers: 1, hours: 4, transport: 0, viaticos: 0 },
      updatedAt: null,
      updatedBy: "importado de VENTANAS FIJAS.xlsx"
    },
    /**
     * VENTANA FIJA CON PERFIL PROYECTABLE — sacada de VENTANAS FIJAS.xlsx,
     * hoja "V. FIJA PROYECTABLE", el bloque de abajo (filas 88-91), que es el
     * único que trae los códigos escritos: MAR0928, PER1794, JUN0876 y PER8653.
     *
     * Cantidades tal cual el Excel (Base = E85, Altura = E86):
     *   MARCO DOBLE      = Altura x 1
     *   MARCO PROYECTABLE (PERIMETRAL MARCO) = Base x2 + Altura x2  (perímetro)
     *   JUNQUILLO REDONDO = Base x2 + Altura x4
     *   PERIMETRAL DE HOJA = 0 — en el Excel esta ventana no lleva hoja que abra,
     *     así que el perfil está listado pero no se cobra. Si alguna variante sí
     *     lleva hoja, hay que cargarle coefBaseHoja/coefAlturaHoja y las medidas
     *     de hoja al cotizar.
     *
     * El Excel solo resuelve 1 módulo, así que ninguna cantidad crece con la
     * cantidad de módulos todavía (a diferencia de la Fija 1100). Hasta tener las
     * fórmulas de 2, 3 y 4 módulos, esta receta cotiza igual para toda la familia.
     */
    "ventana-fija-con-perfil-proyectable--ventana-fija-con-perfil-proyectable-1-modulo": {
      itemId: "ventana-fija-con-perfil-proyectable--ventana-fija-con-perfil-proyectable-1-modulo",
      itemName: "VENTANA FIJA CON PERFIL PROYECTABLE 1 MODULO",
      group: "VENTANAS",
      family: "VENTANA FIJA CON PERFIL PROYECTABLE",
      note: "",
      brand: "cedal",
      category: "",
      profiles: [
        {
          code: "CED-MAR0928", category: "Ventana Proyectable", description: "MARCO DOBLE",
          role: "ventana-fija-proyectable-marco-doble", formula: "lineal", coefAltura: 1
        },
        {
          code: "CED-PER1794", category: "Ventana Proyectable", description: "PERIMETRAL MARCO (MARCO PROYECTABLE)",
          role: "ventana-fija-proyectable-marco", formula: "lineal", coefBase: 2, coefAltura: 2
        },
        {
          code: "CED-JUN0876", category: "Ventana Proyectable", description: "JUNQUILLO REDONDO",
          role: "ventana-fija-proyectable-junquillo", formula: "lineal", coefBase: 2, coefAltura: 4
        },
        {
          code: "CED-PER8653", category: "Ventana Proyectable", description: "PERIMETRAL HOJA",
          role: "ventana-fija-proyectable-perimetral-hoja", formula: "lineal"
        }
      ],
      accessories: [
        { name: "Tornillos y tacos", qty: 30, price: 0.05 },
        { name: "Vinil", qty: 0, price: 0.85, qtyFormula: { coefBase: 4, coefAltura: 8 } },
        { name: "Silicon", qty: 1, price: 2.2 }
      ],
      labor: { workers: 1, hours: 5, transport: 0, viaticos: 0 },
      updatedAt: null,
      updatedBy: "importado de VENTANAS FIJAS.xlsx"
    }
  },
  defaultSettings: {
    gastosGenerales: 0.14,
    utilidad: 0.30,
    laborCostPerHour: 5.00,
    iva: 0.15,
    companyName: 'CASALUM',
    companySubtitle: 'aluminio - vidrio',
    companyWebsite: 'www.casalumcuenca.com',
    companyAddress: 'Cuenca, Ecuador',
    companyRep: 'ING. JOSE MAURICIO PERALTA',
    companyRepTitle: 'GERENTE GENERAL',
    companyCalif: 'CALIF. ARTESANAL #89455',
    plazoEntrega: 'A CONVENIR',
    garantia: '1 AÑO POR DEFECTOS DE FABRICACION',
    formaPago: ['50% A LA FIRMA DEL CONTRATO', '25% AL INICIO DE LA INSTALACION', '25% AL TERMINO DE LA OBRA'],
    tarifaCero: true
  }
};

/**
 * Parche de "roles genéricos" (ver js/ventanaFija1100.js), armado automáticamente a
 * partir de los `genericRoles` de arriba: { marca: { codigo: [roles...] } }.
 *
 * Por qué existe: el catálogo real que usa la app NO sale de este archivo — sale de
 * Firestore (o de su copia en localStorage), que sobreescribe window.SEED_DATA.brands
 * completo al cargar (ver catalog.js). Si ese catálogo guardado es de antes de que
 * estos productos tuvieran `genericRoles`, la etiqueta se pierde aunque este archivo
 * la tenga. catalog.js llama a window.applyGenericRolePatches() después de cada carga
 * para re-aplicar las etiquetas por código, sin tocar precios ni descripciones.
 */
window.GENERIC_ROLE_PATCHES = (function () {
    const patches = {};
    Object.keys(window.SEED_DATA.brands).forEach(brandKey => {
        const brand = window.SEED_DATA.brands[brandKey];
        Object.keys(brand.categories || {}).forEach(catName => {
            brand.categories[catName].products.forEach(p => {
                if (p.genericRoles && p.genericRoles.length) {
                    patches[brandKey] = patches[brandKey] || {};
                    patches[brandKey][p.code] = p.genericRoles;
                }
            });
        });
    });
    return patches;
})();
